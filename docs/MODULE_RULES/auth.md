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
- DB trigger `handle_new_user()` на `auth.users` — **условное** создание profile + workspace + membership (workspace создаётся только при самостоятельной регистрации; при наличии принятого приглашения — только profile)

## Подмодули

| Подмодуль | Префикс | Что делает |
|---|---|---|
| Регистрация | AU-REG | email+пароль → auth user → profile → workspace (если нет приглашения) |
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

**AU-REG-1.** Для регистрации требуются: email (обязательно), пароль (обязательно, >= 8 символов — см. AU-REG-10; сейчас реализовано >= 6 — TD-031), имя (опционально).

**AU-REG-2.** Пароль и подтверждение пароля должны совпадать. Проверка на клиенте до отправки.

**AU-REG-3.** *(TD-015, закрыт 2026-04-30)* Email верифицируется до доступа к основному интерфейсу. `signUp` возвращает `{ pendingConfirmation: true, email }` если в Supabase Dashboard включена галочка confirmation. Registration переключает на экран `EmailConfirmationPending`. Юзер кликает по ссылке → Supabase редиректит на сайт с хешем `type=signup` → `App.js` показывает `EmailConfirmedSuccess`. signIn возвращает `EMAIL_NOT_CONFIRMED` если юзер пытается войти до подтверждения. Native deep links для мобильного — TD-118.

**AU-REG-4.** *(планируется — TD-016)* Регистрация с одноразовых email-адресов (mailinator.com, tempmail.com и т.д.) должна быть
заблокирована на клиенте при отправке формы.

**AU-REG-5.** При регистрации нового пользователя DB-триггер `handle_new_user()` выполняет **условную** логику:

**Если** для email нового пользователя существует принятое приглашение (`company_invitations` со статусом `accepted`):
- Создаёт **только** `users_profile` (id, email, name, role='standard')
- **НЕ** создаёт workspace (company)
- **НЕ** создаёт запись в `company_members`
- Пользователь получит membership через `join_company_via_invitation` (как agent)

**Если** приглашения нет (обычная самостоятельная регистрация):
- Создаёт `users_profile` (id, email, name, role='standard')
- Создаёт **Workspace** — запись в таблице `companies` (owner_id = user.id, name = '', status = 'active')
- Создаёт запись в `company_members` (company_id, user_id, role = 'admin', status = 'active')

Пользователь не видит workspace в UI. Workspace становится "видимой компанией" только когда пользователь заполняет профиль через
`activateCompany()`.

**AU-REG-5.1.** *(TD-017)* Триггер `handle_new_user()` существует в live-базе, но отсутствует в файлах миграций
(`supabase/migrations/`). Если база будет пересоздана из миграций — триггер пропадёт. Необходимо добавить миграцию.

**AU-REG-5.2.** Клиентский код `signUp()` дублирует шаг 1 (upsert в users_profile). Это не ломает ничего (триггер использует ON
CONFLICT DO NOTHING, signUp использует upsert), но является избыточностью. После добавления миграции для триггера можно будет убрать
 дублирование из signUp().

**AU-REG-6.** Привилегированные тарифы (premium, korshun) **НЕ назначаются** через хардкод в коде. Назначение тарифа производится
через Supabase Dashboard (SQL Editor) или через административный интерфейс.

**AU-REG-6.1.** *(TD-018, закрыт 2026-04-27, коммит `1c1ba40`)* Хардкод email-а в `signUp()` удалён. Тариф `korshun` назначается вручную через Supabase Dashboard (SQL Editor) после регистрации.

**AU-REG-7.** При регистрации устанавливаются настройки по умолчанию: `language: 'en'`, `selectedCurrency: 'USD'`.

**AU-REG-8.** После успешной регистрации (и верификации email, когда она будет реализована) → вызывается `getUserProfile()` →
результат передаётся в `UserContext.updateUser()` → пользователь попадает на main screen.

**AU-REG-9.** Ошибки регистрации отображаются inline (не Alert) под кнопкой Submit.

**AU-REG-12.** *(TD-040)* При нажатии "Создать аккаунт" на экране регистрации, перед выполнением `signUp()`, система проверяет
наличие pending-приглашения для введённого email (`check_pending_invitation`). Если приглашение найдено — показывается модальное
окно:

> "На вашу почту отправлено приглашение от компании «{company_name}». Хотите присоединиться к команде?"
> **[Принять]** — ввод 6-значного секретного кода → завершение регистрации как агент
> **[Отклонить]** — приглашение отменяется, админу отправляется уведомление, пользователь регистрируется как обычный пользователь с
workspace

Форма регистрации НЕ меняется визуально. Модальное окно появляется поверх формы. Все введённые данные (имя, пароли) сохраняются в
полях.

При принятии: максимум 5 попыток ввода кода (TD-027). После превышения — приглашение отзывается, админу уведомление "превышено
количество попыток".

**AU-REG-10.** *(TD-031)* Требования к паролю слишком слабые — только >= 6 символов. Индустриальный стандарт (OWASP/NIST): минимум 8
 символов + проверка по списку самых популярных паролей (top-100: "123456", "password", "qwerty"). Не требовать
спецсимволы/заглавные — это устаревшая практика.

**AU-REG-11.** *(TD-034)* signUp() перезаписывает settings триггера: `update({ settings: { language: 'en', selectedCurrency: 'USD' }
 })` — это полная перезапись, не merge. Если триггер `handle_new_user` в будущем будет устанавливать settings — signUp их затрёт.
Рекомендация: перенести default settings в триггер, убрать из signUp.

### Логин по email/паролю (AU-LOGIN)

**AU-LOGIN-1.** Для входа требуются: email (обязательно), пароль (обязательно).

**AU-LOGIN-2.** При неверных credentials показывается локализованная ошибка `wrongPassword` (inline, не Alert).

**AU-LOGIN-3.** При успешном логине: `signInWithPassword()` → `getUserProfile()` → `updateUser()` → main screen.

**AU-LOGIN-4.** Клавиатурная навигация: Enter на поле email → фокус на пароль. Enter на поле пароль → submit формы.

**AU-LOGIN-5.** *(TD-032, закрыт 2026-04-27, коммит `28bcbd3`)* Клиентская защита от brute force на Login: 3 неудачных попытки на email → блокировка кнопки на 60 секунд. Счётчик и время блокировки хранятся в AsyncStorage по ключу email-а в нижнем регистре, переживают перезагрузку приложения. На вебе AsyncStorage работает поверх localStorage браузера. Серверный rate-limit + CAPTCHA — отдельный security TD на потом.

**AU-LOGIN-6.** *(TD-039, закрыт 2026-04-30)* В `Login.js` добавлен `loading` state. `handleLogin` ставит `setLoading(true)` перед `signIn`, в `finally` сбрасывает. Кнопка `disabled={isLocked || loading}`, текст переключается на `t('saving')`. Повторное нажатие во время входа невозможно. Паритет с `Registration.js`.

### OAuth (AU-OAUTH)

**AU-OAUTH-1.** Поддерживаются провайдеры: Google, Facebook. Apple — удалён.

**AU-OAUTH-2.** OAuth кнопки **временно скрыты** в UI до завершения security review. В коде функции `signInWithGoogle()` и
`signInWithFacebook()` существуют и работают.

**AU-OAUTH-3.** Web-flow: стандартный OAuth redirect через Supabase. Mobile-flow: через `expo-auth-session` +
`WebBrowser.openAuthSessionAsync`.

**AU-OAUTH-4.** Google OAuth: всегда показывать выбор аккаунта (`prompt: 'select_account'`).

**AU-OAUTH-5.** При OAuth-авторизации DB-триггер `handle_new_user()` применяет ту же условную логику, что и при email-регистрации (AU-REG-5): если есть принятое приглашение для email — только profile, иначе — profile + workspace + admin.

**AU-OAUTH-8.** *(TD-041, критический при включении OAuth)* OAuth flow (Google/Facebook) не проходит через экран регистрации и не проверяет pending-приглашения. Если новый пользователь входит через Google с email, на который есть pending-приглашение — он получит workspace, а потом не сможет принять приглашение (блокировка check_email_exists). **Решение**: после первого OAuth-входа нового пользователя (до показа main screen) проверять `check_pending_invitation(email)`. Если найдено — показывать то же модальное окно что и при регистрации: "Компания X вас пригласила. Принять / Отклонить". При принятии — ввод кода → deactivate workspace → join как agent. При отклонении — удалить приглашение → продолжить как обычный пользователь. Пока OAuth кнопки скрыты (AU-OAUTH-2), проблема не проявляется.

