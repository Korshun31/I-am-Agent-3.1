# Module: Company & Team

## Скоуп

Модуль покрывает: переключение private/company (активация/деактивация workspace), управление профилем компании, приглашения в
команду, принятие приглашений, управление правами участников, деактивация участников, получение списка команды.

**НЕ покрывается:**
- Авто-создание workspace при регистрации (→ Auth & Session, AU-REG-5)
- Проверки прав в UI экранов (→ сквозные правила RBAC)
- Привязка объектов к компании (→ Properties, trigger `auto_set_property_company`)

**Файлы модуля:**
- `src/services/companyService.js` — вся бизнес-логика
- `src/web/components/WebTeamSection.js` — управление командой (web)
- `src/web/screens/WebInviteAcceptScreen.js` — принятие приглашения (web only)
- `src/components/MyDetailsEditModal.js` — переключение private/company (mobile)
- `src/web/screens/WebAccountScreen.js` — переключение + управление компанией (web)

**DB-функции (Supabase RPC):**
- `join_company_via_invitation` — вступление в команду ✅ в миграциях
- `get_invitation_by_token` — загрузка приглашения по токену ✅ в миграциях
- `verify_invitation_secret` — проверка 6-значного кода ✅ в миграциях
- `generate_secret_code` — генерация 6-значного кода ✅ в миграциях
- `get_company_team` — список участников с profile data ✅ в миграциях
- `check_email_exists` — проверка наличия email в системе ❌ НЕ в миграциях (TD-023)
- `deactivate_member` — деактивация агента (3 действия атомарно) ❌ НЕ в миграциях (TD-024)

**DB-триггеры:**
- `trg_auto_set_property_company` → `auto_set_property_company()` — на таблице `properties`, автоматически подставляет company_id ❌
 НЕ в миграциях (TD-025, относится к Properties)

## Терминология

| Термин | Что это |
|---|---|
| **Workspace** | Невидимый контейнер данных пользователя. Запись в `companies` с пустым name, создаётся автоматически при регистрации (trigger `handle_new_user`). Пользователь не видит в UI. |
| **Company** | Тот же workspace, но с заполненным профилем (название, лого, контакты) + возможность приглашать команду. Требует план premium/korshun. |

## Подмодули

| Подмодуль | Префикс | Что делает |
|---|---|---|
| Активация компании | CO-ACT | Переключение private → company |
| Деактивация компании | CO-DEACT | Переключение company → private |
| Обновление данных | CO-UPD | Редактирование профиля компании |
| Приглашение участника | CO-INV | Генерация invite link + secret code |
| Принятие приглашения | CO-JOIN | Ввод кода → регистрация → join |
| Управление правами | CO-PERM | Настройка permissions агента |
| Деактивация участника | CO-DEACT-MEMBER | Удаление агента из команды |
| Получение команды | CO-TEAM | Загрузка списка участников |

## Правила бизнес-логики

### Активация компании (CO-ACT)

**CO-ACT-1.** Переключение из "private" в "company" доступно **только** пользователям с планом `premium` или `korshun`. Для
`standard` — показывается alert с предложением обновить тариф.

**CO-ACT-2.** При активации: если workspace уже существует (создан триггером при регистрации) — обновляются его поля (name, phone,
logo_url и т.д.), status ставится 'active'. Если не существует (legacy аккаунт) — создаётся новый.

**CO-ACT-3.** При активации гарантируется что владелец есть в `company_members` с `role = 'admin'` (upsert).

**CO-ACT-4.** Данные компании: name (обязательно), phone, email, logo_url, telegram, whatsapp, instagram, working_hours — все кроме
name опциональные.

**CO-ACT-5.** *(TD-029)* Нет валидации имени компании — можно создать с пустым именем или спецсимволами. Рекомендуется:
`name.trim()` обязательно не пустое, длина 2-100 символов.

### Деактивация компании (CO-DEACT)

**CO-DEACT-1.** Деактивация **запрещена** если в команде есть активные агенты. Выбрасывает `HAS_ACTIVE_MEMBERS`. Сначала —
деактивировать всех агентов.

**CO-DEACT-2.** При деактивации: отзываются все неотвеченные приглашения (status → 'revoked'), компания ставится в status =
'inactive'. **Данные не удаляются** — можно реактивировать.

**CO-DEACT-3.** После деактивации `user.workAs` становится `'private'`, `user.companyId` → `null` (пересборка через getUserProfile).

