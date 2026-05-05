# 🏛 УСТАВ ПРОЕКТА — I am Agent CRM
> **Это главный документ проекта.** Cursor и все AI-агенты читают его первым.
> При любом противоречии между этим файлом и другими документами — этот файл имеет приоритет.
> Последнее обновление: Апрель 2026

---

## 0. КАК РАБОТАТЬ С ЭТИМ ДОКУМЕНТОМ

**Инженер (планировщик):** читает разделы 1, 2, 3, 4, 7
**Developer:** читает разделы 1, 2, 3, 5, 6
**QA Engineer:** читает разделы 1, 2, 4, 6

В начале каждого нового чата в Cursor писать:
Ты — [Developer / QA Engineer / Инженер], работаешь над проектом I am Agent.
Прочитай CURSOR_RULES.md и следуй правилам своей роли.

---

## 1. ЧТО ТАКОЕ I AM AGENT

**I am Agent** — CRM-система для предпринимателей работающих в сфере аренды недвижимости (помесячная аренда).
Целевой пользователь: предприниматель в сфере аренды недвижимости который ведёт базу объектов, бронирования и клиентов.
Уникальность: единственная CRM заточенная под помесячную аренду (не посуточную, не городскую).

**Платформы:**
- **Мобильное приложение:** Expo SDK 54 + React Native (iOS, Android)
- **Веб-версия:** React Native Web → деплой на Vercel
- **Бэкенд:** Supabase (PostgreSQL + Auth + Realtime + Storage)

**Текущий статус:** продукт запущен, идёт мониторинг после релиза (коммит 6e7e637, 2026-03-28).

---

## 2. ФУНДАМЕНТАЛЬНЫЕ ПРАВИЛА АРХИТЕКТУРЫ

### 2.1 Главный принцип: всё привязано к company_id

При регистрации каждого нового пользователя автоматически создаётся техническая компания в фоне — пользователь её не видит. Это контейнер для всех его данных.

Все объекты, контакты, бронирования, локации, события календаря привязаны к company_id — не к user_id.

**Два уровня компании:**

Уровень 1 — Техническая компания (все пользователи, тариф standard):
- Создаётся автоматически при регистрации
- Пользователь её не видит в интерфейсе
- Хранит все данные пользователя
- Пользователь работает как частный предприниматель

Уровень 2 — Видимая компания (тариф premium/korshun):
- Пользователь вручную заполняет название, логотип, телефон, контакты
- Это та же техническая компания — просто с заполненными полями
- Появляется возможность приглашать сотрудников (роль agent)
- Приглашённые сотрудники не платят — они бесплатные участники

**Роли при регистрации:**
- Новый пользователь → всегда роль admin, тариф standard
- Приглашённый сотрудник → роль agent, тариф не нужен

### 2.2 Синхронизация данных

Единственный разрешённый паттерн:
Действие → broadcastChange(key) → refreshKey++ → load()

ЗАПРЕЩЕНО без явного разрешения:
- supabase.channel().on('postgres_changes') — только там где уже есть
- window.addEventListener / window.dispatchEvent
- setInterval / polling

Realtime подписки существуют ровно в двух местах:
1. WebNotificationBell — на таблицу notifications
2. Browser push notifications — отдельный канал

### 2.3 Слои системы

UI Layer: src/web/screens/ и src/screens/
Service Layer: src/services/
Data Layer: Supabase PostgreSQL + RLS

### 2.4 Цвета и стиль

Основной акцент: #3D7D82 (teal)
Фон акцента: #EAF4F5
Опасность: #FFF5F5 / #FFCDD2 / #C62828
Ожидание: #FFF8E1 / #FFE082 / #795548
Нейтральный фон: #F4F6F9
Граница: #E9ECEF
Приглушённый текст: #6C757D

---

## 2.5 СИСТЕМА ПЕРЕВОДОВ — ПРАВИЛА

### Принципы
- Язык по умолчанию: английский (en) для всех новых пользователей
- Веб и мобайл хранят язык независимо друг от друга
- Язык НЕ сохраняется в БД — только локально
- Веб: язык хранится в localStorage через AsyncStorage-shim (ключ @app_language)
- Мобайл: язык хранится в AsyncStorage (ключ @app_language)
- При первом запуске → английский, галочка на EN
- После выбора → применяется сразу и сохраняется локально
- При следующем открытии → читается из локального хранилища

### Как использовать переводы в коде
- Всегда использовать t('ключ') из useLanguage() — никакого хардкода текста
- Файл переводов: src/i18n/translations.js (868 ключей, EN/TH/RU синхронизированы)
- При добавлении нового текста → добавить ключ во все три языка одновременно
- Новые ключи — camelCase: например propertyType, bookingDeposit

### Типы объектов — ключи переводов
Использовать t() вместо хардкода. Готовые ключи:
- house → t('house')
- resort → t('resort')
- condo → t('condo')
- resort_house → t('resortHouse')
- condo_apartment → t('condoApartment')

### Известные проблемы (технический долг)
- TD-010: WebPropertyDetailPanel.js — TYPE_COLOR константа захардкожена на русском. Заменить label на t() внутри компонента
- TD-011: ✅ ЗАКРЫТ — язык хранится в users_profile.settings.web_language (веб) и users_profile.settings.app_language (мобайл). Синхронизация при запуске через App.js (2026-04-08). Доделка 2026-04-27 коммит `6d4988e`: добавлен `setLanguage(userData.language)` в `App.js` callback'ах `onLogin`/`onSuccess` — раньше язык подхватывался только в `checkSession` (для уже залогиненных), а после свежего входа/регистрации UI оставался на дефолтном английском.
- TD-012: WebPropertyDetailPanel.js, WebSettingsModal.js — несколько хардкод строк не через t()

---

## 2.6 ЛОГИКА ВКЛАДКИ "БАЗА" (мобайл)

### Режим без фильтра
- Объекты показываются в обычном виде с контейнерами (Резорт, Кондо)
- Кнопки "раскрыть все / свернуть все" — СКРЫТЫ
- Раскрывать объекты можно только вручную по одному

### Режим с активным фильтром (воронка)
- Показываются только объекты прошедшие фильтр — БЕЗ контейнеров
- Резорты и Кондо не показываются как обёртки — только конкретные объекты
- Появляется иконка папки (открытая/закрытая) — раскрыть/свернуть все результаты

### Статус реализации
- Текущее состояние: кнопка "раскрыть все" работает некорректно (не раскрывает дома в резортах и апартаменты)
- Задача: переработать логику согласно правилам выше

---

## 2.7 ФИЛЬТР ОБЪЕКТОВ — УДОБСТВА

В фильтре объектов (FilterBottomSheet на мобайле, аналог на вебе) показывать только эти удобства:
- Бассейн
- Спортзал
- Парковка
- Стиральная машина

Остальные удобства скрыть.

Применяется к: вкладка "База" и вкладка "Календарь бронирований".

В будущем: сделать настраиваемый фильтр — каждый пользователь выбирает свои удобства.

---

