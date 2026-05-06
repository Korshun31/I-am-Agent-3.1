# Progress Plan — приведение проекта в порядок

> Единая «доска задач» для ветки `dev`. Только статусы и ссылки на детальные описания.
> - Описание каждого `TD-XXX` — в `CURSOR_RULES.md` раздел 7.
> - Описание каждого `P1/P2/P3` — в `docs/Устав компании/09_Бэклог_идей_и_TODO.md`.
> - При закрытии: ставим ✅ и кратко указываем дату/коммит. Не удаляем — для истории.
>
> **Легенда:**
> - ✅ закрыто
> - ⏳ в работе / частично
> - ⬜ не начато
> - 🔁 заблокировано / зависит от другого пункта
>
> Последнее обновление: 2026-05-05 (закрыты все блокирующие TD: фаза 8 «mobile паритет» + TD-115 baseline-схема; в backlog v2 перенесены TD-030/090/108/118 — все требуют доп. инфраструктуры или редко всплывающих сценариев; перед публичным релизом остался только финальный накат)

---

## Порядок работы (roadmap по фазам)

> Согласован 2026-04-27 после анализа зависимостей и логических блоков.
> Принципы: внутри каждой фазы сначала «дешёвые победы» (3-5 строк, без рисков), затем средние, в конце крупные. Зависимости (TD-099→TD-107, TD-065→TD-066) учтены внутри фазы.
> Прикидка по времени: ~31-43 рабочих дня = 6-9 недель.

### Фаза 1 — Безопасность и утечки данных (2-3 дня)
TD-018 (хардкод email), TD-085 (агент видит чужое бронирование), TD-032 (brute-force Login), TD-051 (whitelist в createPropertyFull), TD-101 (CHECK trim(name)). TD-033 снят 2026-04-30 (OAuth уходит из продукта).
Зачем первой: уязвимости и утечки данных нельзя нести в prod. TD-018 — 2 строки удалить, мгновенный win.

### Фаза 2 — Контакты + RLS-фундамент (3-4 дня)
TD-099 (RLS contacts по booking_agent_id) → TD-107 (убрать JS-костыль), TD-105 (предупреждение при удалении owner), TD-106 (предупреждение при удалении client), TD-103 (mobile документы), TD-104 (web фото контакта), TD-100 (сжатие фото).
Зачем: TD-086 (booking_agent_id) уже закрыт — TD-099 разблокирован. Все «Контакты» одной волной — два файла.

### Фаза 3 — Критичные UX-баги (1-2 дня)
TD-019 (Web Login мелькает), TD-039 (нет спиннера на Login), TD-013 (KeyboardAvoidingView в Wizard), TD-014 (забыл пароль), TD-015 (email confirmation экран), TD-070 (агент не может добавить район).
Зачем: «дешёвые победы» по UX, видны клиенту в первый день.

### Фаза 4 — Веб фильтры и поиск бронирований (2-3 дня)
TD-091 (удалить dormant viewMode код) → TD-092 (фильтр город), TD-093 (тип), TD-094 (цена), TD-095 (удобства), TD-096 (поиск по полям), TD-097 (пикер года Gantt).
Зачем вместе: все правят `WebBookingsScreen.js` — открыл один файл, добавил все фильтры, избежал N конфликтов merge.

### Фаза 5 — Веб бронирования паритет с mobile (4-5 дней)
TD-072 (занятые даты в picker), TD-074 (сжатие фото), TD-076 (commission reminders), TD-077 (отмена reminders), TD-082 (monthly_breakdown), TD-089 (mobile %/сумма переключатель). _(TD-087 снят в этапе 2 simple-perms.)_
Зачем после фильтров: тот же модуль bookings, но другая логика (reminders, расчёты, PDF).

### Фаза 6 — Фото-галерея (3-4 дня) — ЗАКРЫТА 2026-05-01
TD-064 (миниатюры 150px), TD-065 (полноэкранная галерея web) → TD-066 (кнопки save/delete в галерее), TD-063 (delete из storage при edit). ✅ Все четыре закрыты 2026-05-01. Один новый компонент `WebPhotoGalleryModal` + новая утилита `uploadPhotoWithThumb` + миграция `20260501000001_properties_photos_thumb.sql`.

### Фаза 7 — Шаблон «предупреждения при удалении» (1 день) — ЗАКРЫТА 2026-05-02
TD-061 (объект с бронированиями), TD-067 (локация с объектами), TD-068 (UNIQUE на city), TD-054 (UNIQUE на code). ✅ Все четыре закрыты 2026-05-02. Миграция `20260502000000_properties_locations_uniques.sql` (partial unique index по `(company_id, code, code_suffix)` + UNIQUE по `(company_id, country, region, city)`). Новые helper'ы `getBookingsCountForProperty` / `getPropertiesCountByLocation` + правки в UI на обеих платформах.

### Фаза 8 — Mobile паритет (5-7 дней)
TD-022 (mobile UI «Команда»), TD-021 (mobile invite accept экран), TD-114 (StatisticsScreen parity), TD-046 (currency на объекте), TD-113 (realtime бейдж), TD-041 (OAuth pending invitations). _(TD-059, TD-111 сняты в этапе 2 simple-perms.)_
Зачем после web: mobile фичи — крупные новые экраны, дороже web-патчей.

### Фаза 9 — Технический долг кода (закрыта 2026-05-05)
Все запланированные TD (TD-020, TD-035, TD-043, TD-001, TD-034, TD-036, TD-037, TD-045, TD-047, TD-060, TD-004, TD-010, TD-012, TD-115) закрыты параллельно с другими фазами в апреле-мае. TD-030 (аудит-лог действий с командой) перенесён в backlog v2 — для одиночного админа пользы мало, вернёмся после публичного запуска.

### Фаза 10 — Финальный релиз + P-идеи (3-5 дней)
**Финальный релиз** (10 шагов): мерж dev→main + миграция prod + дроп legacy + домен `crm.iamagent.app` на prod-окружение Vercel + TestFlight-сборка + чистка sandbox.
**Открытые P-идеи** (по желанию, не блокеры): P1-004 (downgrade тарифа), P1-005 (чистка термина «agent»), P2-001/P2-002/P2-004, P3-004 (фильтр по статусу).
**В backlog v2** (после публичного запуска): TD-030 (аудит-лог команды → V2-001), TD-090/P3-003 + TD-108 (Web Push → V2-002), TD-118 (native deep links → V2-003).
_(P1-001/TD-009, P1-002, P3-001, P3-002 сняты в этапе 2 simple-perms — модерации больше нет; TD-110 закрыт.)_

---

## Auth & Session

