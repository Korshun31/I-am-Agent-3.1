# Module: Auth & Session

## Скоуп

Модуль покрывает: регистрацию, логин (email + OAuth), восстановление сессии при старте, logout, сборку профиля пользователя,
редактирование профиля, смену пароля, слушатель auth-событий.

**НЕ покрывается этим модулем:**
- Управление командой и приглашения (→ Company & Team)
- Матрица прав доступа RBAC (→ сквозные правила `docs/CROSS_CUTTING_RULES/rbac.md`)
- Управление компанией (→ Company & Team). Но авто-создание workspace при регистрации описано ЗДЕСЬ, потому что это часть signup
flow.

**Файлы модуля:**
- `src/services/authService.js` — ядро: signUp, signIn, signOut, getUserProfile, updateProfile, OAuth, пароли
- `src/screens/Login.js` — экран входа
- `src/screens/Registration.js` — экран регистрации
- `src/context/UserContext.js` — хранилище текущего пользователя в React state
- `App.js` — оркестратор auth flow (preloader → login → main)
- DB trigger `handle_new_user()` на `auth.users` — авто-создание profile + workspace + membership

## Подмодули

| Подмодуль | Префикс | Что делает |
|---|---|---|
| Регистрация | AU-REG | email+пароль → auth user → profile → workspace |
| Логин по email | AU-LOGIN | email+пароль → session → profile |
| OAuth | AU-OAUTH | Google/Facebook → session → profile |
| Восстановление сессии | AU-SESSION | При старте: getSession → profile |
| Восстановление пароля | AU-RESET | Забыл пароль → magic link (планируется) |
| Смена пароля | AU-PASSWORD | Re-auth → new password |
| Сборка профиля | AU-PROFILE | getUserProfile() — собирает из 4+ таблиц |
| Редактирование профиля | AU-EDIT | Обновление users_profile + settings |
| Logout | AU-LOGOUT | signOut → reset → login screen |
| UserContext | AU-CTX | React state текущего пользователя |

## Правила бизнес-логики

### Регистрация (AU-REG)

**AU-REG-1.** Для регистрации требуются: email (обязательно), пароль (обязательно, >= 6 символов), имя (опционально).

**AU-REG-2.** Пароль и подтверждение пароля должны совпадать. Проверка на клиенте до отправки.

**AU-REG-3.** *(планируется — TD-015)* Email должен быть верифицирован до предоставления доступа к основному интерфейсу. После
signUp пользователь должен видеть экран "Проверьте почту" вместо main screen. Вход разрешён только после подтверждения email.

**AU-REG-4.** *(планируется — TD-016)* Регистрация с одноразовых email-адресов (mailinator.com, tempmail.com и т.д.) должна быть
заблокирована на клиенте при отправке формы.

**AU-REG-5.** При регистрации нового пользователя **DB-триггер** `handle_new_user()` автоматически создаёт:
1. Профиль в `users_profile` (id, email, name, role='standard')
2. **Workspace** — запись в таблице `companies` (owner_id = user.id, name = '', status = 'active'). Это невидимый контейнер для всех
 данных пользователя.
3. Запись в `company_members` (company_id, user_id, role = 'admin', status = 'active')

Пользователь не видит workspace в UI. Для него это прозрачно. Workspace становится "видимой компанией" только когда пользователь
заполняет профиль компании (название, логотип и т.д.) через `activateCompany()`.

**AU-REG-5.1.** *(TD-017)* Триггер `handle_new_user()` существует в live-базе, но отсутствует в файлах миграций
(`supabase/migrations/`). Если база будет пересоздана из миграций — триггер пропадёт. Необходимо добавить миграцию.

**AU-REG-5.2.** Клиентский код `signUp()` дублирует шаг 1 (upsert в users_profile). Это не ломает ничего (триггер использует ON
CONFLICT DO NOTHING, signUp использует upsert), но является избыточностью. После добавления миграции для триггера можно будет убрать
 дублирование из signUp().

**AU-REG-6.** Привилегированные тарифы (premium, korshun) **НЕ назначаются** через хардкод в коде. Назначение тарифа производится
через Supabase Dashboard (SQL Editor) или через административный интерфейс.

**AU-REG-6.1.** *(TD-018)* Сейчас в `signUp()` есть хардкод email `korshun31@list.ru`, который назначает `plan: 'korshun'` и `role:
'admin'`. Этот хардкод должен быть удалён. План назначается вручную через SQL после регистрации.

**AU-REG-7.** При регистрации устанавливаются настройки по умолчанию: `language: 'en'`, `selectedCurrency: 'USD'`.

**AU-REG-8.** После успешной регистрации (и верификации email, когда она будет реализована) → вызывается `getUserProfile()` →
результат передаётся в `UserContext.updateUser()` → пользователь попадает на main screen.