## 3. РОЛИ И ТАРИФЫ — ЕДИНСТВЕННАЯ ПРАВДА

### КРИТИЧЕСКИ ВАЖНО: роль не равно тариф. Это два разных понятия.

### 3.1 Тарифные планы → хранятся в users_profile.plan

| Значение | Название | Объекты | Фото | Команда |
|----------|----------|---------|------|---------|
| standard | Стандарт | до 10 | до 10/объект | нет |
| premium | Премиум | до 300 | до 30/объект | создать компанию + агенты |
| korshun | Korshun | безлимит | безлимит | полный доступ |

korshun — приватный тариф разработчика. Назначается вручную.

Менять тариф: UPDATE users_profile SET plan = '...' WHERE id = '...';
Читать тариф: users_profile.plan — и только оно.

### 3.2 Роли в команде → хранятся в company_members.role

| Значение | Кто | Доступ |
|----------|-----|--------|
| admin | Создал аккаунт самостоятельно, владелец компании | Полный |
| agent | Приглашён администратором | Ограниченный |

Роль owner — legacy, мигрирована в admin (migration 20260330000002).
Роль worker — удалена, не существует.

Читать роль: company_members.role — и только оно.

### 3.3 Канонические поля профиля в коде

user.plan        — тариф: 'standard' | 'premium' | 'korshun'
user.teamRole    — роль: 'agent' | 'admin' | null
user.isAgentRole — boolean: true если role='agent'
user.isAdminRole — boolean: true если владелец компании

Использовать isAgentRole / isAdminRole вместо !!teamMembership.

---

## 4. МАТРИЦА ПРАВ ДОСТУПА

### 4.1 Объекты (properties)

| Операция | Admin | Agent |
|----------|-------|-------|
| Видит | Все объекты компании | Только где responsible_agent_id = uid |
| Создать | да | да при can_manage_property |
| Редактировать | да | да при can_manage_property только свои |
| Удалить | да | да при can_manage_property только свои |

LOCK-001 — снят 2026-04-30 (этап 2). Модерация выпилена, статусы pending/rejected больше не используются. Удаление объекта агентом теперь идёт только по двум условиям: `responsible_agent_id = auth.uid()` И `can_manage_property = true`.

CF-001: properties.user_id НЕ является правом доступа после переназначения.
Единственный критерий доступа агента: responsible_agent_id = auth.uid().

### 4.2 Детальные разрешения агента (из company_members.permissions JSONB)

can_manage_property — добавлять, редактировать (включая цены), удалять свои объекты
can_manage_bookings — добавлять, редактировать, удалять свои бронирования

Старые ключи (`can_add_property`, `can_edit_info`, `can_edit_prices`, `can_see_financials`, `can_book`, `can_delete_booking`, `can_manage_clients`) сняты 2026-04-30 (этап 2 — упрощение прав). Физически остаются в JSONB до этапа 3 (cleanup-миграция), но не читаются ни кодом, ни RLS. Финансы своих бронирований и работа со своими контактами теперь всегда доступны агенту без отдельных галочек.

### 4.3 Статусы объекта

Модерация выпилена 2026-04-30 (этап 2). Все объекты сразу `approved` через DB-default. Колонки `properties.property_status` и `properties.rejection_reason` физически остаются до этапа 3 (cleanup-миграция), но не используются ни кодом, ни RLS. Значки «На проверке» / «Отклонён» в UI убраны.

---

## 5. ПРАВИЛА ДЛЯ DEVELOPER

### 5.0 ТЕРМИНОЛОГИЯ — ОБЯЗАТЕЛЬНО

ЗАПРЕЩЕНО использовать слово "agent" для обозначения пользователя системы.

Правила:
- "user" — любой пользователь системы (универсальный термин)
- "agent" — ТОЛЬКО роль в команде (company_members.role = 'agent')
- "admin" — ТОЛЬКО роль владельца компании (company_members.role = 'admin')

Примеры:
- НЕПРАВИЛЬНО: "агент добавил объект", "agent creates booking"
- ПРАВИЛЬНО: "пользователь добавил объект", "user creates booking"
- ПРАВИЛЬНО: "агент (роль) видит только объекты, где он responsible_agent_id"

### 5.1 Жёсткий scope (по умолчанию)

Менять только то что явно перечислено в задаче.

ЗАПРЕЩЕНО без явного разрешения:
- Рефакторинг для красоты
- Массовые переименования
- Правки несвязанных файлов
- Новые npm-зависимости
- Правки маршрутизации / auth / корневых провайдеров
- Расширение миграций / RLS шире задачи
- postgres_changes / polling / window events
- Трогать docs/История работы/

### 5.2 Обязательный цикл работы

Diagnose → Implement → Verify → Document

1. Diagnose — прочитать затрагиваемые файлы перед правкой
2. Implement — минимальное точечное изменение
3. Verify — npm run verify-build
4. Document — обновить профильный документ если задача это подразумевает

### 5.3 Соглашения кода

Экраны: src/screens/ (mobile) или src/web/screens/ (web)
Компоненты: src/components/ или src/web/components/
Сервисы: src/services/
Контекст: src/context/
Переводы: src/i18n/translations.js — всегда три языка: en, th, ru
Именование файлов компонентов: PascalCase
Именование сервисов: camelCase
Ключи переводов: camelCase

### 5.4 Git

Не коммитить и не пушить без явной команды владельца.

---

## 6. КОНФЛИКТ С УСТАВОМ

Если задача противоречит правилам этого документа или зафиксированным ADR:
1. Остановиться
2. Описать конфликт владельцу
3. Не выбирать решение самостоятельно
4. Ждать подтверждения перед любыми изменениями

---

## 7. ТЕХНИЧЕСКИЙ ДОЛГ (приоритизированный)

> **Актуальный прогресс по каждому TD — в `docs/PROGRESS_PLAN.md`** (там единый список со статусами ✅/⏳/⬜). Этот раздел — детальные описания TD; статусы здесь могут быть устаревшими.

### Критический — сделать в первую очередь

TD-001: ✅ Закрыт 2026-05-03. Колонка `users_profile.role` удалена (миграция `20260503000002_drop_users_profile_role.sql`). Триггер `handle_new_user` обновлён (миграция `20260503000001`). Тариф читается строго из `users_profile.plan`. В JS: `roleFeatures.js` → `PLANS` (со значением `KORSHUN: 'korshun'` вместо `ADMIN: 'admin'`), `authService.getUserProfile` отдаёт только `user.plan`, `AccountScreen` и `PropertyEditWizard` обращаются к `user.plan`.

TD-002: ✅ ЗАКРЫТ — company_id добавлен в contacts, RLS настроен, все 137 записей заполнены (проверено 2026-04-08)

TD-003: ✅ ЗАКРЫТ — CONTEXT_FOR_AI.md очищен от устаревших планов (2026-04-08)