- ✅ TD-001 — мусорная колонка `users_profile.role` удалена (2026-05-03). Две миграции: `20260503000001_handle_new_user_drop_role.sql` (триггер перестал писать в role) + `20260503000002_drop_users_profile_role.sql` (DROP COLUMN). Sandbox-проверка перед дропом: 20 пользователей, у всех `plan` валиден, CHECK/RLS на role нет. JS-правки: `roleFeatures.js` переименован `ROLES` → `PLANS` (`KORSHUN: 'korshun'` вместо `ADMIN: 'admin'`); `authService.getUserProfile` читает только `data.plan` и больше не отдаёт legacy-поле `role`; `AccountScreen.isAdmin` теперь `plan === PLANS.KORSHUN`; `PropertyEditWizard` зовёт `getPhotoLimitForProperty(u?.plan || 'standard')`. Документация обновлена: убраны раздел 3.3 в CURSOR_RULES, антипример SELECT/UPDATE role, AU-PROFILE-3 в auth.md, упоминания «role='standard'» в описании триггера.
- ✅ TD-014 — полный recovery flow: ссылка на Login → ForgotPassword (`resetPasswordForEmail` с `redirectTo`) → email → клик → listener `PASSWORD_RECOVERY` в App.js → UpdatePassword (`setNewPassword`) → выход и возврат на Login (2026-04-30). Deep-link в нативное приложение — отдельный TD при необходимости.
- ✅ TD-015 — email confirmation flow (2026-04-30): signUp возвращает pendingConfirmation если Supabase не выдал session → Registration переключает на экран `EmailConfirmationPending`. После клика по confirm-ссылке Supabase редиректит на сайт с хешем `type=signup` → App.js показывает `EmailConfirmedSuccess`. signIn ловит ошибку «Email not confirmed» и показывает понятный текст. Native deep link для мобильного — TD-118.
- ✅ TD-016 — блокировка одноразовых email-сервисов на регистрации (2026-05-05, `src/utils/disposableEmails.js` 57 доменов + `authService.signUp` бросает `DISPOSABLE_EMAIL`, `Registration.js` показывает перевод `disposableEmailNotAllowed` × 3 языка; e2e-тест веб 5/5)
- ✅ TD-017 — миграция `handle_new_user` (миграции `20260415000001`, `20260427000003`)
- ✅ TD-018 — хардкод `korshun31@list.ru` удалён из `signUp()` и `WebInviteAcceptScreen` (2026-04-27, коммит `1c1ba40`)
- ✅ TD-019 — Web Login мелькание устранено: `App.js` рендерит `<Preloader />` на стадии `preloader` для обеих платформ (2026-04-30).
- ✅ TD-031 — пароль 8 символов + common passwords (коммит `9f4ffec`)
- ✅ TD-032 — клиентская защита от brute-force на Login: 3 попытки → блокировка кнопки на 60 сек, переживает reload (AsyncStorage). Серверный rate-limit + CAPTCHA — отдельный security TD на потом (2026-04-27, коммит `28bcbd3`)
- ✅ TD-033 — снят 2026-04-30: OAuth-кнопки уходят из продукта, PKCE настраивать для удаляемой функции бессмысленно. Чистка остатков OAuth-кода — TD-116.
- ✅ TD-034 — settings перенесены в триггер `handle_new_user` (миграция `20260503000000_handle_new_user_default_settings.sql`, 2026-05-03). Триггер сразу INSERT'ит `users_profile` с `settings = {language:'en', selectedCurrency:'USD'}`. Из `authService.signUp` убран отдельный UPDATE settings — остался только UPDATE name (триггер ставит name=email как fallback). Минус один лишний запрос при регистрации, логика собрана в одном месте. Проверено в sandbox — settings в БД сразу правильные.
- ✅ TD-036 — снят 2026-05-03 вместе с TD-116: обе OAuth-функции удалены, дублировать больше нечего.
- ✅ TD-037 — «Выйти со всех устройств» (2026-05-03). `authService.signOut({ scope })` принимает параметр и пробрасывает в `supabase.auth.signOut`. На мобильном `AccountScreen` существующий Alert при тапе «Выйти» расширен до трёх кнопок: Отмена / «Только это устройство» / «Все устройства» (вместо прежнего Yes/No). На вебе `WebAccountScreen` — новая мини-модалка в стиле существующей `deleteConfirmVisible`. App.js `handleLogout` принимает `opts` и пробрасывает в `signOut`. Шесть новых i18n-ключей (`logoutThisDevice`, `logoutAllDevices` × en/th/ru). Проверено в sandbox — выход глобально, повторный вход проходит нормально.
- ✅ TD-038 — «Удалить аккаунт» (миграция `20260415000010`, коммиты `903ffb4`, `7b313c9`)
- ✅ TD-039 — Login.js: `loading` state + `disabled` + переключение текста на `saving` (2026-04-30).
- ✅ TD-041 — снят 2026-05-03 вместе с TD-116: OAuth удалён, проверять pending-приглашения для несуществующего входа не нужно.

## Company & Team

