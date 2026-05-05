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
> Последнее обновление: 2026-05-05 (фаза 8 «mobile паритет» закрыта целиком: TD-021, TD-022, TD-046, TD-113, TD-114; добавлены TD-119/120/121; план почищен от устаревших пунктов P3-001/P3-002 после simple-perms)

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

### Фаза 9 — Технический долг кода (1-2 дня)
TD-030 (аудит-лог действий с командой), TD-115 (baseline-миграция главных таблиц для git). Всё что было запланировано в фазе (TD-020, TD-035, TD-043, TD-001, TD-034, TD-036, TD-037, TD-045, TD-047, TD-060, TD-004, TD-010, TD-012) закрыто параллельно с другими фазами в апреле-мае.
Зачем предпоследней: рефакторинги без видимого UX-эффекта; делаем когда фичи закрыты.

### Фаза 10 — Идеи P1-P5 + финальный релиз (5-7 дней)
P1-004 (downgrade тарифа), P1-005 (чистка термина «agent»), P2-001/P2-002/P2-004, P3-004 (фильтр по статусу), TD-090/P3-003 (Web Push), TD-108 (web reminders календарных), TD-118 (native deep links) + 10 финальных шагов релиза. _(P1-001/TD-009, P1-002, P3-001, P3-002 сняты в этапе 2 simple-perms — модерации больше нет; TD-110 закрыт.)_
Зачем последней: идеи P-уровня — не блокеры. Web Push тянет за собой Service Worker — крупный кусок. Финальный релиз = мерж dev→main + миграция prod + дроп legacy + TestFlight.

---

## Auth & Session

- ✅ TD-001 — мусорная колонка `users_profile.role` удалена (2026-05-03). Две миграции: `20260503000001_handle_new_user_drop_role.sql` (триггер перестал писать в role) + `20260503000002_drop_users_profile_role.sql` (DROP COLUMN). Sandbox-проверка перед дропом: 20 пользователей, у всех `plan` валиден, CHECK/RLS на role нет. JS-правки: `roleFeatures.js` переименован `ROLES` → `PLANS` (`KORSHUN: 'korshun'` вместо `ADMIN: 'admin'`); `authService.getUserProfile` читает только `data.plan` и больше не отдаёт legacy-поле `role`; `AccountScreen.isAdmin` теперь `plan === PLANS.KORSHUN`; `PropertyEditWizard` зовёт `getPhotoLimitForProperty(u?.plan || 'standard')`. Документация обновлена: убраны раздел 3.3 в CURSOR_RULES, антипример SELECT/UPDATE role, AU-PROFILE-3 в auth.md, упоминания «role='standard'» в описании триггера.
- ✅ TD-014 — полный recovery flow: ссылка на Login → ForgotPassword (`resetPasswordForEmail` с `redirectTo`) → email → клик → listener `PASSWORD_RECOVERY` в App.js → UpdatePassword (`setNewPassword`) → выход и возврат на Login (2026-04-30). Deep-link в нативное приложение — отдельный TD при необходимости.
- ✅ TD-015 — email confirmation flow (2026-04-30): signUp возвращает pendingConfirmation если Supabase не выдал session → Registration переключает на экран `EmailConfirmationPending`. После клика по confirm-ссылке Supabase редиректит на сайт с хешем `type=signup` → App.js показывает `EmailConfirmedSuccess`. signIn ловит ошибку «Email not confirmed» и показывает понятный текст. Native deep link для мобильного — TD-118.
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
- ✅ TD-029 — валидация имени компании (`name.trim()` проверка)
- ⬜ TD-030 — нет аудит-лога действий с командой
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
- ✅ TD-098 — CHECK `contacts.type IN ('clients','owners')` (миграция применена)
- ✅ TD-099 — RLS contacts по `booking_agent_id` (2026-04-28, миграция `20260428000001`, коммит `2dafc75`). Политика `contacts: agent reads booking clients` — агент читает клиентов из своих броней.
- ✅ TD-100 — мобильный AddContactModal и веб WebContactEditPanel сжимают фото-аватар до 1200px JPEG 0.85 (2026-04-30, закрыто вместе с TD-104). Миниатюры 150px — TD-064.
- ✅ TD-101 — CHECK `trim(contacts.name) <> ''` (2026-04-27, миграция `20260427000006`, коммит `8842f13`)
- ✅ TD-102 — удалён `can_manage_clients` (коммит `2d30d4a`)
- ✅ TD-103 — мобильный AddContactModal: блок «Документы» с гридом превьюшек, добавлением через image-picker (сжатие 1200px JPEG 0.85) и удалением по крестику (2026-04-30). Паритет с вебом.
- ✅ TD-104 — Веб фото контакта добавлено в WebContactEditPanel (2026-04-30): круглый аватар-блок с превью, загрузкой и удалением; canvas-сжатие 1200px JPEG 0.85; bucket `contact-photos/avatars/`; поле `photoUri` в payload.
- ✅ TD-105 — предупреждение при удалении owner с объектами (обе платформы, 2026-04-30). Подсчёт через `properties.owner_id`/`owner_id_2`, i18n `deleteOwnerWithPropertiesMessage`.
- ✅ TD-106 — предупреждение при удалении client с бронированиями (обе платформы, 2026-04-30). Подсчёт через `bookings.contact_id`, i18n `deleteClientWithBookingsMessage`.
- ✅ TD-107 — Веб агент клиенты через JS-костыль удалён 2026-04-29 (коммит `26fdc0d`). После TD-099 единый путь через `getContacts()` + RLS.