TD-015: ✅ ЗАКРЫТ 2026-04-30 — email-confirmation flow: `signUp` возвращает `{ pendingConfirmation: true, email }` если Supabase не выдал session (т.е. в Dashboard включена галочка confirmation). Registration переключает на экран `EmailConfirmationPending` с email-ом юзера. После клика по confirm-ссылке Supabase редиректит на сайт с хешем `type=signup` → App.js в checkSession показывает `EmailConfirmedSuccess` с инструкцией для веба и мобайла. signIn ловит «Email not confirmed» и показывает `t('emailNotConfirmedHint')`. На мобильном recovery-ссылка пока открывается в браузере — нативный deep link это отдельная задача TD-118.

TD-017: DB-триггер handle_new_user() (создаёт profile + workspace + company_member) существует в live-базе, но отсутствует в файлах миграций
Что сделать: создать миграцию supabase/migrations/YYYYMMDD_handle_new_user_trigger.sql с телом функции и триггера

TD-023: DB-функция check_email_exists ссылалась на удалённую таблицу agents вместо users_profile — исправлена в live-базе 2026-04-12, но нет миграции
Что сделать: миграция создана в supabase/migrations/20260412000000_fix_check_email_exists.sql

TD-024: DB-функция deactivate_member существует в live-базе, но отсутствует в файлах миграций
Что сделать: создать миграцию с телом функции

TD-025: DB-триггер trg_auto_set_property_company + функция auto_set_property_company существуют в live-базе, но отсутствуют в миграциях
Что сделать: создать миграцию с телом функции и триггера

TD-027: verify_invitation_secret не имеет rate limiting — 6-значный код перебирается за минуты
Что сделать: добавить счётчик attempts в company_invitations, при >5 попытках автоматически отзывать приглашение

TD-031: ✅ ЗАКРЫТ (коммит `9f4ffec`) — минимум 8 символов плюс проверка по списку 30 самых популярных паролей на клиенте.

TD-032: ✅ ЗАКРЫТ 2026-04-27 (коммит `28bcbd3`) — клиентская защита от brute force на Login: 3 неудачных попытки на email → блокировка кнопки на 60 сек, переживает reload через AsyncStorage. На вебе AsyncStorage работает поверх localStorage. Серверный rate-limit + CAPTCHA — отдельный security TD на потом.

TD-033: ✅ СНЯТ 2026-04-30 — OAuth-кнопки (Google/Facebook) уходят из продукта, настраивать PKCE для функции которая будет удалена нет смысла. Чистка остатков OAuth-кода (signInWithGoogle/Facebook, обработчики, стили, переводы) — отдельным пунктом TD-116.

TD-038: Нет возможности удалить аккаунт — нарушение Apple App Store Guidelines, GDPR, PDPA (Таиланд)
Что сделать: добавить "Удалить аккаунт" в настройки → подтверждение → каскадное удаление через Supabase Edge Function

TD-040: ✅ ЗАКРЫТ архитектурой invitation v2 (коммиты `1ce131d` + `305c5ef` + `d08ae35` + миграции `20260427000000`/`20260427000003`). Dual-membership невозможен: Edge Function `inviteUserByEmail` создаёт auth-юзера сразу, email становится зарезервированным, повторный обычный `signUp` на тот же адрес отклоняется Supabase. Триггер `handle_new_user` при наличии `raw_user_meta_data.invite_token` делает no-op (workspace/admin не создаются). Orphan auth-юзер без `users_profile` не может войти — `signIn` кидает `PROFILE_NOT_FOUND`. Подтверждено живым тестированием.

TD-042: deactivate_member нужно переписать: soft-delete (status='inactive'), подмена email на системный (освобождение), блокировка аккаунта, сохранение ID и истории
Что сделать: переписать DB-функцию deactivate_member — добавить UPDATE company_members SET status='inactive', подменить email в auth.users и users_profile, заблокировать вход. Текущая реализация только делает DELETE + очистку локаций/объектов

TD-050: properties — нет серверной валидации location_id, обязательность только на клиенте
Что сделать: добавить CHECK constraint в БД (location_id IS NOT NULL) или валидацию в триггере auto_set_property_company

TD-058: ✅ СНЯТ 2026-04-30 (этап 2 — упрощение прав, модерация выпилена) — Раздельное сохранение при редактировании агентом не реализовано — сейчас "всё или ничего" вместо "разрешённое напрямую, неразрешённое через черновик"
Что сделать: при сохранении агентом разделять поля по permissions: can_edit_info поля → напрямую если ON, can_edit_prices поля → напрямую если ON, остальное → черновик. Обновить handleWizardSave и WebPropertyEditPanel handleSave

TD-079: bookingRemindersService и commissionRemindersService используют устаревший trigger формат expo-notifications — напоминания о заезде и комиссии не работают на мобильном
Что сделать: заменить формат trigger на { type: SchedulableTriggerInputTypes.DATE, date: triggerDate } в обоих сервисах (аналогично фиксу calendarRemindersService в коммите e35c7a9)

TD-080: Формула расчёта общей стоимости бронирования неправильная — считает цена × ночей / 30
Что сделать: переписать на помесячный расчёт: полные месяцы = аренда × N, неполный месяц = аренда / дней_в_месяце × дней_остатка. На обеих платформах (AddBookingModal + WebBookingEditPanel)

TD-084: RLS политика bookings: company member read даёт агенту доступ ко всем бронированиям компании
Что сделать: убрать или ограничить — агент должен видеть только бронирования объектов где responsible_agent_id = auth.uid()

TD-086: Новое поле booking_agent_id — ответственный за бронирование (аналог responsible_agent_id для объектов)
Что сделать: (1) ALTER TABLE bookings ADD COLUMN booking_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, (2) backfill UPDATE bookings SET booking_agent_id = user_id, (3) обновить RLS: agent read/update/delete own → booking_agent_id вместо user_id, (4) убрать company member read (TD-084), (5) пикер для админа при создании/редактировании, скрыт для агента, (6) UI на обеих платформах

### Средний — при ближайшей возможности

TD-004: Дублирующиеся ключи переводов: ownerCommissionOneTime vs bookingOwnerCommOnce
Что сделать: унифицировать в translations.js

TD-005: ✅ СНЯТ 2026-04-30 (этап 2 — упрощение прав до can_manage_property/can_manage_bookings) — TODO разрешения не применены в UI
Что сделать: реализовать гарды в WebPropertiesScreen, WebPropertyEditPanel, WebBookingsScreen

TD-006: owner_commission_*_is_from поля в properties — legacy флаги
Что сделать: удалить поля из схемы после проверки

TD-013: ✅ ЗАКРЫТ для iOS 2026-04-30 — `PropertyEditWizard.js` строка 1275 уже имеет `<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={40}>`, обёртывающий основной блок визарда. На iOS работает корректно. **Хвост:** для Android может потребоваться `behavior="height"` — проверить при первом тестировании Android-сборки (Android-версия отложена до закрытия iOS).