- ✅ TD-021 — мобильный Invite Accept экран (2026-05-05). Архитектурно решён через мобильно-адаптированный веб (`src/web/screens/WebInviteAcceptScreen.js`): приглашённый агент кликает magic-link из письма → открывается веб-страница в браузере телефона → имя/пароль → принят в команду → экран успеха с кнопкой «Скачать приложение». Нативного экрана в мобильном приложении нет принципиально. Заглушка `APP_STORE_URL = '#'` заменена на реальный URL `https://apps.apple.com/app/i-am-agent/id6496850036` (App Store ссылка без локального префикса — Apple сам перебрасывает на нужный регион).
- ✅ TD-022 — мобильный UI «Команда» (2026-05-03). Новый экран `src/screens/TeamScreen.js` — полный паритет с `WebTeamSection`: список активных членов, архив, приглашения, форма приглашения через Edge Function `invite-agent`, модалка прав (две галочки + локации), модалки confirm для отзыва приглашения и увольнения. Подключён через `AccountStack` → `Team`, кнопка «+ Добавить сотрудника» в `CompanyScreen` теперь ведёт сюда вместо `Alert.alert('Coming soon')`. Сервисный слой переиспользован 1:1, ничего нового в `companyService` не писали. Мёртвый ключ `teamComingSoon` удалён из переводов. Ручной QA на телефоне прошёл по всем сценариям (приглашение → email → отзыв → права → увольнение).
- ✅ TD-023 — миграция `check_email_exists` (`20260412000000`)
- ✅ TD-024 — `deactivate_member` функция (миграции `20260415000002`, `20260415000009`)
- ✅ TD-026 — dormant flow в `WebInviteAcceptScreen` (коммит `2d30d4a`, переписан 2026-04-27)
- ✅ TD-027 — rate-limiting (миграции `20260415000005`, `20260417000002`; в новом flow rate-limit в Edge Function)
- ✅ TD-028 — объединён с TD-042
- ✅ TD-029 — валидация имени компании (2026-05-05, хелпер `assertValidCompanyName` в `companyService.js`, длина 2-80 после `trim`; UI ловит `COMPANY_NAME_INVALID` и показывает перевод `companyNameInvalid` × 3 языка; e2e-тест веб 5/5 пройдены)
- 🔁 TD-030 — нет аудит-лога действий с командой. Перенесён в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`) — для одиночного админа реальной пользы мало, вернёмся после публичного запуска и роста команд.
- ✅ TD-040 — Registration не проверяет pending (закрыт 2026-04-27 коммит `1ce131d`/`d08ae35`)
- ✅ TD-042 — `deactivate_member` soft-delete (миграция `20260415000009`, коммит `be35aa2`)
- ✅ TD-057 — снято в пользу простоты (этап 2 simple-perms): два переключателя слились в один `can_manage_property`

## Properties

- ✅ TD-005 — снято в пользу простоты (этап 2 simple-perms): permissions упрощены до двух флагов, гварды переписаны на `can_manage_property`/`can_manage_bookings`
- ✅ TD-006 — `owner_commission_*_is_from` дропнуты (миграция `20260401000005`)
- ✅ TD-007 — `properties.updated_at` (в проде с 2026-04-22, миграция `7fe1238`)
- ✅ TD-008 — backfill `property_rejection_history` (миграция от 2026-03-28)
- ✅ TD-009 — снято в пользу простоты (этап 2 simple-perms): модерации больше нет, роль «помощник админа» неактуальна
- ✅ TD-013 — `<KeyboardAvoidingView behavior="padding">` уже стоит в `PropertyEditWizard.js:1275`. iOS работает (2026-04-30). Хвост: для Android при будущем тестировании может потребоваться `behavior="height"`.
- ✅ TD-025 — миграция `auto_set_property_company` (`20260415000003`)
- ✅ TD-043 — `properties.resort_id` → `parent_id` (2026-05-03, миграция накатана в sandbox, ручной QA на мобайле прошёл: список объектов с детьми, создание юнита внутри резорта, фильтр по типу в Bookings, удаление родителя с каскадом). Миграция `20260503000004_rename_resort_id_to_parent_id.sql` — `ALTER TABLE RENAME COLUMN` + `RENAME INDEX IF EXISTS` + `RENAME CONSTRAINT IF EXISTS` (через `DO $$ ... pg_constraint`) + `NOTIFY pgrst 'reload schema'`. JS-код: 82 вхождения в 17 файлах заменены через `perl -pi -e`. Whitelist `ALLOWED_CLIENT_FIELDS` обновлён. Особый случай — `dataUploadService.js`: целевая website-БД (через подтверждённый SQL-запрос на сайтовой Supabase колонка осталась `resort_id`), поэтому в `syncToTarget` перед `target.from('properties').insert(...)` добавлен маппинг `parent_id → resort_id` через destructuring. Накатывание в prod — в финальном релизе вместе с остальными миграциями.
- ✅ TD-044 — мобильный wizard валидация локации/района (коммит `c354c72`)
- ✅ TD-045 — Веб `video_url` → `videos` массив (2026-05-03). На вебе видео теперь работает с массивом, паритет с мобайлом. Колонка `videos` уже была в БД и whitelist `propertiesService.ALLOWED_CLIENT_FIELDS`. `WebPropertyEditPanel.js` — `buildForm` читает `videos` с бэк-совместимостью (если массив пуст, но есть старое `video_url` — подтягивает как первый элемент). UI переписан с одиночного `TextInput` на список ссылок с кнопкой `+ добавить` и крестиком `✕` на каждой строке (стили `videoRowItem`/`videoUrlText`/`videoRemoveText`, паттерн из `PropertyEditWizard.js:730-752`). При сохранении `videos` пишется как массив, `video_url` обнуляется (постепенная миграция данных). Заодно вынесена утилита `getVideoThumbnailUrl` в `src/utils/videoThumbnail.js` — на мобайле локальная копия удалена, импортируется из общего места. Добавлен вывод видео-превьюшек на вебе: в боковой панели `WebPropertyDetailPanel` секция «Видео» под фото-каруселью, в большой странице `WebPropertiesScreen` секция после галереи фото. Превью YouTube/Vimeo + кнопка «▶», клик открывает в новой вкладке через `Linking.openURL`. Массовая чистка старых `video_url` SQL'ом — в финальном релизе.
- ✅ TD-046 — currency на мобильном (2026-05-02). Запись в БД уже была, но (а) при редактировании валюта объекта затиралась на текущую валюту пользователя из контекста (`useLanguage().currency`), (б) форма редактирования рисовала символ валюты пользователя, а не валюты объекта, (в) при свежем логине `LanguageContext` подтягивал валюту только из `AsyncStorage`, не из `users_profile.settings.selectedCurrency` — отсюда расхождение «галочка USD в настройках, форма в ฿». Фиксы: `PropertyEditWizard.js` — `activeCurrency = mode === 'edit' ? (property?.currency || currency) : currency`, символ строится через `getCurrencySymbol(activeCurrency)` и идёт и в отображение, и в `buildUpdates`. `PropertyDetailScreen.js` — драфты `draftHouseInResort`/`draftApartmentInCondo` получили `currency: p.currency`, чтобы новый юнит наследовал валюту родителя. `AccountScreen.js` — после загрузки профиля рядом с `setSelectedCurrency(curr)` вызывается `setCurrency(curr)` для синхронизации общего контекста.
- ✅ TD-047 — поле `address` подключено целиком на обеих платформах (2026-05-03). Изначальное описание было неточным: на вебе поле не только не выводилось в UI, но и не было ни в `buildForm`, ни в `updates` payload — то есть юзер физически не мог сохранить адрес. Веб: `WebPropertyEditPanel.js` — `address` добавлен в обе ветки `buildForm` (edit/create), новый `FieldRow` в секции «Локация» перед google_maps_link, `address: form.address.trim() || null` в `updates`. `WebPropertyDetailPanel.js` — отображение в шапке второй строкой под городом. `WebPropertiesScreen.js` — `InfoRow` с `t('pdAddress')` в SectionBlock «Локация». Мобайл (форма уже умела писать через `PropertyEditWizard.js:328`): `PropertyDetailScreen.js` — `InfoRow` добавлен в трёх SectionBlock (дочерний юнит резорта/кондо, обычный дом, контейнер), показывается только если адрес заполнен. Whitelist `propertiesService.ALLOWED_CLIENT_FIELDS` уже включал `address` — миграции и серверные правки не требовались.
- ✅ TD-048 — Веб загружает owners для агента (коммит `0eda95e`)
- ✅ TD-049 — мобильный wizard скрыть «Ответственный» агенту (коммит `c354c72`)
- ✅ TD-050 — server validation `location_id` (миграция `20250326000002`)
- ✅ TD-051 — whitelist полей в `createPropertyFull`/`updateProperty`/`approvePropertyDraft` + фикс авто-принятия (2026-04-27, коммит `445d9c9`)
- ✅ TD-052 — снято в пользу простоты (этап 2 simple-perms): статус `submitted` больше не используется, мёртвый код в триггере уйдёт в этапе 3 (cleanup)
- ✅ TD-053 — фото в Storage не удаляются при delete (коммит `c048ded`)
- ✅ TD-054 — UNIQUE на `(company_id, UPPER(TRIM(code)), UPPER(COALESCE(TRIM(code_suffix), '')))` через partial index (2026-05-02, миграции `20260502000000` + `20260502000001`). Пустой/NULL код пропускается, дочерние юниты различаются по `code_suffix`. Case-insensitive: `Test 1` и `TEST 1` считаются одним. UI на обеих платформах приводит code/code_suffix к UPPER. При попытке создать дубль сервис бросает `error.code='DUPLICATE_PROPERTY_CODE'`, UI показывает понятный текст красным жирным.
- ✅ TD-055 — снято в пользу простоты (этап 2 simple-perms): черновиков объектов больше нет
- ✅ TD-056 — снято в пользу простоты (этап 2 simple-perms): `needsApproval`-логики больше не существует
- ✅ TD-058 — снято в пользу простоты (этап 2 simple-perms): раздельное сохранение `info`/`prices` неактуально, `can_manage_property` управляет всем
- ✅ TD-059 — снято в пользу простоты (этап 2 simple-perms): статуса `rejected` больше нет
- ✅ TD-060 — Веб каскадное обновление района дочерних (2026-05-03). При изменении района у резорта/кондо в `WebPropertyEditPanel.handleSave` теперь вызывается `updateResortChildrenDistrict(property.id, updates.district)` — та же утилита, которой пользуется мобайл (`PropertyDetailScreen.js:1340-1344`). Каскад срабатывает только если (а) `targetType` это `resort` или `condo`, (б) район реально поменялся (`updates.district !== property.district`). Импорт функции добавлен в `WebPropertyEditPanel.js`.
- ✅ TD-061 — предупреждение при удалении объекта с бронированиями (2026-05-02). Helper `bookingsService.getBookingsCountForProperty` (учитывает дочерние юниты в резорте/кондо). На вебе `WebPropertiesScreen.PropertyDetail` — текст модалки меняется на «у объекта N броней, они тоже удалятся». На мобайле `PropertyDetailScreen.handleDeletePress` — async с alert'ом про count перед onDelete/handleDirectDelete.
- ✅ TD-062 — Веб сжатие фото (1200px JPEG 0.85, `WebPropertyEditPanel.js:25`)
- ✅ TD-063 — Веб удалённые фото из Storage (2026-05-01). `WebPropertyEditPanel.handleRemovePhoto` больше не зовёт `deletePhotoFromStorage` мгновенно — крестик только обновляет state. Реальное удаление файлов (оригинал + миниатюра) происходит в `handleSave` через diff `property.photos/photos_thumb` vs `updates.photos/photos_thumb`. Закрытие панели без save теперь не теряет фото — паритет с мобильным.
- ✅ TD-064 — миниатюры фотографий 150px (2026-05-01). Миграция `20260501000001_properties_photos_thumb.sql` (колонка `photos_thumb text[]`). При загрузке фото генерируется два файла `_thumb.jpg` (150px) и оригинал (1200px); веб через `resizeImageFile`, мобайл через новую `uploadPhotoWithThumb` в `storageService.js` (использует `expo-image-manipulator`). Списки/карточки используют миниатюру с fallback на оригинал: `WebPropertiesScreen` (cardThumb, child unit), `WebPropertyEditPanel` (грид превью), `PropertyItem` (мобильный expandedPhoto). Storage-cleanup при удалении (handleRemovePhoto, handlePhotoDelete, handleSave, deleteProperty) чистит и thumb-URL. Whitelist `propertiesService.ALLOWED_CLIENT_FIELDS` расширен на `photos_thumb`.
- ✅ TD-065 — Веб полноэкранная галерея (2026-05-01). Новый компонент `src/web/components/WebPhotoGalleryModal.js`: чёрный backdrop, навигация стрелками ‹/› + клавишами ←/→, Escape закрывает, клик на backdrop закрывает, счётчик «N / M». Подключён в трёх местах: карусель `WebPropertyDetailPanel` (read-only), большая галерея на странице «База» в `WebPropertiesScreen.PropertyDetail` (read-only), грид редактора `WebPropertyEditPanel` (с правом удаления).
- ✅ TD-066 — кнопки сохранить/удалить в галерее (2026-05-01, в составе TD-065). Кнопка ↓ открывает меню «Save this photo / Save all (N)» (паритет с мобильным `PropertyDetailScreen.PhotoGalleryModal`). Скачивание через fetch+blob+`<a download>` (cross-origin Supabase → localhost). Кнопка корзины 🗑 видна только при `canDelete=true` (только в редакторе), удаление через `window.confirm`.
- ✅ TD-067 — удаление локации с привязанными объектами блокируется (2026-05-02). Helper `propertiesService.getPropertiesCountByLocation`. На вебе `WebLocationsModal.handleDelete` и на мобайле `AddLocationsModal.handleDelete` — если count > 0, показывается «нельзя удалить, у локации N объектов».
- ✅ TD-068 — UNIQUE на `(company_id, UPPER(TRIM(country)), UPPER(TRIM(region)), UPPER(TRIM(city)))` для locations (2026-05-02, миграции `20260502000000` + `20260502000001`). Case-insensitive. Дубль в сервисе — `error.code='DUPLICATE_LOCATION'`, UI показывает красным. Плюс case-insensitive проверка дубля района при добавлении (помимо UNIQUE на subtable `location_districts`) — на UI красная ошибка под input'ом, при клике «Сохранить» с не-добавленным районом он автоматически добавляется/проверяется.
- ✅ TD-069 — обязательность всех полей локации (коммит `c354c72`)
- ✅ TD-070 — Веб: в WebPropertyEditPanel под dropdown'ом района добавлен inline-input «+ Добавить» через `setLocationDistricts`. Доступно и админу, и агенту. Паритет с мобильным (2026-04-30).
- ✅ TD-071 — мобильный показывает «Ответственный» агенту (коммит `c354c72`)

## Bookings

- ✅ TD-072 — Веб `WebBookingCalendarPicker` подсвечивает занятые даты и блокирует выбор пересекающихся диапазонов (закрыто ранее, подтверждено 2026-05-01). Мобильный — через `occupiedDates` в `AddBookingModal`. Унификация интерфейсов — TD-119.
- ✅ TD-073 — контакт обязателен или `not_my_customer` (коммит `c354c72`)
- ✅ TD-074 — Веб сжатие фото бронирования (закрыто ранее, подтверждено 2026-05-03). В `WebBookingEditPanel.js:443` файлы перед загрузкой проходят через `resizeImageFile(file, 1200, 0.85)` — паритет с мобильным `AddBookingModal`. В PROGRESS_PLAN статус ⬜ был забыт после реализации.
- ✅ TD-075 — Веб пикер напоминаний reminder_days (коммит `b1e4d33`)
- ✅ TD-076 — Веб: продуктовое решение владельца — локальные push не нужны. Комиссии отображаются в `WebCalendarStrip` (подсветка дат) и `WebDashboardScreen` (дневная agenda с подписью). Закрыто 2026-05-01.
- ✅ TD-077 — Веб: отменять нечего, локальные push не используются (закрыто 2026-05-01 вместе с TD-076). Отображение комиссий пересчитывается из текущего состояния броней.
- ✅ TD-078 — мобильный время по дефолту 14:00/12:00 (коммит `c354c72`)
- ✅ TD-079 — `bookingRemindersService` `SchedulableTriggerInputTypes.DATE` (коммит `4f0efdc`)
- ✅ TD-080 — формула стоимости помесячный расчёт (коммит `c1483fd`)
- ✅ TD-081 — Веб PDF «Подтверждение» (коммит `b1e4d33`)
- ✅ TD-082 — помесячная разбивка `monthly_breakdown` (коммиты `837ca1f`, `8d66c20`)
- ✅ TD-083 — Веб «Клиент собственника» скрывает финансы (коммит `0eda95e`)
- ✅ TD-084 — RLS bookings убран permissive (коммит `fd9dc82`)
- ✅ TD-085 — UX закрыт на обеих платформах: на чужой брони агент видит название компании вместо имени клиента, тап по полоске не открывает экран деталей. Веб закрыт 2026-04-27. Мобильный закрыт 2026-04-30 при проверке доски (агент мог свободно открыть детали чужой брони через `BookingCalendarScreen` → `BookingDetailScreen`, скрыты были только кнопки). `window.supabase` не глобален → простого DevTools-обхода нет. Column-level RLS (защита от продвинутого атакующего с access_token из localStorage) — отдельная задача в памяти `project_bookings_column_level.md`.
- ✅ TD-086 — `booking_agent_id` инфраструктура (миграция `20260415000006`, апрель) + полная фича передачи брони с пикером, уведомлениями и каскадом (2026-04-28, коммиты `ebc0709`+`2f018b3`+`22ae879`). Попутно закрыты B1 (mapBooking) и B21 (deactivated в пикере).
- ✅ TD-087 — снято в пользу простоты (этап 2 simple-perms): `can_delete_booking` объединён с `can_manage_bookings`
- ✅ TD-088 — удалён `can_see_financials` (коммит `2d30d4a`)
- ✅ TD-089 — мобильный AddBookingModal переключатель %/сумма (фаза 5 закрыта 2026-05-01)
- ✅ TD-091 — Веб dormant `viewMode` код (коммит `2d30d4a`)
- ✅ TD-092 — Веб multi-select dropdown «Город» в WebBookingsScreen toolbar (2026-04-30, коммит `9f7800d`)
- ✅ TD-093 — Веб multi-select dropdown «Тип» (house/resort/condo) (2026-04-30)
- ✅ TD-094 — Веб два TextInput «Min»/«Max» для price_monthly (2026-04-30)
- ✅ TD-095 — Веб multi-select dropdown «Удобства» (4 удобства), фильтрация по объекту amenities (2026-04-30)
- ✅ TD-096 — Веб поиск по коду/имени/собственнику (owner_id + owner_id_2) (2026-04-30)
- ✅ TD-097 — Веб расширено окно таймлайна до ±36 месяцев + dropdown «Год» (2026-04-30)

## Contacts

- ✅ TD-002 — `company_id` в `contacts` + RLS (миграция `20260327130000`)
- ✅ TD-098 — CHECK `contacts.type IN ('clients','owners')` (2026-05-05, миграция `20260505000000_contacts_type_check.sql`, накатана в sandbox; на prod — в фазе 10)
- ✅ TD-099 — RLS contacts по `booking_agent_id` (2026-04-28, миграция `20260428000001`, коммит `2dafc75`). Политика `contacts: agent reads booking clients` — агент читает клиентов из своих броней.
- ✅ TD-122 — дедупликация клиентов в форме брони по телефону/email (2026-05-05, согласовано 2026-04-28). RPC `find_or_create_booking_contact` с SECURITY DEFINER (миграция `20260505000001`, накатана в sandbox; на prod — в фазе 10) ищет совпадение по нормализованному phone (только цифры, ≥5) или email (lower+trim) в пределах company_id, type='clients'. JS-обёртка `findOrCreateBookingClient` в `contactsService.js` возвращает `{contact, existed}`; при `existed=true` и невидимости контакта по RLS использует синтетический объект из payload (id настоящий, чужие поля не утекают). Подключено в мобильный `AddBookingModal.handleSaveContact` (Alert) и веб `WebBookingEditPanel.handleNewContactSaved` (window.alert) через новый проп `customCreate` в общем `WebContactEditPanel` (обратная совместимость с обычным экраном контактов сохранена). i18n `clientLinkedExisting` × en/th/ru. SQL-тесты 4/4 PASS, статический ревью PASS.
- ✅ TD-100 — мобильный AddContactModal и веб WebContactEditPanel сжимают фото-аватар до 1200px JPEG 0.85 (2026-04-30, закрыто вместе с TD-104). Миниатюры 150px — TD-064.
- ✅ TD-101 — CHECK `trim(contacts.name) <> ''` (2026-04-27, миграция `20260427000006`, коммит `8842f13`)
- ✅ TD-102 — удалён `can_manage_clients` (коммит `2d30d4a`)
- ✅ TD-103 — мобильный AddContactModal: блок «Документы» с гридом превьюшек, добавлением через image-picker (сжатие 1200px JPEG 0.85) и удалением по крестику (2026-04-30). Паритет с вебом.
- ✅ TD-104 — Веб фото контакта добавлено в WebContactEditPanel (2026-04-30): круглый аватар-блок с превью, загрузкой и удалением; canvas-сжатие 1200px JPEG 0.85; bucket `contact-photos/avatars/`; поле `photoUri` в payload.
- ✅ TD-105 — предупреждение при удалении owner с объектами (обе платформы, 2026-04-30). Подсчёт через `properties.owner_id`/`owner_id_2`, i18n `deleteOwnerWithPropertiesMessage`.
- ✅ TD-106 — предупреждение при удалении client с бронированиями (обе платформы, 2026-04-30). Подсчёт через `bookings.contact_id`, i18n `deleteClientWithBookingsMessage`.
- ✅ TD-107 — Веб агент клиенты через JS-костыль удалён 2026-04-29 (коммит `26fdc0d`). После TD-099 единый путь через `getContacts()` + RLS.

## Calendar Events

- 🔁 TD-108 — Веб напоминания календарных событий (Web Push). Перенесён в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`, V2-002) — большая инфраструктура (Service Worker, VAPID-ключи, Edge Function), сейчас не приоритет.
- ✅ TD-109 — RLS `calendar_events` по `user_id` (миграция `20250326000000`)
- ✅ TD-110 — перенос события на другую дату (поле «Дата» рядом с «Время», веб+мобайл; фикс синхронизации точек на полоске после правки)