**AU-OAUTH-6.** *(TD-033, снят 2026-04-30)* OAuth-кнопки (Google/Facebook) уходят из продукта. Настраивать PKCE для удаляемой функции бессмысленно. Чистка остатков OAuth-кода (signInWithGoogle/Facebook, обработчики, стили, переводы) — TD-116.

**AU-OAUTH-7.** *(TD-036)* `signInWithGoogle` и `signInWithFacebook` — почти идентичные функции (~45 строк каждая), отличаются
только названием провайдера. Рекомендация: объединить в `signInWithOAuthProvider(provider, options)`.

### Восстановление сессии (AU-SESSION)

**AU-SESSION-1.** При старте приложения вызывается `getCurrentUser()` → `getSession()`. Если сессия валидна → `getUserProfile()` →
main screen. Если нет → login screen.

**AU-SESSION-2.** Во время проверки сессии пользователь должен видеть **Preloader** (splash screen с лого), а не Login. Это касается
 всех платформ, включая web.

**AU-SESSION-2.1.** *(TD-019, закрыт 2026-04-30)* В `App.js` стадия `screen === 'preloader'` рендерит `<Preloader />` на обеих платформах. Залогиненный пользователь больше не видит мелькание Login при перезагрузке. Preloader работает на вебе через React Native Web без дополнительных правок.

**AU-SESSION-3.** Auth state listener слушает события `SIGNED_OUT` и `TOKEN_REFRESHED_ERROR`. При получении → `resetUser()` → login
screen.

**AU-SESSION-4.** Если Supabase refresh token истёк → автоматический logout через auth state listener.

### Восстановление пароля (AU-RESET)