TD-014: ✅ ЗАКРЫТ 2026-04-30 — полный recovery flow. На Login ссылка «Забыли пароль?» → экран `ForgotPassword.js` (запрос email → `requestPasswordReset` → `supabase.auth.resetPasswordForEmail` с явным `redirectTo: window.location.origin`). После клика по recovery-ссылке Supabase шлёт `PASSWORD_RECOVERY` event → listener в `App.js` переключает на экран `UpdatePassword.js` (два поля + подтверждение → `setNewPassword` через `supabase.auth.updateUser` → `signOut` → возврат на Login). Переводы на en/th/ru. Deep-link для нативного приложения не реализован — юзер на телефоне открывает recovery-ссылку в браузере (отдельный TD при необходимости).

TD-016: ✅ ЗАКРЫТ 2026-05-05 — `src/utils/disposableEmails.js` содержит локальный `Set` из 57 популярных одноразовых доменов (mailinator, tempmail, yopmail, guerrillamail, sharklasers и т.д.) и функцию `isDisposableEmail(email)` (case-insensitive по `lastIndexOf('@')`). В `authService.signUp` проверка вызывается до `supabase.auth.signUp` и кидает `Error('DISPOSABLE_EMAIL')`. `Registration.js` (общий веб+мобайл) catch ловит ошибку и показывает перевод `disposableEmailNotAllowed` (en/th/ru). Без npm-зависимостей. e2e-тест веб 5/5 пройдены (case-insensitive проверен).

TD-018: Хардкод email korshun31@list.ru в authService.signUp() назначает plan='korshun'
Что сделать: удалить хардкод из signUp(), назначать план через Supabase Dashboard (SQL Editor)

TD-020: ✅ Закрыт 2026-05-03. UserContext: расширен initialUser до 20 каноничных полей с дефолтами; updateUser/handleUserUpdate проходят через единый normalizeUser. WebMainScreen больше не держит свой локальный user-стейт — берёт из useUser(). Попутно поправлен баг с языком в AccountScreen (`profile.app_language` → `profile.language`).
Что сделать: расширить handleUserUpdate для прокидывания всех полей из getUserProfile, либо заменить на единый updateUser

TD-021: Принятие приглашения работает только на web (WebInviteAcceptScreen), нет мобильного экрана
Что сделать: создать мобильный экран принятия приглашения или deep link → web

TD-022: ✅ Закрыт 2026-05-03. Мобильный экран `src/screens/TeamScreen.js` (порт `WebTeamSection`) — полный паритет: приглашения через Edge Function, права (2 галочки + локации), увольнение, архив. Подключён в `AccountStack` как `Team`, кнопка «+ Добавить сотрудника» в `CompanyScreen` ведёт туда вместо алерта. См. `docs/PROGRESS_PLAN.md`.

TD-026: ✅ ЗАКРЫТ 2026-04-27 (коммит `2d30d4a`). Старый dormant-flow `EXISTING_USER_CONFIRM/LOGIN` удалён. В `WebInviteAcceptScreen.js` остались два защитных шага `STEPS.SWITCH_ACCOUNT` и `STEPS.RECLICK` для нового сценария: пользователь уже залогинен под другим аккаунтом и кликнул чужую magic-link → ему предлагают `signOut` и нажать ссылку повторно (не путать со старым dormant-flow — это другая логика, новый поток invitation v2).

TD-028: ✅ Объединён с TD-042 (критический)

TD-034: ✅ Закрыт 2026-05-03. Дефолтные settings (language=en, selectedCurrency=USD) перенесены в триггер `handle_new_user` (миграция `20260503000000`). Из `authService.signUp` убран отдельный UPDATE settings.
Что сделать: перенести default settings (language, currency) в триггер, убрать update settings из signUp

TD-041: ✅ Снят 2026-05-03 вместе с TD-116. OAuth удалён, проверять pending-приглашения для несуществующего входа не нужно.

TD-044: Мобильный PropertyEditWizard не проверяет обязательность локации и района при создании (на вебе проверяется)
Что сделать: добавить валидацию в handleSave визарда — проверять location_id и district перед сохранением

TD-048: Веб WebPropertyEditPanel не загружает список собственников для агента (только для админа)
Что сделать: загружать getContacts('owners') для всех ролей, не только isCompanyAdmin

TD-049: Мобильный PropertyEditWizard показывает поле "Ответственный агент" для агента (должно быть скрыто)
Что сделать: показывать поле ответственного только для isAdmin, скрывать для агентов

TD-051: ✅ ЗАКРЫТ 2026-04-27 (коммит `445d9c9`) — `propertiesService.js` ввёл `ALLOWED_CLIENT_FIELDS` (38 полей) и хелпер `pickAllowed()`. `createPropertyFull` и `updateProperty` фильтруют входящие данные через whitelist; `createPropertyFull` поверх жёстко перезаписывает `user_id`, `responsible_agent_id`, `company_id` из сессии. `createProperty` (без Full) принимает фиксированные параметры и так не пропускает лишнее.

TD-052: ✅ СНЯТ 2026-04-30 (этап 2 — модерация выпилена; будет добито в этапе 3 при cleanup-миграции) — Триггер auto_set_property_company содержит мёртвый код — статус 'submitted' не в CHECK constraint
Что сделать: удалить условие с property_status из триггера, оставить только подстановку company_id

TD-053: При удалении объекта фотографии остаются в Supabase Storage
Что сделать: в deleteProperty() перед DELETE загрузить список photos из объекта, вызвать deletePhotoFromStorage() для каждого URL

TD-054: ✅ ЗАКРЫТ 2026-05-02 — миграции `20260502000000` + `20260502000001` (case-insensitive вариант). Partial unique index `properties_company_code_suffix_unique` на `(company_id, UPPER(TRIM(code)), UPPER(COALESCE(TRIM(code_suffix), '')))` с фильтром `WHERE code IS NOT NULL AND TRIM(code) <> ''`. Случай `Test 1` vs `TEST 1` — теперь дубли. Веб и мобайл при сохранении приводят `code`/`code_suffix` к UPPER. Сервис ловит 23505 → бросает Error с `code='DUPLICATE_PROPERTY_CODE'`. UI (WebPropertyEditPanel + PropertyEditWizard) показывает понятный текст через i18n ключ `duplicatePropertyCodeError` красным жирным.

TD-055: ✅ СНЯТ 2026-04-30 (этап 2 — черновики property_drafts выпилены) — Админ не видит визуальное сравнение "было/стало" при просмотре черновика агента
Что сделать: при отображении черновика загрузить текущие данные объекта, сравнить с draft_data, выделить изменённые поля красным цветом, показать старое/новое значение

TD-056: ✅ СНЯТ 2026-04-30 (этап 2 — needsApproval целиком убран из кода вместе с модерацией) — needsApproval логика различается между веб (проверяет только can_edit_info) и мобильным (проверяет can_edit_info + can_edit_prices)
Что сделать: привести к единой логике на обеих платформах согласно PR-EDIT-4

TD-057: ✅ СНЯТ 2026-04-30 (этап 2 — два переключателя сделаны иначе: can_manage_property и can_manage_bookings вместо разделения info/prices) — В UI настройки агента один переключатель "Редактирование объектов" вместо двух отдельных
Что сделать: разделить на "Редактирование информации" (can_edit_info) и "Редактирование цен" (can_edit_prices) в WebTeamSection и мобильном аналоге