## Notifications

- 🔁 TD-090 — Веб браузерные push-уведомления (= P3-003). Перенесён в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`, V2-002) — Service Worker и Edge Function для отправки, делаем после публичного запуска.
- ✅ TD-111 — снято в пользу простоты (этап 2 simple-perms): уведомлений с `action_taken` больше нет
- ✅ TD-112 — снято в пользу простоты (этап 2 simple-perms): кнопки модерации убраны принципиально
- ✅ TD-113 — мобильный realtime-бейдж уведомлений (закрыт ранее, подтверждено пользователем 2026-05-02). Подписка на `notifications` с фильтром `recipient_id=eq.user.id` уже подключена в `RealEstateScreen.js:154-177`, `AgentCalendarScreen.js:333`, `BookingCalendarScreen.js:333`; при INSERT/UPDATE/DELETE счётчик пересчитывается без перезахода.

## Statistics

- ✅ TD-114 — мобильный StatisticsScreen, паритет с вебом (2026-05-05). На мобайле собрано: пикер периода, четыре KPI-карточки сеткой 2x2 (оборот, доход агентства, активные брони, заполняемость), график выручки/дохода за 12 месяцев + прогноз (горизонтальный скролл, цифры всегда видны, округление до тысяч, ширина колонки 80pt, ширина столбика 32pt), график количества броней (создано/заехало) за 12+12 месяцев в той же стилистике, блок «Топ-5 объектов» по обороту за период, блок «Лидерборд агентов» (только админу), модалка breakdown по объектам с навигацией ‹/› (через `<Modal presentationStyle="pageSheet">`). На обоих графиках под месяцем показывается год вида «май 26» (`showYear` prop). Веб-компоненты получили опциональные props (`cardFlexBasis`, `colWidth`, `barMaxWidth`, `alwaysShowValues`, `fullNumbers`, `mobileMode`, `showYear`) для мобильного режима — веб не сломан. В `StatisticsTopProperties` и `StatisticsAgentLeaderboard` добавлен `minWidth: 90` на колонку оборота/дохода чтобы на узких экранах телефона она не схлопывалась под длинные суммы — на вебе никак не повлияло.
- ✅ TD-120 — курсы валют для статистики (2026-05-05). Финальная версия: клиент-онли, без бэкенда. Один сервис `src/services/currencyRatesService.js` ходит на публичный `https://api.fxratesapi.com/latest?base=USD&currencies=EUR,THB,RUB` (без ключа, CORS открыт, отдаёт все четыре валюты включая RUB), `CurrencyRatesContext` кэширует ответ на сутки в AsyncStorage с защитой от гонки (паттерн фазы A: один useEffect, два этапа в одной async). `convertAmount` уже умеет graceful degrade при отсутствии курса. Точность исторических курсов — компромисс: для прошлых броней применяется сегодняшний курс (расхождение 1-3% за год не существенно для статистики аренды). Если в будущем понадобится точная история — добавить `/historical?date=...` за уникальные даты броней.
  - ❌ Откат: вся Supabase-инфраструктура (миграция `currency_rates`, Edge Function `sync-currency-rates`, миграция `pg_cron`, привязка к Vault) удалена 2026-05-05 как избыточная для одиночного пользователя на Pro-плане Supabase. Прогон `supabase db push` упёрся в дрейф схемы из TD-115 (Local 86 vs Remote 0); попытка `migration repair` оставила висящий дубликат `20250321000000`; ECB через frankfurter не отдаёт RUB после феврapr 2022 — три stop-сигнала подряд. Решено отказаться от backend-стройки в пользу клиентского API.
  - ✅ Фаза A (баг-фикс настройки валюты, изолированный) закрыта 2026-05-05. Симптом: пользователь выбирает THB в настройках, после перезагрузки приложение показывает USD. Найдены три причины: (1) `UserContext.initialUser.selectedCurrency = 'USD'` хардкод-дефолт маскировал «не загружен»; (2) `AccountScreen` имел свой локальный `useState('USD')` который дублировал `LanguageContext.currency` и эти два хранилища расходились (на вебе паттерн правильный — `WebSettingsModal` читает напрямую из `user?.selectedCurrency`); (3) `LanguageContext` при старте читал валюту из `AsyncStorage`, и кэш на устройстве (со старым USD от предыдущих неудачных попыток) перетирал значение из БД из-за гонки между двумя `useEffect`. Правки: `initialUser.selectedCurrency = null`; в `AccountScreen` убран локальный state, `<CurrencyModal selectedCurrency={currency}>` теперь смотрит прямо в `LanguageContext`; в `App.js` после `getCurrentUser`/`onLogin`/`onSuccess` добавлен явный `setCurrency(userData.selectedCurrency)` — единая точка синхронизации; в `LanguageContext` убрано чтение `AsyncStorage` для валюты (язык по-прежнему читается). Поток теперь однонаправленный: БД → UserContext → setCurrency → LanguageContext. `catch{}` в `saveAgentSettings` заменён на показ `Alert` с реальным текстом ошибки — раньше любая ошибка сохранения молча проглатывалась.
