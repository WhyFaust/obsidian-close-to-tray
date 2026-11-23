# Keep Open in Tray

Keep Obsidian running in your GNOME system tray, so background sync can continue
after you close the window. Tested on Ubuntu 24.04 with Obsidian 1.15.1.

## Installation

1. Enable Ubuntu AppIndicators or a compatible StatusNotifier panel.
2. Install **Keep Open in Tray** in Community plugins. For manual installation,
   put `manifest.json` and `main.js` from the same GitHub release in
   `.obsidian/plugins/faust-close-to-tray/`, then enable the plugin.
3. The Linux system needs Python 3 with PyGObject, GTK 3, and Ayatana AppIndicator 3.

## Usage

Click the window close button to hide the vault. Open the Obsidian icon's menu
in the top panel and select **Показать / скрыть** to restore the window, or
**Выйти из Obsidian** to quit. The window remains accessible if the tray
registration is lost. For hidden startup at login, install
[Start in Tray at Login](https://github.com/WhyFaust/obsidian-start-in-tray).

## System access

The plugin starts `/usr/bin/python3` with its bundled helper to register the
icon through the local D-Bus session. It reads Obsidian's installed icon or
the image selected in settings and writes a temporary PNG outside the vault
for the panel to read. The helper removes that file when it exits normally.
The plugin communicates locally and uses no network services.

## По-русски

Закрывайте окно Obsidian крестиком и возвращайте его через значок в верхней
панели GNOME. Фоновая синхронизация хранилища продолжается. В меню значка
можно открыть окно, перезапустить Obsidian или полностью выйти.

Плагин скрывает окно после регистрации значка. Если панель теряет значок,
плагин возвращает скрытое окно. Полностью закрыть окно также можно через
меню значка.

### Установка

Для GNOME на Linux нужны включённый AppIndicators, системный Python 3 с
PyGObject, GTK 3 и Ayatana AppIndicator 3. Проверено на Ubuntu 24.04 и
Obsidian 1.15.1.

Скопируйте `main.js` и `manifest.json` из одного выпуска в
`.obsidian/plugins/faust-close-to-tray/` вашего хранилища и включите
**Keep Open in Tray** в настройках сторонних плагинов. Для запуска в трее при
входе в Linux добавьте [Start in Tray at Login](https://github.com/WhyFaust/obsidian-start-in-tray).

### Системный доступ

Плагин запускает системный Python в текущем графическом сеансе, чтобы
зарегистрировать значок через локальную шину D-Bus. Для изображения
он читает значок установленного Obsidian или файл, выбранный в настройках,
и пишет его копию в системный временный каталог. При завершении
вспомогательный процесс удаляет временное изображение. Сеть
для работы плагина не требуется.

### Сборка

```sh
npm ci
npm run build
```

Лицензия MIT.

### История

Версия 0.2.0 собрана из самостоятельной реализации для Linux. Ранние
версии 0.1.x в истории репозитория были основаны на Background Tray
от Synaphi и распространяются по лицензии MIT.