TD-059: ✅ СНЯТ 2026-04-30 (этап 2 — статуса rejected больше нет, все объекты сразу approved) — Мобильный PropertyDetailScreen — нет авто-одобрения rejected объекта при редактировании админом
Что сделать: в handleWizardSave добавить: если isAdmin и property_status='rejected' → включить property_status='approved' в updates, отправить уведомление агенту (как на вебе WebPropertyEditPanel строки 644-667)

TD-060: Веб WebPropertyEditPanel — нет каскадного обновления района дочерних объектов при изменении района резорта/кондо
Что сделать: в handleSave добавить вызов updateResortChildrenDistrict(property.id, updates.district) при изменении district на резорте/кондо (как на мобильном PropertyDetailScreen строки 1602-1605)

TD-061: ✅ ЗАКРЫТ 2026-05-02 — новый helper `bookingsService.getBookingsCountForProperty(propertyId)` (HEAD-запрос с `count='exact'`, учитывает дочерние юниты в резорте/кондо). Веб `WebPropertiesScreen.PropertyDetail` — текст модалки удаления меняется на «у объекта N броней, они тоже удалятся» если bookings.length>0. Мобайл `PropertyDetailScreen.handleDeletePress` — async с alert'ом про count перед onDelete/handleDirectDelete. i18n: `deletePropertyWithBookingsText`.

TD-062: Веб — нет сжатия фото при загрузке, файлы загружаются без обработки (мобильный сжимает до 1200px JPEG 0.85)
Что сделать: добавить клиентское сжатие в WebPropertyEditPanel handlePickPhotos — canvas resize до 1200px + toBlob JPEG 0.85 перед загрузкой в Storage

TD-063: ✅ ЗАКРЫТ 2026-05-01 — `WebPropertyEditPanel.handleRemovePhoto` больше не зовёт `deletePhotoFromStorage` мгновенно (крестик только обновляет state). Реальное удаление в `handleSave` через diff `property.photos/photos_thumb` vs `updates.photos/photos_thumb` — паритет с мобильным `PropertyDetailScreen.handleWizardSave`. Закрытие панели без save не теряет фото.

TD-064: ✅ ЗАКРЫТ 2026-05-01 (для properties; контакты — отдельная задача в фазу 9). Миграция `20260501000001_properties_photos_thumb.sql` — колонка `photos_thumb text[] DEFAULT '{}' NOT NULL`. Параллельный массив тех же индексов. На загрузке создаётся два файла `_thumb.jpg` (150px) + оригинал (1200px). Веб — через canvas `resizeImageFile`, мобайл — через новую `storageService.uploadPhotoWithThumb` (использует `expo-image-manipulator`). Списки и превью используют миниатюру с fallback на оригинал. Storage-cleanup в `handleRemovePhoto`, `handlePhotoDelete`, `handleWizardSave`, `propertiesService.deleteProperty` — чистит и thumb-URL. Hint: на samui31 (через `dataUploadService.PROPERTIES_CRM_SELECT`) `photos_thumb` не уезжает — это отдельная задача на потом (фаза 10/9).

TD-065: ✅ ЗАКРЫТ 2026-05-01 — новый компонент `src/web/components/WebPhotoGalleryModal.js`. Чёрный backdrop, кнопки ‹/›, клавиши ←/→/Escape, клик на backdrop закрывает, счётчик «N / M». Подключён в `WebPropertyDetailPanel`, `WebPropertiesScreen.PropertyDetail` (большая галерея на «Базе»), `WebPropertyEditPanel` (с правом удаления).

TD-066: ✅ ЗАКРЫТ 2026-05-01 (вместе с TD-065). Кнопка ↓ открывает меню «Save this photo / Save all (N)» — паритет с мобильной `PhotoGalleryModal`. Скачивание через fetch+blob+`<a download>` (cross-origin Supabase storage). Кнопка корзины 🗑 видна только при `canDelete=true` (только в редакторе), удаление через `window.confirm`.

TD-067: ✅ ЗАКРЫТ 2026-05-02 — новый helper `propertiesService.getPropertiesCountByLocation(locationId)` (HEAD-запрос с `count='exact'`). Веб `WebLocationsModal.handleDelete(id)` и мобайл `AddLocationsModal.handleDelete()` — если count > 0, удаление блокируется с сообщением «нельзя удалить, у локации N объектов». i18n: `deleteLocationBlockedTitle`, `deleteLocationBlockedText`.

TD-068: ✅ ЗАКРЫТ 2026-05-02 — миграции `20260502000000` + `20260502000001` (case-insensitive вариант). Уникальный индекс `locations_company_geo_unique` на `(company_id, UPPER(TRIM(country)), UPPER(TRIM(region)), UPPER(TRIM(city)))`. Сервис `createLocation`/`updateLocation` ловит 23505 → `error.code='DUPLICATE_LOCATION'`. UI показывает `duplicateLocationError` красным жирным. Дополнительно — case-insensitive проверка дубля района при добавлении (`addLocationDistrict` в сервисе делает SELECT ilike до INSERT и бросает `DUPLICATE_DISTRICT`; UI WebPropertyEditPanel + PropertyEditWizard + WebLocationsModal + AddLocationsModal показывают `duplicateDistrictError`). При клике «Сохранить» в формах локаций не-добавленный район из input'а автоматически добавляется в массив (защита от UX-путаницы между «+» и «Сохранить»).

TD-069: Обязательность полей при создании локации — мобильный не проверяет, веб только country
Что сделать: добавить проверку всех трёх полей (country, region, city) на обеих платформах перед сохранением

TD-072: ✅ ЗАКРЫТ ранее — `WebBookingCalendarPicker` принимает `bookedRanges`, строит `occupiedSet`, рисует красные точки на занятых днях, блокирует выбор и проверяет пересечение через `hasOverlapWithOccupied`. На мобильном `AddBookingModal` тот же эффект через `occupiedDates` + `disabledDates` + `hasOverlapWithOccupied`. Реальная логика на обеих платформах работает, статус в плане был устаревший (подтверждено 2026-05-01). Унификация интерфейсов — TD-119.

TD-073: Обе платформы — контакт не обязателен при создании бронирования
Что сделать: добавить валидацию contact_id IS NOT NULL OR not_my_customer = true на клиенте и в БД (CHECK constraint)

TD-074: Веб — фото бронирования загружаются без сжатия
Что сделать: добавить клиентское сжатие (canvas resize до 1200px JPEG 0.85) как на мобильном

TD-075: Веб — нет пикера напоминаний о заезде при создании/редактировании бронирования
Что сделать: добавить пикер reminder_days (1/3/7/30 дней) в WebBookingEditPanel

TD-076: ✅ ЗАКРЫТ 2026-05-01 — на вебе локальные push-уведомления не используются по продуктовому решению владельца. Вместо этого комиссии от собственника отображаются визуально: `WebCalendarStrip` подсвечивает даты комиссий через `getCommissionDateAmounts`, `WebDashboardScreen` показывает их в дневной agenda с подписью «commission_reminder». Юзер видит комиссии когда открывает сайт. На мобильном локальные уведомления через `expo-notifications` сохранены без изменений.