- ✅ TD-121 — унификация формул в `statisticsCalc.js` (2026-05-05). По факту правка коснулась только `computeTopProperties` — переписан с `b.totalPrice` на `getRentByMonth` + `monthInRange` + `getCommissionDateAmounts` + `dateInRange`, как в `computeRevenue` / `computeAgencyIncome`. Теперь топ-5 объектов считается по той же логике что и общий оборот: многомесячные брони разбиваются по `monthlyBreakdown` (раньше схлопывались в один период по `b.totalPrice`), брони с checkIn вне периода но имеющие rent в периоде теперь попадают в топ. Заодно в результат добавлено поле `agencyIncome` (раз есть цифра — пусть UI сможет показать). Удалена мёртвая функция `bookingsInPeriodByCheckIn`. Проверка на лету: `computeAgentLeaderboard` уже считает по правильной формуле (через `getRentByMonth` + `dateInRange`), его не трогали — тестер дал чуть неточную оценку.

## i18n

- ✅ TD-004 — дублирующиеся ключи переводов почищены (2026-05-03). Удалены два дубля веб/мобайл: `bkTotalPrice` (веб) объединён с `bookingTotalPrice` (мобайл), `ownerCommissionOneTime` (мобайл) объединён с `bookingOwnerCommOnce` (веб). Заодно удалены два мёртвых ключа `bkOwnerCommissionOnce` / `bkOwnerCommissionMonthly` — нигде не дёргались. Затронуты: `BookingDetailScreen.js:404`, `AddBookingModal.js:979`, `WebBookingEditPanel.js:762` (там `L('bkTotalPrice')` заменено на `${t('bookingTotalPrice')} (${sym})` — поведение со значком валюты сохранено через явную конкатенацию вместо `L()`-плейсхолдера). В словаре удалено 12 строк (4 ключа × 3 языка). Найден отдельный пласт ~40 пар «один текст в разных контекстах» (например `pdOwnerCommOnce` форма объекта vs `bookingOwnerCommOnce` форма брони) — это отдельная задача на унификацию, не TD-004.
- ✅ TD-010 — `TYPE_COLOR` вынесен в общий конфиг (2026-05-03). До этого константа `TYPE_COLOR` дублировалась в трёх веб-файлах с лёгкими расхождениями в оттенках: `WebPropertyDetailPanel` (полная палитра с `pill` и расширенными типами `resort_house`/`condo_apartment`), `WebBookingEditPanel` (то же без расширенных типов), `WebBookingsScreen` (без `pill`, чуть другие тёмные оттенки). Создан `src/web/constants/propertyTypeColors.js` — единая палитра + helper `getPropertyTypeColors(type)` с фолбэком на `house`. Все три файла переключены на импорт. Побочный эффект: в `WebBookingsScreen` оттенки слегка изменились (`#FFFDE7→#FFFBEB`, `#2E7D32→#15803D`, `#1565C0→#1D4ED8`) — выровнялись по эталонной палитре из формы редактирования объекта.
- ✅ TD-011 — язык в `users_profile.settings` (закрыт 2026-04-08, отмечен в CURSOR_RULES)
- ✅ TD-012 — хардкод строк в `WebPropertyDetailPanel` починен (2026-05-03). Заменены на переводы: `Фото не добавлены` → `t('propNoPhotos')`, `Спален` → `t('propBedrooms')`, `Санузлов` → `t('propBathrooms')`, `от ` (price_monthly_is_from prefix) → `t('propFrom')`, `Сейчас` (badge активной брони) → `t('bookingActiveNow')` (новый ключ × 3 языка). Хардкод бата `฿/мес` заменён на динамический значок валюты объекта `${getCurrencySymbol(property.currency)}${t('perMonth')}` — теперь работает для долларовых/евровых объектов. Тройная плюрализация ночей `nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'` вынесена в общую утилиту `src/utils/pluralize.js` (`pluralByLang(n, lang, { one, few, many })` с правилами для русского по mod10/mod100). Заведены ключи `nightOne`/`nightFew`/`nightMany` × 3 языка. Бат-знак в строке стоимости брони (`฿ ${b.totalPrice}`) тоже переключён на валюту объекта. `WebSettingsModal` — единственная русская строка `'Русский'` это название языка в переключателе локали (как `English`/`ภาษาไทย`), не переводится.