**AU-RESET-1.** *(TD-014, закрыт 2026-04-30)* На Login есть ссылка «Забыли пароль?» → экран `ForgotPassword.js` (поле email + `requestPasswordReset` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`). После клика по recovery-ссылке Supabase шлёт событие `PASSWORD_RECOVERY` → listener в `App.js` переключает на `UpdatePassword.js` (два поля + подтверждение → `setNewPassword` → `signOut` → возврат на Login). На мобильном recovery-ссылка открывается в браузере, юзер устанавливает пароль через веб и потом входит в приложение с новым паролем.

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
| `user.teamPermissions` | `company_members.permissions` | JSONB с флагами: `can_manage_property`, `can_manage_bookings` (старые ключи `can_add_property`, `can_edit_info`, `can_edit_prices`, `can_book`, `can_delete_booking`, `can_see_financials`, `can_manage_clients` сняты 2026-04-30 в этапе 2 — упрощение прав) |

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

**AU-PROFILE-7.** *(TD-035)* `getUserProfile()` делает 4-5 последовательных запросов к БД (users_profile, companies,
company_members, agent_location_access, companies повторно). Это замедляет каждый логин и восстановление сессии. Рекомендация:
создать RPC-функцию `get_full_user_profile(p_user_id UUID)` с LEFT JOIN'ами — ускорение в 3-5 раз.

### Редактирование профиля (AU-EDIT)

**AU-EDIT-1.** `updateUserProfile()` обновляет `users_profile` + `settings` (JSONB). Settings обновляются через merge (читается
текущее значение, мержится с новым, записывается обратно).

**AU-EDIT-2.** После обновления вызывается `getUserProfile()` для возврата свежего полного объекта.

### Logout (AU-LOGOUT)

**AU-LOGOUT-1.** `signOut()` → `supabase.auth.signOut()` → `resetUser()` (очистка UserContext) → показать Login screen.

**AU-LOGOUT-2.** Logout не очищает локальный кэш приложения (AsyncStorage, expo-image cache и т.д.). При повторном входе данные
загрузятся быстрее.

**AU-LOGOUT-3.** *(TD-037)* Нет функции "Выйти со всех устройств". Supabase поддерживает `signOut({ scope: 'global' })`.
Рекомендация: добавить кнопку в настройках аккаунта.

### UserContext (AU-CTX)

**AU-CTX-1.** UserContext хранит текущего пользователя в React state. Это единственный источник правды о текущем пользователе для
всех UI-компонентов.

**AU-CTX-2.** `updateUser()` — полная перезапись. Используется ТОЛЬКО при login/register/session recovery.

**AU-CTX-3.** `handleUserUpdate()` — частичный merge. Используется при редактировании профиля (name, phone и т.д.).

**AU-CTX-3.1.** *(TD-020)* `handleUserUpdate` не обрабатывает системные поля (`teamRole`, `isAgentRole`, `isAdminRole`, `plan`,
`teamMembership`, `teamPermissions`). Если эти поля изменились на сервере (например, админ изменил права агента), они не попадут в
UserContext через `handleUserUpdate`. Требуется доработка.

**AU-CTX-4.** `resetUser()` — сброс к `initialUser`. Используется при logout и при TOKEN_REFRESHED_ERROR.

### Удаление аккаунта (AU-DELETE)

**AU-DELETE-1.** *(TD-038, критический)* Пользователь не может удалить свой аккаунт. Это нарушает: Apple App Store Review Guidelines
 (обязательное требование для публикации), GDPR (Европа), PDPA (Таиланд — целевой рынок). Необходимо добавить кнопку "Удалить
аккаунт" → подтверждение → каскадное удаление данных. Реализация: через Supabase Edge Function или admin API
(`supabase.auth.admin.deleteUser()`).

**AU-DELETE-2.** При деактивации агента (инициируется админом через Company & Team, CO-DEACT-MEMBER-1) email пользователя подменяется на системный и аккаунт блокируется. Это НЕ удаление аккаунта — ID и история сохраняются. Для полного удаления (по запросу пользователя, GDPR/PDPA) см. AU-DELETE-1 (TD-038).

## Терминология

| Термин | Что это | Когда создаётся |
|---|---|---|
| **Workspace** | Невидимый контейнер для данных пользователя. Запись в таблице `companies`, но пользователь НЕ видит его как "компанию" в UI | Автоматически при **самостоятельной** регистрации (DB trigger). При регистрации по приглашению — не создаётся |
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
| **TD-014** | ✅ ЗАКРЫТ 2026-04-30 — полный recovery flow: ForgotPassword + UpdatePassword + listener PASSWORD_RECOVERY | Закрыт |
| **TD-015** | ✅ ЗАКРЫТ 2026-04-30 — экраны EmailConfirmationPending + EmailConfirmedSuccess, обработка в signUp/signIn | Закрыт |
| **TD-016** | Нет блокировки одноразовых email-адресов | Средний |
| **TD-017** | Триггер `handle_new_user()` не в файлах миграций — может потеряться при пересоздании БД | Критический |
| **TD-018** | ✅ ЗАКРЫТ 2026-04-27 — хардкод email удалён, тариф назначается через SQL Editor | Закрыт |
| **TD-019** | ✅ ЗАКРЫТ 2026-04-30 — `App.js` рендерит `<Preloader />` на стадии preloader для обеих платформ | Закрыт |
| **TD-020** | `handleUserUpdate` не обрабатывает системные поля (teamRole, plan и т.д.) | Средний |
| **TD-031** | Слабые требования к паролю (6 символов, нет проверки популярных) | Критический |
| **TD-032** | ✅ ЗАКРЫТ 2026-04-27 — клиентская защита: 3 попытки на email → 60 сек блок, переживает reload | Закрыт |
| **TD-033** | ✅ СНЯТ 2026-04-30 — OAuth-кнопки уходят из продукта; чистка остатков кода — TD-116 | Снят |
| **TD-034** | signUp перезаписывает settings триггера (не merge) | Средний |
| **TD-035** | getUserProfile — 5 последовательных запросов вместо 1 RPC | Средний |
| **TD-036** | signInWithGoogle/Facebook — дублирование кода (~90 строк) | Низкий |
| **TD-037** | Нет "Выйти со всех устройств" | Средний |
| **TD-038** | Нет удаления аккаунта (требование App Store, GDPR, PDPA) | Критический |
| **TD-039** | ✅ ЗАКРЫТ 2026-04-30 — Login.js: loading state + disabled + текст «Сохранение…» во время входа | Закрыт |
| **TD-040** | Экран регистрации не проверяет pending-приглашения — нужна проверка + модальное окно выбора + уведомления админу | Критический |
| **TD-041** | OAuth flow не проверяет pending-приглашения — новый пользователь через Google/Facebook получит workspace, даже если на его email есть приглашение. Нужна проверка после первого OAuth-входа + модальное окно выбора. Не критично пока OAuth скрыт. | Средний |