TD-077: ✅ ЗАКРЫТ 2026-05-01 — закрыто тем же продуктовым решением что TD-076. На вебе локальные push не используются → отменять нечего. Отображение комиссий и заездов в `WebCalendarStrip`/`WebDashboardScreen` пересчитывается из текущего состояния броней при каждой загрузке — после редактирования сразу актуально. На мобильном `cancelBookingReminders` + `cancelCommissionReminders` сохранены без изменений.

TD-081: Веб — нет кнопки "Подтверждение бронирования" (PDF)
Что сделать: добавить кнопку в WebBookingsScreen с вызовом generateConfirmationPDF (как на мобильном BookingDetailScreen)

TD-082: ✅ ЗАКРЫТ 2026-05-01 — поле `bookings.monthly_breakdown` (JSONB, массив `[{month, amount}]`), переключатель "Помесячная разбивка" на обеих платформах (`AddBookingModal`, `WebBookingEditPanel`), `buildPaymentPlanRows` строит план оплаты из разбивки при непустом массиве (коммиты `837ca1f`, `8d66c20`).

TD-083: Веб — "Клиент собственника" не скрывает финансовые поля и напоминания
Что сделать: при notMyCustomer=true скрывать секции финансов и напоминаний (как на мобильном — шаги 3-4 пропускаются)

TD-085: Агент видит все данные чужого бронирования на его объекте — должен видеть только "на Компанию"
Что сделать: если booking.user_id != agent.id, скрывать contactId и показывать "Клиент компании" вместо имени

TD-087: ✅ СНЯТ 2026-04-30 (этап 2 — удаление брони включено в общую галочку can_manage_bookings, отдельного переключателя не будет) — Переключатель can_delete_booking отсутствует в UI настроек агента и не проверяется в deleteBooking()
Что сделать: добавить переключатель в WebTeamSection и мобильный аналог, проверять can_delete_booking перед удалением в deleteBooking() и в UI (скрывать кнопку)

TD-088: ✅ СНЯТ 2026-04-30 (этап 2 — can_see_financials выпилен из кода и раздела 4.2; ключ остаётся в JSONB до этапа 3) — Удалить can_see_financials из проекта — агент всегда видит финансы своих бронирований
Что сделать: убрать can_see_financials из CO-PERM-1, из CURSOR_RULES раздел 4.2, из WebBookingEditPanel (canSeeFinancials обёртка), WebPropertiesScreen и других мест. Агент видит все финансовые поля своих бронирований без отдельного permission

TD-089: ✅ ЗАКРЫТ 2026-05-01 — переключатель %/сумма реализован на мобильном (`AddBookingModal` через локальный компонент `PercentMoneyField`) и на вебе (`WebBookingEditPanel`). Подсказка `≈ X ₿` под полем. На странице деталей и в правой панели брони сумма выводится как `«3 000 ₿ (10%)»`. Напоминания о комиссиях и дашборд считают эффективную сумму из процента.

