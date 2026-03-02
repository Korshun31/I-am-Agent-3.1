# I am Agent

Мобильное приложение для агента по недвижимости — органайзер и личный кабинет.  
Your smart organizer for real estate.

## Стек

- **Expo SDK 54** (React Native) — iOS, Android, веб
- Хранение данных: **expo-file-system** (файл `agents.json`)
- Переводы: **i18n** (en, th, ru)

## Быстрый запуск

```bash
npm install
npm start
```

- **Веб:** `npx expo start --web` или `ЗАПУСТИТЬ_ПРИЛОЖЕНИЕ.command`
- **Телефон (Expo Go):** `ЗАПУСТИТЬ_НА_ТЕЛЕФОНЕ.command` — порт 8082

Подробная инструкция: [КАК_ЗАПУСТИТЬ.md](./КАК_ЗАПУСТИТЬ.md)

## Структура проекта

```
├── App.js                 # Точка входа, роутинг экранов, user state
├── src/
│   ├── screens/           # Экраны
│   │   ├── Preloader.js   # Загрузка (логотип, анимация)
│   │   ├── Login.js       # Вход (email, пароль)
│   │   ├── Registration.js
│   │   ├── MainScreen.js  # Нижняя навигация, Account + заглушки
│   │   └── AccountScreen.js
│   ├── components/        # Компоненты и модалки
│   │   ├── BottomNav.js
│   │   ├── Logo.js
│   │   ├── AppPopup.js
│   │   ├── ErrorBoundary.js
│   │   ├── LanguageModal.js
│   │   ├── NotificationsModal.js
│   │   ├── CurrencyModal.js
│   │   ├── AddLocationsModal.js
│   │   └── MyDetailsEditModal.js
│   ├── context/
│   │   └── LanguageContext.js
│   ├── services/
│   │   └── agentsStorage.js   # Хранение агентов (expo-file-system)
│   └── i18n/
│       └── translations.js   # Переводы en, th, ru
└── assets/                # Иконки и изображения
```

## Правила и порядок

См. [CONVENTIONS.md](./CONVENTIONS.md) — правила работы с проектом и стиль кода.

## Контекст для AI

Для быстрого входа в курс дела: [CONTEXT_FOR_AI.md](./CONTEXT_FOR_AI.md)