### Обновление данных компании (CO-UPD)

**CO-UPD-1.** `updateCompany()` обновляет поля компании + ставит `updated_at = now()`.

**CO-UPD-2.** Обновление доступно только владельцу (owner_id = auth.uid(), RLS).

### Приглашение участника (CO-INV)

**CO-INV-1.** Перед созданием приглашения проверяется `check_email_exists`. Если аккаунт с таким email уже есть → `EMAIL_EXISTS` →
приглашение не создаётся.

**CO-INV-2.** При создании генерируется: `invite_token` (UUID v4, криптографически безопасный, для ссылки) + `secret_code`
(6-значный цифровой, для верификации). Оба передаются владельцу для передачи агенту.

**CO-INV-3.** Ссылка приглашения: `https://i-am-agent-3-1.vercel.app/?token={invite_token}`.

**CO-INV-4.** Приглашение действительно **7 дней** (`expires_at = now() + INTERVAL '7 days'`).

**CO-INV-5.** Статусы приглашения: `sent` → `accepted` (после ввода кода) → `company_members` запись создаётся при
`join_company_via_invitation`. Или `sent` → `revoked` (отозвано владельцем).

**CO-INV-6.** *(TD-027)* `verify_invitation_secret` должна ограничивать количество попыток ввода кода — максимум 5. После превышения
 — приглашение автоматически отзывается (status → 'revoked'). Сейчас rate limiting отсутствует — 6-значный код (1 000 000
комбинаций) перебирается за минуты.

**CO-INV-7.** *(рекомендация)* Рассмотреть сокращение срока жизни приглашения с 7 дней до 48 часов для повышения безопасности.

### Принятие приглашения (CO-JOIN)

**CO-JOIN-1.** Принятие работает **только через web** (`WebInviteAcceptScreen`). На мобильном экрана принятия нет. *(TD-021)*

**CO-JOIN-2.** Flow принятия:
1. Пользователь открывает ссылку → `get_invitation_by_token(token)` — загрузка данных
2. Вводит 6-значный код → `verify_invitation_secret(token, code)` — проверка + status → 'accepted'
3. Проверяется `check_email_exists(invitation.email)` — если аккаунт уже есть → **блокировка** (см. CO-JOIN-5)
4. Если аккаунта нет → форма регистрации (name, password) → `signUp()` → `joinCompanyViaInvitation()`
5. `join_company_via_invitation` (DB function) → INSERT в `company_members` (role = 'agent', status = 'active')

**CO-JOIN-3.** При join'е пользователь **всегда** получает роль `agent`. Нельзя присоединиться как admin.

**CO-JOIN-4.** Если пользователь уже в `company_members` — ON CONFLICT обновляет role и status (реактивация).

**CO-JOIN-5.** Один email = один аккаунт. Если email уже зарегистрирован в системе — подключение к чужой компании **невозможно**.
Проверка выполняется:
- При **создании** приглашения (`createInvitation` → `check_email_exists` → `EMAIL_EXISTS`)
- При **принятии** приглашения (на случай регистрации между отправкой и принятием)

При обнаружении существующего аккаунта показывается сообщение: "Данный email уже зарегистрирован в системе I am Agent и не может
быть подключён к другой компании. Для подключения необходимо удалить существующий аккаунт или использовать другой email." Join не
выполняется.

**CO-JOIN-5.1.** *(TD-026)* Flow логина существующего пользователя в `WebInviteAcceptScreen` (шаги EXISTING_USER_CONFIRM /
EXISTING_USER_LOGIN / handleLogin / handleExistingConfirm) подлежит удалению и замене на сообщение-блокировку согласно CO-JOIN-5.

**CO-JOIN-6.** Архитектурное ограничение: пользователь не может одновременно быть владельцем workspace и агентом в чужой команде.
Один email = одна роль.

### Управление правами (CO-PERM)

**CO-PERM-1.** Права хранятся в `company_members.permissions` (JSONB):

| Флаг | Назначение |
|---|---|
| `can_add_property` | Добавлять объекты |
| `can_edit_info` | Редактировать основные поля объектов |
| `can_edit_prices` | Редактировать цены |
| `can_see_financials` | Видеть комиссии и финансы |
| `can_book` | Создавать бронирования |
| `can_delete_booking` | Удалять бронирования |
| `can_manage_clients` | Управлять контактами |

