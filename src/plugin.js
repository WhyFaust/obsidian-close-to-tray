const { Plugin, PluginSettingTab, Setting, Notice } = require("obsidian");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");
const path = require("node:path");

class Indicator {
    constructor(image, labels, onAction) {
        this.ready = false;
        this.closed = false;
        const processHandle = spawn("/usr/bin/python3", ["-u", "-c", INDICATOR_PROGRAM]);
        this.process = processHandle;
        processHandle.stderr.resume();
        const gone = () => {
            if (this.closed) return;
            this.ready = false;
            onAction("unavailable");
        };
        processHandle.on("error", gone);
        processHandle.stdin.on("error", gone);
        processHandle.on("close", gone);
        createInterface({ input: processHandle.stdout }).on("line", (line) => {
            if (this.closed) return;
            if (line === "ready") this.ready = true;
            if (line === "unavailable") this.ready = false;
            onAction(line);
        });
        this.send({ ...labels, png: image.toString("base64") });
    }

    send(message) {
        if (!this.closed && !this.process.stdin.destroyed) {
            this.process.stdin.write(JSON.stringify(message) + "\n");
        }
    }

    stop() {
        this.closed = true;
        this.ready = false;
        this.process.stdin.end();
    }
}

module.exports = class GnomeTray extends Plugin {
    async onload() {
        if (process.platform !== "linux") {
            new Notice("Keep Open in Tray доступен только на Linux.");
            return;
        }
        this.settings = {
            runInBackground: true,
            createTrayIcon: true,
            focusOnRelaunch: true,
            trayIconPath: "",
            trayTooltip: "{{vault}} — Obsidian",
            ...await this.loadData(),
        };
        if (this.stopped) return;
        try {
            this.electron = window.require("@electron/remote");
        } catch {
            this.electron = window.require("electron").remote;
        }
        if (!this.electron) return;
        this.win = this.electron.getCurrentWindow();
        this.popouts = new Set();
        this.hiddenPopouts = new Set();
        this.nativeClose = (event) => {
            if (this.exiting || !this.settings.runInBackground || !this.linuxTray?.ready) return;
            this.closeRequested = true;
            event.preventDefault();
            this.hideToTray();
            window.clearTimeout(this.closeTimer);
            this.closeTimer = window.setTimeout(() => { this.closeRequested = false; }, 300);
        };
        this.cancelsClose = (event) => {
            if (!this.closeRequested || this.exiting || !this.linuxTray?.ready) return;
            this.closeRequested = false;
            event.preventDefault();
            event.returnValue = false;
            event.stopImmediatePropagation();
        };
        this.rememberPopout = (popup) => {
            this.popouts.add(popup);
            popup.once("closed", () => {
                this.popouts.delete(popup);
                this.hiddenPopouts.delete(popup);
            });
        };
        this.aboutToQuit = () => { this.exiting = true; };
        this.reopen = () => {
            if (this.settings.focusOnRelaunch && this.hiddenByPlugin) this.show();
        };
        this.win.on("close", this.nativeClose);
        this.win.webContents.on("did-create-window", this.rememberPopout);
        this.electron.app.on("before-quit", this.aboutToQuit);
        this.electron.app.on("second-instance", this.reopen);
        window.addEventListener("beforeunload", this.cancelsClose, { capture: true });
        this.addSettingTab(new TraySettings(this.app, this));
        this.addCommand({ id: "toggle-window", name: "Показать или скрыть окно", callback: () => this.toggle() });
        this.addCommand({ id: "show-window", name: "Показать окно", callback: () => this.show() });
        this.addCommand({ id: "hide-window", name: "Скрыть окно в трей", callback: () => this.hideToTray() });
        this.resetIndicator();
    }

    labels() {
        const vault = this.app.vault.getName() || "Obsidian";
        const tooltip = (this.settings.trayTooltip || "{{vault}} — Obsidian").replace(/{{vault}}/g, vault);
        return { vault, tooltip };
    }

    resetIndicator() {
        this.showIfHidden();
        this.linuxTray?.stop();
        this.linuxTray = null;
        if (!this.settings.createTrayIcon) return;
        const appIcon = path.join(path.dirname(process.execPath), "resources", "icon.png");
        const { nativeImage } = this.electron;
        const image = [this.settings.trayIconPath, appIcon, "/usr/share/icons/hicolor/32x32/apps/obsidian.png"]
            .filter(Boolean)
            .map((filename) => nativeImage.createFromPath(filename))
            .find((image) => !image.isEmpty());
        if (!image) {
            new Notice("Keep Open in Tray не нашёл изображение для значка.");
            return;
        }
        this.linuxTray = new Indicator(image.resize({ width: 32 }).toPNG(), this.labels(), (action) => {
            if (action === "toggle") this.toggle();
            if (action === "unavailable") this.showIfHidden();
            if (action === "relaunch") this.quit(true);
            if (action === "quit") this.quit(false);
        });
    }

    hideToTray() {
        if (!this.linuxTray?.ready || !this.win || this.win.isDestroyed()) return false;
        this.hiddenByPlugin = true;
        for (const popup of this.popouts) {
            if (popup.isDestroyed() || !popup.isVisible()) continue;
            this.hiddenPopouts.add(popup);
            popup.hide();
        }
        this.win.hide();
        return !this.win.isVisible();
    }

    showIfHidden() {
        if (this.hiddenByPlugin && !this.exiting) this.show();
    }

    show() {
        if (!this.win || this.win.isDestroyed()) return;
        this.hiddenByPlugin = false;
        this.win.show();
        for (const popup of this.hiddenPopouts) {
            if (!popup.isDestroyed()) popup.show();
        }
        this.hiddenPopouts.clear();
        this.win.focus();
    }

    toggle() {
        if (this.win.isVisible()) this.hideToTray();
        else this.show();
    }

    quit(restart) {
        this.exiting = true;
        this.closeRequested = false;
        if (restart) {
            this.electron.app.relaunch();
            this.electron.app.quit();
        } else {
            this.win.close();
        }
    }

    onunload() {
        this.stopped = true;
        window.clearTimeout(this.closeTimer);
        this.showIfHidden();
        this.linuxTray?.stop();
        if (!this.electron) return;
        this.electron.app.removeListener("before-quit", this.aboutToQuit);
        this.electron.app.removeListener("second-instance", this.reopen);
        window.removeEventListener("beforeunload", this.cancelsClose, { capture: true });
        if (this.win?.isDestroyed() === false) {
            this.win.removeListener("close", this.nativeClose);
            this.win.webContents.removeListener("did-create-window", this.rememberPopout);
        }
    }
};