## Miscellaneous

- ✅ TD-003 — `CONTEXT_FOR_AI.md` cleanup (2026-04-08)
- ✅ TD-020 — UserContext: единый шаблон карточки + унифицированный поток (2026-05-03). `initialUser` расширен с 9 контактных полей до 20 каноничных (plan='standard', teamRole=null, isAgentRole/isAdminRole=false, teamMembership=null, teamPermissions={}, workAs='private', companyId=null, companyInfo={}, language='en', selectedCurrency='USD', notificationSettings={}, locations=[], web_notifications={...}). Обе функции (updateUser/handleUserUpdate) теперь идут через единый normalizeUser — поля наследуются из initialUser, типы массивов/объектов страхуются. Заодно: WebMainScreen больше не держит локальный useState(initialUser) — читает user из useUser() (раньше был параллельный стейт, по сути дубль контекста). App.js: пропсы `user`/`onUserUpdate` в WebMainScreen удалены. Попутный фикс: `AccountScreen.useEffect` читал `profile.app_language` (поле никогда не существовало в результате `getUserProfile` — оно называется `profile.language`), из-за чего при заходе в Аккаунт язык всегда сбрасывался на английский — поправлено на `profile.language`. Tester прошёл по UserContext.
- ✅ TD-035 — `getUserProfile` 5 запросов → RPC `get_full_user_profile` (2026-05-03, миграция накатана в sandbox, прошла проверку через приложение). Миграция `20260503000003_get_full_user_profile_function.sql` — функция `SECURITY DEFINER` (внутри явная проверка `auth.uid() = p_user_id` от запроса чужого профиля), JOIN'ит `users_profile` + активную `companies` (owner_id) + `company_members` + `agent_location_access` + `companies` (для membership), возвращает JSONB. `authService.getUserProfile` переписан с 5 последовательных `.from(...).select(...)` на один `.rpc('get_full_user_profile')`. Маппинг финального объекта (20+ полей) не изменён — для всех вызывающих сторона выглядит как раньше. Эффект: вкладка «Мой профиль» в мобайле (`AccountScreen.js:212` + `:221`) дёргала `getCurrentUser()` дважды при каждом возврате на вкладку — было 10 запросов, теперь 2. Накатывание в prod — в финальном релизе вместе с остальными миграциями.
- ✅ TD-115 — baseline-миграция главных таблиц (2026-05-05). `supabase/migrations/00000000000000_baseline_schema.sql` — schema-only дамп публичной схемы из sandbox (13 таблиц: agent_location_access, bookings, calendar_events, companies, company_invitations + backup, company_members, contacts, location_districts, locations, notifications, properties, users_profile). Сделано через `pg_dump --schema-only --schema=public --no-owner --no-privileges` (libpq 18.3). Только структура, без данных. С этим baseline + остальные миграции теперь воспроизводят базу с нуля.
- ✅ TD-116 — OAuth-код удалён из проекта (2026-05-03). Из `Login.js` убраны импорты `signInWithGoogle/Facebook`, обработчики `handleGoogleLogin/Facebook`, закомментированный JSX социальных кнопок и связанные стили (`orText`, `socialRow`, `socialBtn`, `socialBtnFacebook`, `socialIconGoogle`, `socialIconFacebook`). Из `authService.js` удалены функции `signInWithGoogle`/`signInWithFacebook` (~110 строк) и импорты `expo-auth-session` / `expo-web-browser` (npm-deps оставлены в `package.json`). Из `translations.js` удалён ключ `orSignIn` во всех трёх языках. В `docs/MODULE_RULES/auth.md` секция AU-OAUTH-1..8 свернута в одну строку «удалено», TD-036 и TD-041 в табличке помечены снятыми. В `docs/RULES_HUMAN/01_Регистрация_и_вход.html` удалён раздел «1.3 Вход через Google и Facebook», обновлены строки таблицы TD. Закрывает заодно TD-036 и TD-041.
- 🔁 TD-118 — Native deep links (Universal Links на iOS, App Links на Android) для confirmation/recovery-ссылок. Перенесён в backlog v2 (`docs/Устав компании/09_Бэклог_идей_и_TODO.md`, V2-003). Сейчас на телефоне ссылка из письма открывается в браузере — это рабочий fallback. Реальная польза только для уже установивших приложение, делаем после публичного запуска. Что нужно будет: associated domain в Apple Developer Console + файл `apple-app-site-association` на сайте; App Links в Google Play + `assetlinks.json`; схемы в Expo `app.json`; redirectTo в Supabase.
- ✅ TD-119 — Унификация picker'а занятых дат (2026-05-03). Создана общая утилита `src/utils/bookingOccupancy.js` (`buildOccupiedSet`, `buildOccupancyArrays`, `hasOccupiedInRange`). Веб `WebBookingCalendarPicker` импортирует `buildOccupiedSet` оттуда вместо локальной копии. Мобайл `AddBookingModal` переведён с трёх отдельных state-массивов (`occupiedDates`/`occupiedCheckInDates`/`occupiedCheckOutDates`) на один `bookedRanges` — три массива для библиотеки `react-native-calendar-range-picker` считаются на лету через `useMemo(buildOccupancyArrays(bookedRanges))`. Валидация пересечений переведена на `hasOccupiedInRange`. Попутно исправлено расхождение поведения: до этой правки мобайл считал день выезда другого гостя занятым, теперь как на вебе — в день выезда можно поставить заезд новому гостю.