TD-090: Веб — нет браузерных push-уведомлений для напоминаний о заезде и комиссии — 🔁 ОТЛОЖЕНО ДО V2 (после публичного запуска)
Что сделать: реализовать Web Push API / Service Worker для отправки напоминаний через браузер. Та же логика что мобильные локальные уведомления, другой канал доставки. Решено 2026-05-05 не делать сейчас: большая инфраструктура (Service Worker, VAPID-ключи, Edge Function), не блокер релиза. Подробности в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`, V2-002).

TD-092: ✅ ЗАКРЫТ 2026-04-30 — multi-select dropdown «Город» в toolbar `WebBookingsScreen`. State `cityFilters`/`cityOpen`, опции из уникальных `p.city`, фильтрация в `visibleProps`. i18n `filterCity` × 3 языка.

TD-093: ✅ ЗАКРЫТ 2026-04-30 — multi-select dropdown «Тип» в toolbar `WebBookingsScreen` с тремя фиксированными опциями (`house`/`resort`/`condo`). Фильтрация по `effectiveType || type`.

TD-094: ✅ ЗАКРЫТ 2026-04-30 — два числовых TextInput «Min»/«Max» в toolbar `WebBookingsScreen`. Фильтрация по `p.price_monthly` через `Number.isFinite` + ≥/≤. Объекты без цены не проходят активный фильтр (по дизайну). i18n `filterPriceFromPlaceholder`/`filterPriceToPlaceholder` × 3.

TD-095: ✅ ЗАКРЫТ 2026-04-30 — multi-select dropdown «Удобства» в toolbar `WebBookingsScreen` с 4 фиксированными удобствами (`swimming_pool`/`gym`/`parking`/`washing_machine`, синхронизировано с CURSOR_RULES 2.7 и `FilterBottomSheet`). Объект пройдёт фильтр если у него все выбранные удобства === true (`p.amenities[a]` — поле объект, не массив). i18n `filterAmenities` × 3.

TD-099: ✅ ЗАКРЫТ 2026-04-28 (миграция `20260428000001_contacts_agent_read_booking_clients.sql`, коммит `2dafc75`) — добавлена SELECT-политика `contacts: agent reads booking clients`. Агент видит контакт-клиента, если `contacts.id` входит в `bookings.contact_id` где `bookings.booking_agent_id = auth.uid()`. Политика аддитивная (Postgres OR-комбинирует SELECT-политики), существующие правила сохранены.

TD-100: ✅ ЗАКРЫТ 2026-04-30 — мобильный `AddContactModal` сжимает фото-аватар до 1200px по большей стороне, JPEG 0.85, через `expo-image-manipulator`. Веб `WebContactEditPanel` сжимает через canvas (та же функция `resizeImageFile` что у объектов) — закрыто вместе с TD-104. Миниатюры 150px вынесены в TD-064 (требует новую колонку в БД).

TD-102: ✅ СНЯТ 2026-04-30 (этап 2 — can_manage_clients выпилен из кода и раздела 4.2; ключ остаётся в JSONB до этапа 3) — can_manage_clients — удалить из проекта, агент всегда работает со своими контактами
Что сделать: убрать из CO-PERM-1, CURSOR_RULES 4.2, WebBookingEditPanel canManageClients и других мест

TD-103: ✅ ЗАКРЫТ 2026-04-30 — в мобильный `AddContactModal.js` добавлен блок «Документы»: грид превьюшек со сжатием 1200px JPEG 0.85, кнопка добавления через `expo-image-picker`, удаление по крестику. Поле `documents` уходит в payload. Просмотр read-only документов вне формы пока ни на одной платформе не реализован — паритет.

TD-104: ✅ ЗАКРЫТ 2026-04-30 — в `WebContactEditPanel` добавлен круглый аватар-блок (96×96, dashed border) с превью, кнопкой загрузки (отдельный input file) и кнопкой удаления. Файл сжимается через canvas (`resizeImageFile`) до 1200px JPEG 0.85, заливается в bucket `contact-photos/avatars/`. Поле `photoUri` теперь в payload как у мобильного.

TD-105: ✅ ЗАКРЫТ 2026-04-30 — на обеих платформах при удалении контакта-собственника с привязанными объектами показывается предупреждение «У этого собственника N объектов. Если удалить контакт, объекты останутся без собственника. Удалить всё равно?». Подсчёт через `properties.owner_id`/`owner_id_2`. i18n-ключ `deleteOwnerWithPropertiesMessage` × 3 языка.

TD-106: ✅ ЗАКРЫТ 2026-04-30 — на обеих платформах при удалении контакта-клиента с привязанными бронированиями показывается предупреждение «У этого клиента N бронирований. Если удалить контакт, бронирования останутся без клиента. Удалить всё равно?». Подсчёт через `bookings.contact_id`. i18n-ключ `deleteClientWithBookingsMessage` × 3 языка.

TD-108: Веб — нет регистрации/отмены напоминаний для календарных событий (scheduleReminder/cancelReminders не вызываются) — 🔁 ОТЛОЖЕНО ДО V2 (после публичного запуска)
Что сделать: реализовать браузерные push-уведомления для напоминаний о событиях. Регистрация при создании, перерегистрация при редактировании, отмена при удалении. Зависит от Web Push инфраструктуры (V2-002), будет докинуто туда же.

TD-109: ✅ ЗАКРЫТ — RLS `calendar_events` заменена на `user_id = auth.uid()` (миграция `20250326000000`). JS-фильтр сохранён как defense-in-depth.

TD-110: ✅ ЗАКРЫТ — в форме события рядом с полем «Время» добавлено поле «Дата» (веб и мобайл). Заодно починен баг синхронизации точек на полоске после правки.

TD-111: ✅ СНЯТ 2026-04-30 (этап 2 — кнопок одобрения/отклонения больше нет) — Мобильный PropertyNotificationsModal — markActionTaken не вызывается после одобрения/отклонения объекта
Что сделать: после approve/reject вызывать markActionTaken(notificationId) чтобы уведомление помечалось обработанным

TD-112: ✅ СНЯТ 2026-04-30 (этап 2 — кнопки модерации удалены вместе с самой модерацией) — Веб WebNotificationBell — кнопки одобрить/отклонить в панели уведомлений лишние
Что сделать: убрать кнопки модерации из панели уведомлений. Для одобрения/отклонения пользователь переходит к объекту

TD-113: ✅ Закрыт ранее, подтверждён 2026-05-02. Realtime-подписка на `notifications` с фильтром `recipient_id` уже работает в трёх мобильных экранах с бейджем (RealEstateScreen, AgentCalendarScreen, BookingCalendarScreen). Описание задачи устарело.

TD-114: Мобильный StatisticsScreen — значительно меньше данных чем WebDashboardScreen
Что сделать: добавить на мобильный: объекты на проверке, занятость (мои/чужие клиенты), ближайшие заезды, комиссии собственнику, календарь дня. Привести к соответствию с вебом

TD-035: ✅ ЗАКРЫТ 2026-05-03 — `getUserProfile` использует одну RPC `get_full_user_profile(p_user_id UUID)` с SECURITY DEFINER (миграция `20260503000003`); 1 запрос вместо 5.

TD-037: ✅ Закрыт 2026-05-03. `signOut({ scope })` поддерживает scope='global'. На мобильном Alert при выходе расширен до 3 кнопок (Отмена / Только это устройство / Все устройства). На вебе — новая мини-модалка с тем же выбором.
Что сделать: добавить кнопку в настройки аккаунта, вызывающую supabase.auth.signOut({ scope: 'global' })

### Низкий — бэклог

TD-007: properties не имеет updated_at — добавить колонку
TD-008: ✅ СНЯТ 2026-04-30 (этап 2 — модерация выпилена, таблица property_rejection_history будет удалена в этапе 3, backfill не нужен) — Backfill property_rejection_history для legacy объектов
TD-009: ✅ СНЯТ 2026-04-30 (этап 2 — модерация выпилена, роль «старший агент» закрыта в пользу простоты) — Разрешения can_moderate_properties для старшего агента

TD-019: ✅ ЗАКРЫТ 2026-04-30 — в `App.js` стадия `screen === 'preloader'` теперь рендерит `<Preloader />` на обеих платформах. Раньше на вебе при `preloader` показывался `<Login>` (мелькание для залогиненного пользователя при перезагрузке). Сам компонент Preloader уже работал через React Native Web.

TD-029: ✅ ЗАКРЫТ 2026-05-05 — в `companyService.js` хелпер `assertValidCompanyName(name)` (длина 2-80 после `trim`) вызывается в `activateCompany` (на INSERT обязательно, при реактивации с переданными данными — если `name !== undefined`) и в `updateCompany`. UI ловит `Error('COMPANY_NAME_INVALID')` и показывает перевод `companyNameInvalid` (en/th/ru): `WebAccountScreen.saveCompany` → alert; `WebAccountScreen.handleSwitchToCompany` → `startEditCompany()` (открывает форму ввода имени); мобильный `CompanyScreen.handleSwitchToCompany` → открывает `editModalVisible`; `CompanyScreen.onSave` → Alert. БД-уровень CHECK не вводился — триггер `handle_new_user` создаёт строку с `name = ''` как заглушку.

TD-030: Нет аудит-лога действий с командой (приглашения, вступления, деактивации) — 🔁 ОТЛОЖЕНО ДО V2 (после публичного запуска)
Что сделать: создать таблицу team_audit_log с записями действий для compliance. Решено 2026-05-05 не делать сейчас: для одиночного админа пользы мало, актуально когда вырастут команды у клиентов. Подробности в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`).

TD-036: ✅ Снят 2026-05-03 вместе с TD-116. Обе OAuth-функции удалены, дублировать больше нечего.

TD-039: ✅ ЗАКРЫТ 2026-04-30 — в `Login.js` добавлен `loading` state, `handleLogin` ставит `setLoading(true)` перед `signIn` и в `finally` сбрасывает; кнопка `disabled={isLocked || loading}` и текст переключается на `t('saving')` (тот же ключ что в Registration). Повторное нажатие на кнопку во время входа невозможно.

TD-043: properties.resort_id → переименовать в parent_id (78 вхождений в 16 файлах, FK, триггер)
Что сделать: миграция ALTER TABLE + find-replace в JS + обновить триггер. Делать только при наличии тестов

TD-045: Веб: video_url (одна ссылка) → videos (массив как на мобильном)
Что сделать: обновить WebPropertyEditPanel и buildForm для массива видео

TD-046: ✅ Закрыт 2026-05-02. Currency на мобильном сохраняется и отображается корректно: при редактировании берётся валюта самого объекта (а не текущая валюта пользователя), при создании — валюта пользователя; новый юнит в резорте/кондо наследует валюту родителя; при логине `selectedCurrency` из профиля синхронизируется с общим контекстом приложения. См. `docs/PROGRESS_PLAN.md` для деталей.

