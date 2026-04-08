# Контекст проекта «I am Agent» — для AI

> Этот файл — дополнительный контекст для AI. Главный документ: CURSOR_RULES.md.
> При противоречии — CURSOR_RULES.md имеет приоритет.

---

## Отложенные задачи

- **Чистка переводов** — дублирующиеся ключи в `src/i18n/translations.js`: `ownerCommissionOneTime` vs `bookingOwnerCommOnce`, `bkTotalPrice` vs `bookingTotalPrice`. Затрагивает ~10 файлов.

---

## Стек и запуск

**Стек:** Expo SDK 54 + React Native + Supabase (PostgreSQL + Auth + Realtime + Storage)

**Запуск локально:**
- Веб: `npx expo start --web` или `npx expo start --port 8083`
- Телефон: сканировать QR через Expo Go (нужен `npx expo login` перед первым запуском)

---

## Авторизация и профиль

Авторизация через Supabase Auth. После входа загружается профиль через `authService.getUserProfile()`.

Объект пользователя в UserContext содержит:
- `user.plan` — тариф: standard / premium / korshun
- `user.teamRole` — роль в команде: admin / agent / null
- `user.isAdminRole` — boolean
- `user.isAgentRole` — boolean
- `user.teamPermissions` — детальные права из company_members.permissions
- `user.language` — язык платформы (web_language или app_language из agents.settings)

---

## Навигация

**Мобайл (4 вкладки):**
1. База объектов (RealEstateScreen)
2. Календарь бронирований (BookingCalendarScreen)
3. Календарь агента (AgentCalendarScreen)
4. Мой аккаунт (AccountScreen)

**Веб (боковое меню):**
1. Рабочая панель (WebDashboardScreen)
2. База (WebPropertiesScreen)
3. Бронирования (WebBookingsScreen)
4. Контакты (WebContactsScreen)
5. Мой аккаунт (WebAccountScreen)

---

## Ключевые сервисы

| Сервис | Назначение |
|--------|-----------|
| `authService.js` | Авторизация, загрузка профиля, обновление настроек |
| `propertiesService.js` | CRUD объектов, approve/reject, история отклонений |
| `bookingsService.js` | CRUD бронирований, проверка пересечений дат |
| `companyService.js` | Управление командой, приглашения |
| `contactsService.js` | CRUD контактов |
| `locationsService.js` | Управление локациями |
| `companyChannel.js` | broadcastChange() — сигналы обновления данных |

---

## Язык

- Хранится в `agents.settings.web_language` (веб) и `agents.settings.app_language` (мобайл)
- По умолчанию: английский (en)
- Управляется через LanguageContext
- Подробнее: CURSOR_RULES.md раздел 2.5