---

## Идеи и фичи (из `09_Бэклог_идей_и_TODO.md`)

- ✅ P1-001 — снято в пользу простоты (этап 2 simple-perms): модерации нет, роль «помощник админа» не нужна
- ✅ P1-002 — снято в пользу простоты (этап 2 simple-perms): `rejection_reason` больше не используется
- ✅ P1-003 — backfill `property_rejection_history` (= TD-008)
- ⬜ P1-004 — ограничение функций при downgrade тарифа (premium→standard)
- ⬜ P1-005 — полная чистка термина «agent» везде кроме роли
- ⬜ P2-001 — audit trail `rejection_type`
- ⬜ P2-002 — UX уведомлений (группировка/timestamp/«прочитать все»)
- ✅ P2-003 — снято в пользу простоты (этап 2 simple-perms): permissions упрощены, гварды переписаны
- ⬜ P2-004 — история правок объекта `property_change_history`
- ✅ P3-001 — снято в пользу простоты (этап 2 simple-perms): review-flow удалён (миграция `20260430000000_simple_perms_overhaul_phase3_cleanup.sql` дропнула `property_drafts` и `property_status`), паритет несуществующего flow на мобайле невозможен.
- ✅ P3-002 — снято в пользу простоты (этап 2 simple-perms): таблица `property_rejection_history` дропнута в той же миграции, экспортировать нечего.
- 🔁 P3-003 — Web Push уведомления (= TD-090). Перенесён в backlog v2 (V2-002).
- ⬜ P3-004 — фильтр объектов по статусу в левом списке
- ✅ P3-005 — `properties.updated_at` (= TD-007)

---

## Финальный релиз (после закрытия всего выше)