TD-047: Веб: нет поля address в WebPropertyEditPanel
Что сделать: добавить поле address в buildForm и в UI панели (как на мобильном)

TD-070: ✅ ЗАКРЫТ 2026-04-30 — в `WebPropertyEditPanel` под dropdown'ом района добавлен inline-input «+ Добавить» с кнопкой. Доступно и админу, и агенту. По нажатию: `getLocationDistricts(location_id)` → `setLocationDistricts(location_id, [...current, новый])` → state `districts` обновляется → район автоматически выбирается в форме. i18n-ключи `addNewDistrictPlaceholder` / `addDistrictBtn` × 3 языка.

TD-071: Мобильный PropertyDetailScreen — агент видит строку "Ответственный" в деталях объекта (на вебе скрыта для агента)
Что сделать: обернуть блок responsibleName в условие isAdmin, скрыть для агентов (как на вебе WebPropertiesScreen строка 429: isCompanyAdmin)

TD-078: Мобильный AddBookingModal — время заезда/выезда по умолчанию пустое вместо 14:00/12:00
Что сделать: setCheckInTime('14:00') и setCheckOutTime('12:00') в начальном состоянии при создании нового бронирования

TD-091: ✅ ЗАКРЫТ ранее — коммит `2d30d4a`. В `WebBookingsScreen.js` убран dormant `viewMode` state и условные ветки `viewMode === 'list'`. Подтверждено grep'ом 2026-04-30 — упоминаний нет.

TD-096: ✅ ЗАКРЫТ 2026-04-30 — поиск в `WebBookingsScreen` теперь ищет по коду, имени объекта и именам обоих собственников (`owner_id`, `owner_id_2` через `owners.find`). Поле `district` из поиска убрано — для него отдельный dropdown.

TD-097: ✅ ЗАКРЫТ 2026-04-30 — окно таймлайна расширено с -12/+24 до -36/+36 месяцев. Dropdown «Год» в toolbar показывает все годы окна. `handleYearJump(year)` скроллит `ganttScrollRef.current.scrollLeft = dateToPx('YYYY-01-01', months)`. i18n `filterYear` × 3.

TD-098: ✅ ЗАКРЫТ 2026-05-05 — миграция `20260505000000_contacts_type_check.sql` накатана в sandbox. CHECK `type IN ('clients','owners')`. На prod — в фазе 10 вместе с остальными миграциями.

TD-101: ✅ ЗАКРЫТ 2026-04-27 (миграция `20260427000006_contacts_name_check.sql`, коммит `8842f13`) — добавлен `CHECK (trim(name) <> '')` constraint `contacts_name_not_blank`. JS-формы (`AddContactModal` мобильный, `WebContactEditPanel` веб) уже валидировали `name.trim()`; БД-проверка — defense-in-depth для прямых REST-вызовов.

TD-107: ✅ ЗАКРЫТ 2026-04-29 (коммит `26fdc0d`) — JS-костыль в `WebContactsScreen.load()` удалён. Импорты `getContactsByIds`/`getMyContacts` убраны, агент и админ теперь идут через единый `getContacts()`, RLS базы фильтрует по политикам CT-VIS-2 (после TD-099).

TD-122: ✅ ЗАКРЫТ 2026-05-05 — дедупликация клиентов в форме брони. Миграция `20260505000001_find_or_create_booking_contact.sql` добавляет RPC `find_or_create_booking_contact(p_payload jsonb)` с SECURITY DEFINER. Поиск: company_id текущего юзера + type='clients' + (нормализованный phone (`\D` → '', len ≥ 5) OR LOWER(TRIM(email))). При совпадении — возвращает существующий id и `existed=true`; иначе INSERT (тогда user_id=auth.uid() как создатель). Защита: NOT_AUTHENTICATED, CONTACT_NO_COMPANY, CONTACT_NAME_REQUIRED. JS-обёртка `findOrCreateBookingClient` в `contactsService.js`: транслирует camelCase payload в snake_case, дочитывает контакт через `getContactById`; при `existed=true` и недоступности по RLS возвращает «синтетический» mapped-объект из payload (агенту показываются им же введённые данные, чужие поля не утекают, реальный contact_id привяжется к брони — RLS TD-099 откроет полный контакт после сохранения). Подключено: мобильный `AddBookingModal.handleSaveContact` (Alert), веб `WebBookingEditPanel.handleNewContactSaved` (window.alert) через новый проп `customCreate` в `WebContactEditPanel` (обычный `ContactsScreen` не задаёт проп — обратная совместимость). i18n `clientLinkedExisting` × en/th/ru. Принят trade-off: функция — partial timing oracle (агент через ответы может косвенно проверять, есть ли в компании контакт с phone/email); без этого dedup в multi-tenant среде с RLS невозможен. SQL-тесты 4/4 PASS, статический ревью двух агентов PASS.

---

## 8. СХЕМА БАЗЫ ДАННЫХ (краткая)

users_profile — профиль пользователя
  id = auth.users.id
  plan → тариф: standard / premium / korshun
  role → УСТАРЕВШЕЕ, не использовать

companies — компания (создаётся автоматически при регистрации)
  owner_id → FK users_profile.id

company_members — участники компании
  role → admin / agent
  status → active / inactive
  permissions → JSONB с детальными правами

properties — объекты недвижимости
  user_id → кто создал (НЕ право доступа)
  company_id → компания
  responsible_agent_id → ответственный агент (право доступа для агентов)
  property_status → pending / approved / rejected (СНЯТО 2026-04-30 — модерация выпилена в этапе 2, все объекты сразу approved через DB-default; колонка остаётся до этапа 3 cleanup-миграции)
  rejection_reason → причина отклонения (СНЯТО 2026-04-30 — модерации больше нет; колонка остаётся до этапа 3)

bookings — бронирования
  user_id → пользователь
  company_id → компания
  contact_id → арендатор

contacts — контакты
  type → tenant (арендатор) / owner (собственник)
  ВНИМАНИЕ: нет company_id — см. TD-002

property_rejection_history — история отклонений (append-only)
  Записи никогда не обновляются и не удаляются
  СНЯТО 2026-04-30 — модерация выпилена в этапе 2; таблица остаётся до этапа 3 (cleanup-миграция дропнет её)

Типы объектов:
  Дом — отдельный объект
  Резорт — контейнер для домов в резорте
  Кондо — контейнер для апартаментов

Дочерние объекты наследуют responsible_agent_id от родителя. Ручное изменение заблокировано.

---

## 9. ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ В SQL

Правильно — менять тариф:
UPDATE users_profile SET plan = 'premium' WHERE id = '<uuid>';

Правильно — менять роль в команде:
UPDATE company_members SET role = 'agent' WHERE user_id = '<uuid>' AND company_id = '<uuid>';

НЕПРАВИЛЬНО — менять тариф через role:
Поле `users_profile.role` удалено в миграции `20260503000002`. Тариф — строго `users_profile.plan` ('standard' / 'premium' / 'korshun').

---

Версия: 2.0 | Апрель 2026
Обновлять этот файл при любом изменении архитектуры, ролей, тарифов или структуры БД.