class TraySettings extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl, plugin } = this;
        containerEl.empty();
        for (const [setting, label] of [
            ["runInBackground", "Скрывать по крестику"],
            ["createTrayIcon", "Показывать значок в трее"],
            ["focusOnRelaunch", "Возвращать окно при повторном запуске"],
        ]) {
            new Setting(containerEl).setName(label).addToggle((control) =>
                control.setValue(plugin.settings[setting]).onChange(async (value) => {
                    plugin.settings[setting] = value;
                    await plugin.saveData(plugin.settings);
                    if (setting === "createTrayIcon") plugin.resetIndicator();
                })
            );
        }
        new Setting(containerEl).setName("Путь к значку").addText((control) =>
            control.setValue(plugin.settings.trayIconPath).onChange(async (value) => {
                plugin.settings.trayIconPath = value.trim();
                await plugin.saveData(plugin.settings);
            })
        ).addButton((button) => button.setButtonText("Применить").onClick(() => plugin.resetIndicator()));
        new Setting(containerEl).setName("Подсказка значка").addText((control) =>
            control.setValue(plugin.settings.trayTooltip).onChange(async (value) => {
                plugin.settings.trayTooltip = value;
                await plugin.saveData(plugin.settings);
                plugin.linuxTray?.send(plugin.labels());
            })
        );
    }
}
