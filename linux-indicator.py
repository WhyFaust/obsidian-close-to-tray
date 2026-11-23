"""Expose an Obsidian tray icon to the Linux desktop via AppIndicator."""
import base64
import ctypes
import json
import sys
import tempfile
from pathlib import Path
from uuid import uuid4

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gio, GLib, Gtk


def function(library, name, result, *arguments):
    method = getattr(library, name)
    method.restype = result
    method.argtypes = arguments
    return method


def run():
    settings = json.loads(sys.stdin.readline())
    if not Gtk.init_check()[0]:
        raise RuntimeError("AppIndicator needs a graphical session")

    library = ctypes.CDLL("libayatana-appindicator3.so.1")
    new = function(library, "app_indicator_new", ctypes.c_void_p,
                   ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int)
    set_status = function(library, "app_indicator_set_status", None,
                          ctypes.c_void_p, ctypes.c_int)
    set_menu = function(library, "app_indicator_set_menu", None,
                        ctypes.c_void_p, ctypes.c_void_p)
    set_title = function(library, "app_indicator_set_title", None,
                         ctypes.c_void_p, ctypes.c_char_p)
    capsule_pointer = function(ctypes.pythonapi, "PyCapsule_GetPointer",
                               ctypes.c_void_p, ctypes.py_object, ctypes.c_char_p)
    indicator_id = "faust_obsidian_" + uuid4().hex
    item_path = "/org/ayatana/NotificationItem/" + indicator_id
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    loop = GLib.MainLoop()
    menu = Gtk.Menu()
    heading = Gtk.MenuItem.new_with_label(settings["vault"])
    heading.set_sensitive(False)
    menu.append(heading)
    for label, command in (("Показать / скрыть", "toggle"),
                           ("Перезапустить Obsidian", "relaunch"),
                           ("Выйти из Obsidian", "quit")):
        item = Gtk.MenuItem.new_with_label(label)
        item.connect("activate", lambda _item, value=command: print(value, flush=True))
        menu.append(item)
    menu.show_all()

    with tempfile.TemporaryDirectory(prefix="obsidian-tray-icon-") as directory:
        icon = Path(directory) / "obsidian.png"
        icon.write_bytes(base64.b64decode(settings["png"], validate=True))
        # The user's GNOME panel reads the image path on the same desktop.
        tray = new(indicator_id.encode(), bytes(icon), 0)
        if not tray:
            raise RuntimeError("AppIndicator could not create an icon")
        set_title(tray, settings["tooltip"].encode())
        set_menu(tray, capsule_pointer(menu.__gpointer__, None))
        set_status(tray, 1)
        last = False

        def check_registration():
            nonlocal last
            try:
                result = bus.call_sync(
                    "org.kde.StatusNotifierWatcher", "/StatusNotifierWatcher",
                    "org.freedesktop.DBus.Properties", "GetAll",
                    GLib.Variant("(s)", ("org.kde.StatusNotifierWatcher",)),
                    None, Gio.DBusCallFlags.NONE, 1000, None,
                ).unpack()[0]
                ready = result.get("IsStatusNotifierHostRegistered", False) and any(
                    entry.endswith(item_path) for entry in result.get("RegisteredStatusNotifierItems", ())
                )
            except GLib.Error:
                ready = False
            if ready != last:
                print("ready" if ready else "unavailable", flush=True)
                last = ready
            return True

        def update_labels(_source, condition):
            if condition & (GLib.IO_HUP | GLib.IO_ERR):
                loop.quit()
                return False
            text = sys.stdin.readline()
            if not text:
                loop.quit()
                return False
            labels = json.loads(text)
            heading.set_label(labels["vault"])
            set_title(tray, labels["tooltip"].encode())
            return True

        GLib.timeout_add(750, check_registration)
        GLib.io_add_watch(sys.stdin.fileno(), GLib.PRIORITY_DEFAULT,
                          GLib.IO_IN | GLib.IO_HUP | GLib.IO_ERR, update_labels)
        loop.run()
        set_status(tray, 0)


if __name__ == "__main__":
    run()
