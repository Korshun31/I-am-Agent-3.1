# Контекст проекта «I am Agent» — для AI

## 📋 Отложенные задачи (спроси когда закончим функциональные задачи)

- **Чистка переводов** — в `src/i18n/translations.js` есть дублирующиеся ключи для одних и тех же полей (например `ownerCommissionOneTime` и `bookingOwnerCommOnce` означают одно и то же). Нужно объединить в одну систему ключей. Затрагивает ~10 файлов.
- **`bkTotalPrice` vs `bookingTotalPrice`** — два разных ключа для поля "Общая стоимость" в вебе и мобильном. Унифицировать.

---

## Командная система — реализована. См. CURSOR_RULES.md разделы 3 и 4.

## Что это

Мобильное приложение для **агента по недвижимости** (органайзер/личный кабинет).  
Стек: **Expo SDK 54 + React Native**. Запуск: веб или Expo Go на телефоне.

## Навигация по экранам

1. **Preloader** — логотип (5 полос), «I am Agent», «Загрузка…» ~2.5 сек.
2. **Login** — E-mail, Password; Login, Sign up; соц. входы.
3. **Registration** — Name, E-mail, Password; Create account, Back.
4. **Main** — нижняя навигация (4 вкладки). По умолчанию **Account**. Остальные — заглушки.

## AccountScreen — личный кабинет

- **Шапка:** заголовок Account, кнопка выхода.
- **Аватар и имя** — при наличии.
- **My details** — заполненные поля (телефон, email, Telegram, WhatsApp и т.д.); кнопка редактирования (карандаш) → `MyDetailsEditModal`.
- **Settings (раскрываемый блок):**
  - Язык → `LanguageModal` (en, th, ru)
  - Уведомления → `NotificationsModal`
  - Валюта → `CurrencyModal`
- **Locations (раскрываемый блок):** список локаций, кнопка «+» → `AddLocationsModal` (country-state-city).
- **Contacts** — список контактов (телефон, email), клик — звонок/SMS/почта.

## Хранилище агентов

- **Файл:** `agents.json` в `documentDirectory` (expo-file-system).
- **Модуль:** `src/services/agentsStorage.js`
  - `saveAgent(agent)` — сохранить агента (с паролем).
  - `getAgentByEmail(email)` — получить по email.
  - `agentToUser(agent)` — отдать данные без пароля для UI.
- **Регистрация:** валидация email/пароля; проверка «email уже есть»; сохранение; переход в Main с `user`.
- **Логин:** поиск по email; при неверном пароле — алерт; иначе переход в Main с профилем.

## Состояние user в App.js

```js
user = {
  email, name, lastName, phone, telegram,
  documentNumber, extraPhones, extraEmails,
  whatsapp, photoUri
}
```

- Передаётся в `MainScreen` → `AccountScreen`.
- Обновление: `onUserUpdate(updatedUser)` → `handleUserUpdate` в App.js.

## Контекст языка

- `src/context/LanguageContext.js` — `language`, `setLanguage`, `t(key)`.
- Переводы: `src/i18n/translations.js` (en, th, ru).
- При смене языка — сохранение в AsyncStorage (fallback при ошибке).

## Важные файлы

| Файл | Назначение |
|------|------------|
| `App.js` | Экран (preloader/login/registration/main), `user`, `goToMain`, `handleLogout`, `handleUserUpdate` |
| `src/screens/Login.js` | Вход, проверка по базе, `onLogin(user)` / `onSignUp()` |
| `src/screens/Registration.js` | Регистрация, валидация, `saveAgent()`, `onSuccess(agentToUser(agent))` |
| `src/screens/MainScreen.js` | BottomNav, выбор Account или заглушек |
| `src/screens/AccountScreen.js` | Профиль, Settings, Locations, Contacts, модалки |
| `src/services/agentsStorage.js` | Работа с agents.json (expo-file-system) |
| `src/context/LanguageContext.js` | Язык, переводы |
| `src/components/BottomNav.js` | Нижняя навигация |
| `src/components/AppPopup.js` | Модальный попап (подтверждение выхода и т.п.) |
| `src/components/MyDetailsEditModal.js` | Редактирование профиля |
| `src/components/LanguageModal.js` | Выбор языка |
| `src/components/NotificationsModal.js` | Настройки уведомлений |
| `src/components/CurrencyModal.js` | Выбор валюты |
| `src/components/AddLocationsModal.js` | Добавление локаций (country-state-city) |

## Запуск

- Веб: `npx expo start --web` или `ЗАПУСТИТЬ_ПРИЛОЖЕНИЕ.command`
- Телефон: `ЗАПУСТИТЬ_НА_ТЕЛЕФОНЕ.command` (порт 8082)

См. [КАК_ЗАПУСТИТЬ.md](./КАК_ЗАПУСТИТЬ.md)