## Calendar Events

- ⬜ TD-108 — Веб напоминания календарных событий (Web Push)
- ✅ TD-109 — RLS `calendar_events` по `user_id` (миграция `20250326000000`)
- ✅ TD-110 — перенос события на другую дату (поле «Дата» рядом с «Время», веб+мобайл; фикс синхронизации точек на полоске после правки)

## Notifications

- ⬜ TD-090 — Веб браузерные push-уведомления (= P3-003)
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
- ⬜ TD-115 — В git нет CREATE TABLE для главных таблиц (`properties`, `locations`, `contacts`, `users_profile`/`agents`). Они существуют только в живой БД (создавались вручную). При пересоздании БД с нуля из git — невозможно. Снять полный schema dump из sandbox и положить как baseline-миграцию (например `supabase/migrations/00000000000000_baseline_schema.sql`). Найдено 2026-04-30 при чистке legacy-папки `supabase_migrations/`.
- ✅ TD-116 — OAuth-код удалён из проекта (2026-05-03). Из `Login.js` убраны импорты `signInWithGoogle/Facebook`, обработчики `handleGoogleLogin/Facebook`, закомментированный JSX социальных кнопок и связанные стили (`orText`, `socialRow`, `socialBtn`, `socialBtnFacebook`, `socialIconGoogle`, `socialIconFacebook`). Из `authService.js` удалены функции `signInWithGoogle`/`signInWithFacebook` (~110 строк) и импорты `expo-auth-session` / `expo-web-browser` (npm-deps оставлены в `package.json`). Из `translations.js` удалён ключ `orSignIn` во всех трёх языках. В `docs/MODULE_RULES/auth.md` секция AU-OAUTH-1..8 свернута в одну строку «удалено», TD-036 и TD-041 в табличке помечены снятыми. В `docs/RULES_HUMAN/01_Регистрация_и_вход.html` удалён раздел «1.3 Вход через Google и Facebook», обновлены строки таблицы TD. Закрывает заодно TD-036 и TD-041.
- ⬜ TD-118 — Native deep links (Universal Links на iOS, App Links на Android) для confirmation/recovery-ссылок. Сейчас при клике на ссылку из письма на телефоне открывается браузер вместо приложения; юзер видит экран «Почта подтверждена» в Safari/Chrome и должен сам вернуться в приложение и войти. Чтобы система предлагала «Открыть в I am Agent?», нужно: associated domain в Apple Developer Console + файл `apple-app-site-association` на сайте; App Links в Google Play + `assetlinks.json`; схемы в Expo `app.json`; redirectTo в Supabase. Заведено 2026-04-30 — отдельная задача от TD-014 и TD-015.
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
- ⬜ P3-003 — Web Push уведомления (= TD-090)
- ⬜ P3-004 — фильтр объектов по статусу в левом списке
- ✅ P3-005 — `properties.updated_at` (= TD-007)