**CO-PERM-2.** Права управляются только владельцем (admin) через `updateMemberPermissions()`.

**CO-PERM-3.** По умолчанию при join все permissions не установлены (пустой JSONB). Владелец настраивает после добавления.

**CO-PERM-3.1.** *(TD-005, ранее зафиксирован)* Permissions определены, но не полностью enforced в UI.

### Деактивация участника (CO-DEACT-MEMBER)

**CO-DEACT-MEMBER-1.** `deactivate_member` (DB function) выполняет три действия атомарно:
1. Удаляет запись из `company_members`
2. Удаляет доступ к локациям (`agent_location_access`)
3. Снимает `responsible_agent_id` с объектов компании (→ NULL)

**CO-DEACT-MEMBER-2.** Деактивируется только role='agent'. Admin (владелец) не может быть деактивирован.

**CO-DEACT-MEMBER-3.** `auth.users` запись не удаляется. Пользователь остаётся в системе.

**CO-DEACT-MEMBER-4.** *(TD-028)* `deactivate_member` использует DELETE вместо soft-delete. Рекомендуется заменить на `UPDATE status
 = 'inactive'` — колонка `status` в `company_members` уже существует. Это сохранит историю членства и позволит быстро восстановить
агента.

### Получение команды (CO-TEAM)

**CO-TEAM-1.** `get_company_team` (DB function, RPC) — возвращает участников с profile data (name, email, photo).

**CO-TEAM-2.** `getTeamData()` — загружает участников + активные приглашения одним вызовом.

## Рекомендации по безопасности

**CO-SEC-1.** Email verification (TD-015 из Auth) критична для безопасности приглашений — без неё возможна регистрация с чужим email
 и принятие чужого приглашения.

**CO-SEC-2.** Все DB-функции работы с приглашениями используют `SECURITY DEFINER` — это правильно и необходимо для обхода RLS.

**CO-SEC-3.** *(TD-030)* Нет аудит-лога действий с командой (приглашения, вступления, деактивации). На текущем этапе не критично, но
 необходимо при масштабировании — для разрешения споров и compliance.

## Связь с RBAC

- Роли (`admin` / `agent`) определяются через `company_members.role`
- Детальные permissions — через `company_members.permissions` (JSONB)
- Планируемое направление (из Auth AU-PROFILE-6): переход к permission-based access control, где все проверки идут через
`teamPermissions.*`, а не через `isXxxRole`
- Для полной матрицы прав см. `CURSOR_RULES.md` раздел 4

## Связь с другими модулями

| Модуль | Связь |
|---|---|
| **Auth & Session** | Триггер `handle_new_user` создаёт workspace. `getUserProfile` собирает membership. `signUp`/`signIn` используются в invite flow. |
| **Properties** | `responsible_agent_id` привязывает объект к агенту. При деактивации — сбрасывается. `auto_set_property_company` (trigger) привязывает property к company. `getActiveTeamMembers()` используется для выбора ответственного в PropertyEditWizard. |
| **Bookings** | Видимость броней зависит от membership и `company_id`. |
| **Contacts** | Видимость контактов зависит от `can_manage_clients` permission. |
| **i18n** | Все UI-тексты приглашений и управления командой локализованы (en/th/ru). |

## Известные пробелы и TD

| TD | Описание | Приоритет |
|---|---|---|
| **TD-005** | Permissions не полностью enforced в UI (ранее зафиксирован) | Средний |
| **TD-021** | Принятие приглашения только на web, нет мобильного экрана | Средний |
| **TD-022** | Нет мобильного UI для управления командой | Средний |
| **TD-023** | `check_email_exists` не в миграциях (исправлена в live-базе 2026-04-12) | Критический |
| **TD-024** | `deactivate_member` не в миграциях | Критический |
| **TD-025** | `auto_set_property_company` trigger + function не в миграциях | Критический |
| **TD-026** | Удалить dormant flow логина существующего пользователя из WebInviteAcceptScreen, заменить на блокировку | Средний |
| **TD-027** | Нет rate limiting на verify_invitation_secret — код перебирается | Критический |
| **TD-028** | deactivate_member делает DELETE вместо soft-delete (UPDATE status) | Средний |
| **TD-029** | Нет валидации имени компании (пустое имя, спецсимволы, длина) | Низкий |
| **TD-030** | Нет аудит-лога действий с командой | Низкий |