**AU-REG-9.** Ошибки регистрации отображаются inline (не Alert) под кнопкой Submit.

### Логин по email/паролю (AU-LOGIN)

**AU-LOGIN-1.** Для входа требуются: email (обязательно), пароль (обязательно).

**AU-LOGIN-2.** При неверных credentials показывается локализованная ошибка `wrongPassword` (inline, не Alert).

**AU-LOGIN-3.** При успешном логине: `signInWithPassword()` → `getUserProfile()` → `updateUser()` → main screen.

**AU-LOGIN-4.** Клавиатурная навигация: Enter на поле email → фокус на пароль. Enter на поле пароль → submit формы.

### OAuth (AU-OAUTH)

**AU-OAUTH-1.** Поддерживаются провайдеры: Google, Facebook. Apple — удалён.

**AU-OAUTH-2.** OAuth кнопки **временно скрыты** в UI до завершения security review. В коде функции `signInWithGoogle()` и
`signInWithFacebook()` существуют и работают.

**AU-OAUTH-3.** Web-flow: стандартный OAuth redirect через Supabase. Mobile-flow: через `expo-auth-session` +
`WebBrowser.openAuthSessionAsync`.

**AU-OAUTH-4.** Google OAuth: всегда показывать выбор аккаунта (`prompt: 'select_account'`).

**AU-OAUTH-5.** При OAuth-авторизации DB-триггер `handle_new_user()` автоматически создаёт profile + workspace + membership (так же
как при email-регистрации).

### Восстановление сессии (AU-SESSION)

**AU-SESSION-1.** При старте приложения вызывается `getCurrentUser()` → `getSession()`. Если сессия валидна → `getUserProfile()` →
main screen. Если нет → login screen.

**AU-SESSION-2.** Во время проверки сессии пользователь должен видеть **Preloader** (splash screen с лого), а не Login. Это касается
 всех платформ, включая web.

**AU-SESSION-2.1.** *(TD-019)* Сейчас на web вместо Preloader показывается Login во время проверки сессии. Это приводит к мельканию
Login для залогиненных пользователей. Решение: показывать Preloader (или минимальный splash — лого + spinner) на web так же как на
mobile.

**AU-SESSION-3.** Auth state listener слушает события `SIGNED_OUT` и `TOKEN_REFRESHED_ERROR`. При получении → `resetUser()` → login
screen.

**AU-SESSION-4.** Если Supabase refresh token истёк → автоматический logout через auth state listener.

### Восстановление пароля (AU-RESET)

**AU-RESET-1.** *(планируется — TD-014)* На экране Login должна быть ссылка "Забыл пароль". По нажатию → экран ввода email →
`supabase.auth.resetPasswordForEmail(email)` → письмо с magic link → пользователь задаёт новый пароль.

### Смена пароля (AU-PASSWORD)

**AU-PASSWORD-1.** Смена пароля доступна только для пользователей с email-провайдером (не OAuth-only). Проверяется через
`canChangePassword()`.

**AU-PASSWORD-2.** Для смены пароля требуется текущий пароль (re-authentication) + новый пароль.

### Сборка профиля (AU-PROFILE)

**AU-PROFILE-1.** `getUserProfile()` — центральная функция, собирает полный user object из 4+ таблиц:
1. `users_profile` — базовые поля
2. `companies` — workspace/company пользователя (если owner)
3. `company_members` — членство в команде (если agent)
4. `agent_location_access` — доступ к локациям (для agents)
5. `companies` повторно — имя компании для member

**AU-PROFILE-2.** Канонические поля user object:

| Поле | Источник | Назначение |
|---|---|---|
| `user.plan` | `users_profile.plan` | Тариф: `'standard'` / `'premium'` / `'korshun'` |
| `user.teamRole` | `company_members.role` | Роль в команде: `'agent'` / `'admin'` / `null` |
| `user.isAgentRole` | derived | `true` если `teamRole === 'agent'` |
| `user.isAdminRole` | derived | `true` если пользователь — владелец компании |
| `user.workAs` | derived | `'company'` если есть active company, иначе `'private'` |
| `user.teamPermissions` | `company_members.permissions` | JSONB с флагами: `can_add_property`, `can_edit_prices` и т.д. |

**AU-PROFILE-3.** Поле `users_profile.role` — **устаревшее, содержит мусор**. НЕ использовать для определения ни роли, ни тарифа.
См. TD-001.

**AU-PROFILE-4.** Для проверки "что может пользователь" использовать `user.isAgentRole` / `user.isAdminRole` и
`user.teamPermissions`. **Никогда** не использовать `!!user.teamMembership` (backward compat, будет удалено).

