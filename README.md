# Keep Open in Tray

Крестик скрывает окно хранилища в системный трей. Значок возвращает окно.
Пункт **Quit completely** в меню значка завершает работу приложения.
На Linux плагин ждёт регистрации значка в системной панели. Если панель
не принимает значок, крестик закрывает окно обычным способом. Пока окно
скрыто, при потере значка плагин снова открывает его.

Для значка на Linux нужны StatusNotifierHost, системный Python 3 с PyGObject,
GTK 3 и библиотека Ayatana AppIndicator 3. В Ubuntu с включённым расширением
Ubuntu AppIndicators эти компоненты доступны из системы.

## Установка

Скопируйте `main.js`, `manifest.json` и `styles.css` из выпуска в
`.obsidian/plugins/faust-close-to-tray/` внутри хранилища.
Перезапустите Obsidian и включите **Keep Open in Tray** в разделе сторонних плагинов.

Для автоматического старта в трее используется отдельный плагин
[Start in Tray at Login](https://github.com/WhyFaust/obsidian-start-in-tray).

## Сборка

```sh
npm ci
npm run build
```

Основан на [Background Tray](https://github.com/Synaphi/background-tray)
от Synaphi. Исходный проект и этот вариант распространяются по лицензии MIT.