- ✅ Сверка ветки `dev` с правилами всех модулей (`docs/MODULE_RULES/`) — 2026-05-05. Точечная актуализация двух правил, которых не коснулась синхронизация в `7490f98`: `i18n.md` (скоуп + новые файлы TD-120 `currencyRatesService` / `CurrencyRatesContext` / `currencyConvert`, переписан I18N-5 в две части — обычный UI без конвертации vs статистика с конвертацией через fxratesapi, добавлена связь с модулем Statistics) и `sync.md` (актуализированы цифры строк: `companyChannel.js` 34→74, `dataUploadService.js` 158→189). Остальные 9 модулей синхронизированы коммитом `7490f98`, между ним и сверкой правок кода не было.
- ✅ Обновить `docs/RULES_HUMAN/` — снято 2026-05-05. Папка `docs/RULES_HUMAN/` (13 HTML-документов: «термины и введение» плюс 12 модулей с правилами простым языком) целиком удалена: эта стартовая документация была нужна только на этапе входа в работу с модулями, после оформления `docs/MODULE_RULES/` стала дублирующим артефактом и устарела. Источник правды для правил модулей — `docs/MODULE_RULES/` + `CURSOR_RULES.md`.
- ✅ Property type cleanup в prod — 2026-05-05 валидация подтвердила, что cleanup от 2026-05-03 (UPDATE через SQL Editor, ~127 строк выправлено по `child.resort_id = parent.id`) держится. Аудит-SELECT по prod вернул 0 строк с `parent.type IN ('resort','condo') AND child.type IN ('house','resort','condo')`. Распределение типов: `resort_house` 264, `condo_apartment` 133, `resort` 122, `house` 57, `condo` 56 — всего 632 объекта, все значения из валидного списка. Хвост: CHECK constraint `properties_type_resort_id_consistency` (защита от повторного появления кривых записей) не добавлен — будет в шаге 7 (накат миграций).
- ✅ Нормализация code/code_suffix и locations.country/region/city в prod к UPPER(TRIM(...)) — 2026-05-05. Аудит дублей до наката миграций `20260502000000` (case-sensitive UNIQUE) и `20260502000001` (case-insensitive UNIQUE) показал только один конфликт в properties: компания `2f452d44-2642-47e8-b5d1-f2561e8629cc`, два объекта с code=`CW045` без суффикса — резорт `Bhundhari Residence Koh Samui` и его юнит `Двуспальная вилла` (`resort_house`). Юниту через UI CRM руками проставлен суффикс. После этого выполнены два массовых UPDATE: `UPDATE properties SET code=UPPER(TRIM(code)), code_suffix=NULLIF(UPPER(TRIM(code_suffix)),'') WHERE code IS NOT NULL AND TRIM(code)<>'';` и `UPDATE locations SET country=UPPER(TRIM(country)), region=UPPER(TRIM(region)), city=UPPER(TRIM(city));`. Финальный аудит все пять полей вернул нули — данные нормализованы, миграции `20260502000000/000001` на шаге 7 пройдут чисто.
- ✅ Хвосты по `properties.updated_at` — 2026-05-06. Создан идемпотентный файл миграции `supabase/migrations/20260506000000_properties_updated_at.sql` (ADD COLUMN IF NOT EXISTS + backfill `created_at` + DEFAULT now() + NOT NULL + функция `properties_set_updated_at` + триггер `trg_properties_set_updated_at` BEFORE UPDATE + NOTIFY pgrst). Накатан в sandbox `mdxujiuvmondmagfnwob` через SQL Editor — sanity-чек подтвердил: `nulls=0, total=428, trigger_exists=1`. TD-007 в `CURSOR_RULES.md` помечен ✅ ЗАКРЫТ. ADR-002 в журнале решений был отменён ещё 2026-04-30 (по причине из ADR-015 — UI истории отклонений выпилен с simple-perms); в секции «Альтернативы» дописано что одна из них (`updated_at` в `properties`) всё-таки реализована 2026-04-22. DROP backup-таблицы `properties_backup_before_updated_at` в prod перенесён на шаг 6 — будет дропнут сразу после полного backup prod-базы, чтобы попасть в snapshot как страховка.
- ✅ Backup prod базы — 2026-05-06. Полный pg_dump через прямое подключение к prod (после reset пароля в Supabase Studio): файл `~/Desktop/iamagent_prod_backup_2026-05-06.sq` 4.8 MB, 13941 строк SQL, заголовок и завершение pg_dump валидны. Файл сохранён вне репо. После этого выполнен `DROP TABLE IF EXISTS properties_backup_before_updated_at;` в prod — старая страховочная копия от 2026-04-22 удалена (она попала в свежий snapshot как страховка). prod готов к накату миграций на шаге 7.
- ✅ Накат миграций в prod — 2026-05-06. Через `psql -1 -f` (single transaction per file) накатано 27 миграций. Pre-проверки прошли: нет дублей активных приглашений по `(company_id, lower(email))`, нет пустых/whitespace имён контактов, нет невалидных типов контактов. Первый прогон упал на `20260428000000_booking_assignment_integrity.sql` — отсутствовала колонка `booking_agent_id` (миграция `20260415000006` не была накатана в prod ранее). Полный structural diff между prod и sandbox показал ещё 9 пропущенных миграций периода 15-17 апреля (rate limiting, booking_agent_id, check_pending_invitation, delete_own_account, get_company_team_status, verify_invitation_returns_attempts и др.). Второй прогон с расширенным списком из 27 файлов прошёл целиком до DONE. Финальная сверка структуры prod ↔ sandbox: только одно ожидаемое косметическое расхождение — backup-таблица `company_invitations_backup_2026_04_27` хранит snapshot `company_invitations` на разный момент в разных БД, не функциональная разница. Дополнительно для полной идентичности добавлена политика `users_profile_insert_on_signup` (из baseline) и удалена legacy политика «bookings: company member read» (предшествующая simple-perms).
- ✅ Дроп legacy функций приглашений — 2026-05-06. Перед DROP: grep по `src/` и `supabase/functions/` — ни одного вызова в актуальном коде. Дропнуты в prod и sandbox синхронно: `generate_secret_code()`, `get_invitation_by_token(uuid)`, `reset_invitation_secret(uuid)`, `verify_invitation_secret(uuid, text)`. Verify-запрос вернул 0 строк в обеих БД. Эти функции — наследие первой версии invitation flow (приглашение по секретному коду), после `invitation_flow_v2` (Supabase Auth `inviteUserByEmail` + magic link) больше не нужны.
- ✅ Подключить `crm.iamagent.app` к production-окружению Vercel — 2026-05-06. Цепочка: на dev обновлён `src/services/supabase.js` на prod URL/anon key (коммит `89017ff`), финальная staging-проверка через crm.iamagent.app (preview ветки dev) подтвердила работу с prod-БД (454 объектов компании). Мерж `dev → main` (commit `199240b`) с разрешением двух конфликтов: `app.json` — взят buildNumber 26 из main, `src/services/dataUploadService.js` — взята версия dev (использует `parent_id` в SELECT из CRM, маппит обратно в `resort_id` перед INSERT в website-БД). Vercel автоматически собрал Production deployment (D3c4SwUVs, Ready за 23s). В Vercel Domains привязка `crm.iamagent.app` переключена с Preview/dev на Production — браузерная проверка после переключения подтвердила работу на prod как раньше.
- ✅ Обновить TestFlight-билд приложения — 2026-05-06. EAS production build (id `fcc4a2a0-52e8-4e18-9391-eba02a9e4bae`) на основе ветки main с prod Supabase URL. Build number автоматически инкрементирован 26 → 27, app.json обновлён локально и закоммичен. Submit через `eas submit --platform ios --latest`: submission `a2d5dab5-8e4a-4655-9ea2-b0e31d1441cf`, IPA загружен в App Store Connect (apple ID grafkorshunov@gmail.com, ASC App ID 6760377389, Apple Team 9G93WMNK4Y). Apple processing 5-10 минут, после чего билд доступен в TestFlight на https://appstoreconnect.apple.com/apps/6760377389/testflight/ios.
- ⬜ Удалить или архивировать тестовые записи в sandbox (по желанию).

---

## Сводка прогресса (по аудиту 2026-05-05)

- Всего TD: **120** уникальных номеров (TD-001..TD-121, минус несколько объединений). Подтверждено двумя read-only Explore-аудитами по всему файлу — все ✅ соответствуют коду, фейков нет.
- ✅ Закрыто: **116** TD
- 🔁 Отложено в backlog v2: **4** TD: TD-030 (аудит-лог команды → V2-001), TD-090 (Web Push в браузер = P3-003 → V2-002), TD-108 (Web Push календарных событий → V2-002), TD-118 (native deep links → V2-003).
- ⬜ Не начато активных TD: **0**. Все блокирующие задачи закрыты или отложены.
- ✅ Объединено: **1** (TD-028→TD-042)
- Идеи P1-P5: **14** уникальных номеров. Закрыто/снято: **7** (P1-001, P1-002, P1-003, P2-003, P3-001, P3-002, P3-005). Отложено в v2: **1** (P3-003=TD-090). Открыто: **6** (P1-004, P1-005, P2-001, P2-002, P2-004, P3-004) — все по желанию, не блокеры релиза.
- Финальный релиз: **10** шагов (мерж dev→main, миграции в prod, дроп legacy, TestFlight, домен).

**Прогресс: 100% активных TD закрыто или отложено в v2.** Перед публичным релизом остаётся только финальный накат на боевую базу (10 шагов фазы 10). P-идеи и v2-задачи — после запуска.