---

## Финальный релиз (после закрытия всего выше)

- ⬜ Сверка ветки `dev` с правилами всех модулей (`docs/MODULE_RULES/`).
- ⬜ Обновить `docs/RULES_HUMAN/` — все правила человеческим языком (просьба от 2026-04-14).
- ⬜ Property type cleanup в prod — 132 объекта (см. `project_properties_type_cleanup.md`).
- ⬜ Нормализация code/code_suffix в prod к UPPER(TRIM(...)) ДО наката миграции `20260502000001` — иначе индекс упадёт на дублях. SQL: `SELECT company_id, UPPER(TRIM(code)), UPPER(COALESCE(TRIM(code_suffix),'')), COUNT(*) FROM properties WHERE code IS NOT NULL AND TRIM(code)<>'' GROUP BY 1,2,3 HAVING COUNT(*)>1;` если есть строки — почистить руками, потом `UPDATE properties SET code=UPPER(TRIM(code)), code_suffix=NULLIF(UPPER(TRIM(code_suffix)),'') WHERE code IS NOT NULL AND TRIM(code)<>'';`. Аналогично для `locations.country/region/city`.
- ⬜ Хвосты по `properties.updated_at`: создать файл миграции в git, обновить TD-007 в CURSOR_RULES, отменить ADR-002.
- ⬜ Backup prod базы перед миграцией.
- ⬜ Накат всех новых миграций в prod (`20260427000000`..`20260427000005` плюс возможные новые).
- ⬜ Дроп legacy функций приглашений в prod (`verify_invitation_secret`, `generate_secret_code`, `reset_invitation_secret`, `get_invitation_by_token`).
- ⬜ Подключить `crm.iamagent.app` к production-окружению Vercel.
- ⬜ Обновить TestFlight-билд приложения.
- ⬜ Удалить или архивировать тестовые записи в sandbox (по желанию).

---

## Сводка прогресса (по аудиту 2026-05-05)

- Всего TD: **120** уникальных номеров (TD-001..TD-121, минус несколько объединений). Подтверждено двумя read-only Explore-аудитами по всему файлу — все ✅ соответствуют коду, фейков нет.
- ✅ Закрыто: **115** TD
- ⬜ Не начато: **5** TD: TD-030 (аудит-лог команды), TD-090 (Web Push в браузер = P3-003), TD-108 (Web Push календарных событий), TD-115 (baseline-миграция главных таблиц для git), TD-118 (native deep links для confirmation/recovery).
- ✅ Объединено: **1** (TD-028→TD-042)
- Идеи P1-P5: **14** уникальных номеров. Закрыто/снято: **6** (P1-001, P1-002, P1-003, P2-003, P3-001, P3-002, P3-005). Открыто: **8** (P1-004, P1-005, P2-001, P2-002, P2-004, P3-003=TD-090, P3-004).
- Финальный релиз: **10** шагов (мерж dev→main, миграции в prod, дроп legacy, TestFlight, домен).

**Прогресс: ~96% TD закрыто.** Остался узкий хвост: один аудит-лог, два Web Push, baseline-миграция, deep links. Дальше — идеи P-уровня и финальный релиз. Большая часть работы по приведению проекта в порядок выполнена за апрель-начало мая 2026.