**AU-PROFILE-5.** Язык определяется платформозависимо: web → `settings.web_language`, mobile → `settings.app_language`. Дефолт:
`'en'`.

**AU-PROFILE-6.** Текущая архитектура поддерживает две роли (`admin`, `agent`). Новые роли можно добавить через
`company_members.role` без изменения схемы БД. Однако проверки ролей сейчас размазаны по UI-коду (`isAgentRole` / `isAdminRole`).
**Планируемое направление**: переход к permission-based access control, где роль определяет набор дефолтных permissions, а все
проверки в коде идут через `user.teamPermissions.*`, а не через `user.isXxxRole`.

### Редактирование профиля (AU-EDIT)

**AU-EDIT-1.** `updateUserProfile()` обновляет `users_profile` + `settings` (JSONB). Settings обновляются через merge (читается
текущее значение, мержится с новым, записывается обратно).

**AU-EDIT-2.** После обновления вызывается `getUserProfile()` для возврата свежего полного объекта.

### Logout (AU-LOGOUT)

**AU-LOGOUT-1.** `signOut()` → `supabase.auth.signOut()` → `resetUser()` (очистка UserContext) → показать Login screen.

**AU-LOGOUT-2.** Logout не очищает локальный кэш приложения (AsyncStorage, expo-image cache и т.д.). При повторном входе данные
загрузятся быстрее.

### UserContext (AU-CTX)

**AU-CTX-1.** UserContext хранит текущего пользователя в React state. Это единственный источник правды о текущем пользователе для
всех UI-компонентов.

**AU-CTX-2.** `updateUser()` — полная перезапись. Используется ТОЛЬКО при login/register/session recovery.

**AU-CTX-3.** `handleUserUpdate()` — частичный merge. Используется при редактировании профиля (name, phone и т.д.).

**AU-CTX-3.1.** *(TD-020)* `handleUserUpdate` не обрабатывает системные поля (`teamRole`, `isAgentRole`, `isAdminRole`, `plan`,
`teamMembership`, `teamPermissions`). Если эти поля изменились на сервере (например, админ изменил права агента), они не попадут в
UserContext через `handleUserUpdate`. Требуется доработка.

**AU-CTX-4.** `resetUser()` — сброс к `initialUser`. Используется при logout и при TOKEN_REFRESHED_ERROR.

## Терминология

| Термин | Что это | Когда создаётся |
|---|---|---|
| **Workspace** | Невидимый контейнер для данных пользователя. Запись в таблице `companies`, но пользователь НЕ видит его как "компанию" в UI | Автоматически при регистрации (DB trigger) |
| **Company** | Видимая компания с названием, логотипом, командой. Тот же workspace, но с заполненным профилем | Когда пользователь решает "работать как компания" и заполняет профиль через `activateCompany()` |

В БД оба хранятся в таблице `companies`. Различие — только в наличии заполненных полей (name, logo_url и т.д.) и в UI-представлении.

## Связь с RBAC

- `getUserProfile()` собирает `teamRole`, `isAgentRole`, `isAdminRole`, `teamPermissions` — эти поля используются всеми модулями для
 проверки прав
- Для деталей проверки прав см. `docs/CROSS_CUTTING_RULES/rbac.md` (будет создан) и `CURSOR_RULES.md` раздел 4

## Связь с другими модулями

| Модуль | Связь |
|---|---|
| **Company & Team** | Триггер signUp создаёт workspace. getUserProfile загружает membership. activateCompany() делает workspace видимым. |
| **Properties, Bookings, Contacts, Calendar Events** | Проверяют `user.isAgentRole` / `user.isAdminRole` и `user.teamPermissions` для фильтрации данных. |
| **AppDataContext** | Получает `user` из UserContext, прокидывает в `AppDataProvider`. |
| **i18n** | getUserProfile определяет язык пользователя, App.js синхронизирует с LanguageContext. |

## Известные пробелы и TD

| TD | Описание | Приоритет |
|---|---|---|
| **TD-001** | `users_profile.role` содержит мусор — удалить поле | Критический |
| **TD-014** | Нет flow "Забыл пароль" | Средний |
| **TD-015** | Нет верификации email при регистрации | Критический |
| **TD-016** | Нет блокировки одноразовых email-адресов | Средний |
| **TD-017** | Триггер `handle_new_user()` не в файлах миграций — может потеряться при пересоздании БД | Критический |
| **TD-018** | Хардкод email `korshun31@list.ru` в signUp() — убрать, назначать план через DB | Средний |
| **TD-019** | Web: Login мелькает вместо Preloader при восстановлении сессии | Низкий |
| **TD-020** | `handleUserUpdate` не обрабатывает системные поля (teamRole, plan и т.д.) | Средний |
