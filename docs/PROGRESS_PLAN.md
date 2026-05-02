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
> Последнее обновление: 2026-05-02 (фаза 7 «предупреждения при удалении» закрыта: TD-054, TD-061, TD-067, TD-068)

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

### Фаза 9 — Технический долг кода (5-7 дней)
TD-020 (UserContext), TD-035 (RPC `get_full_user_profile`), TD-043 (resort_id → parent_id, 78 вхождений — рискованный), TD-001 (users_profile.role мусор), TD-034 (signUp settings merge), TD-036 (объединить OAuth providers), TD-037 (выйти со всех устройств), TD-030 (audit log), TD-045 (videos массив), TD-047 (address поле), TD-060 (каскадное обновление района), TD-004/TD-010/TD-012 (i18n). _(TD-052, TD-055, TD-056 сняты в этапе 2 simple-perms.)_
Зачем предпоследней: рефакторинги без видимого UX-эффекта; делаем когда фичи закрыты. TD-043 — самый рискованный.

### Фаза 10 — Идеи P1-P5 + финальный релиз (5-7 дней)
P1-004 (downgrade тарифа), P1-005 (чистка термина «agent»), P2-001/P2-002/P2-004, P3-001/P3-002/P3-004, TD-090/P3-003 (Web Push), TD-108 (web reminders календарных), TD-110 (перенос события), TD-016 (disposable emails) + 10 финальных шагов релиза. _(P1-001/TD-009, P1-002 сняты в этапе 2 simple-perms.)_
Зачем последней: идеи P-уровня — не блокеры. Web Push тянет за собой Service Worker — крупный кусок. Финальный релиз = мерж dev→main + миграция prod + дроп legacy + TestFlight.

---

## Auth & Session

- ⏳ TD-001 — `users_profile.role` мусор (миграция есть, UPDATE неполный)
- ✅ TD-014 — полный recovery flow: ссылка на Login → ForgotPassword (`resetPasswordForEmail` с `redirectTo`) → email → клик → listener `PASSWORD_RECOVERY` в App.js → UpdatePassword (`setNewPassword`) → выход и возврат на Login (2026-04-30). Deep-link в нативное приложение — отдельный TD при необходимости.
- ✅ TD-015 — email confirmation flow (2026-04-30): signUp возвращает pendingConfirmation если Supabase не выдал session → Registration переключает на экран `EmailConfirmationPending`. После клика по confirm-ссылке Supabase редиректит на сайт с хешем `type=signup` → App.js показывает `EmailConfirmedSuccess`. signIn ловит ошибку «Email not confirmed» и показывает понятный текст. Native deep link для мобильного — TD-118.
- ✅ TD-017 — миграция `handle_new_user` (миграции `20260415000001`, `20260427000003`)
- ✅ TD-018 — хардкод `korshun31@list.ru` удалён из `signUp()` и `WebInviteAcceptScreen` (2026-04-27, коммит `1c1ba40`)
- ✅ TD-019 — Web Login мелькание устранено: `App.js` рендерит `<Preloader />` на стадии `preloader` для обеих платформ (2026-04-30).
- ✅ TD-031 — пароль 8 символов + common passwords (коммит `9f4ffec`)
- ✅ TD-032 — клиентская защита от brute-force на Login: 3 попытки → блокировка кнопки на 60 сек, переживает reload (AsyncStorage). Серверный rate-limit + CAPTCHA — отдельный security TD на потом (2026-04-27, коммит `28bcbd3`)
- ✅ TD-033 — снят 2026-04-30: OAuth-кнопки уходят из продукта, PKCE настраивать для удаляемой функции бессмысленно. Чистка остатков OAuth-кода — TD-116.
- ⬜ TD-034 — `signUp()` перезаписывает settings
- ⬜ TD-036 — `signInWithGoogle/Facebook` дублируют код
- ⬜ TD-037 — нет «Выйти со всех устройств»
- ✅ TD-038 — «Удалить аккаунт» (миграция `20260415000010`, коммиты `903ffb4`, `7b313c9`)
- ✅ TD-039 — Login.js: `loading` state + `disabled` + переключение текста на `saving` (2026-04-30).
- ⬜ TD-041 — OAuth не проверяет pending-приглашения

## Company & Team

- ⏳ TD-021 — мобильный Invite Accept экран (есть только Web)
- ⬜ TD-022 — нет мобильного UI «Команда»
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
- ⬜ TD-043 — `properties.resort_id` → `parent_id` (78 вхождений)
- ✅ TD-044 — мобильный wizard валидация локации/района (коммит `c354c72`)
- ⏳ TD-045 — Веб `video_url` → `videos` массив (есть `video_url`, не массив)
- ⬜ TD-046 — мобильный не хранит currency на объекте
- ⏳ TD-047 — Веб поле `address` (есть в form, не в UI)
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
- ⬜ TD-060 — Веб каскадное обновление района дочерних
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
- ⬜ TD-074 — Веб сжатие фото бронирования
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
- ⬜ TD-110 — перенос события на другую дату (см. `project_calendar_events_status.md`)

## Notifications

- ⬜ TD-090 — Веб браузерные push-уведомления (= P3-003)
- ✅ TD-111 — снято в пользу простоты (этап 2 simple-perms): уведомлений с `action_taken` больше нет
- ✅ TD-112 — снято в пользу простоты (этап 2 simple-perms): кнопки модерации убраны принципиально
- ⬜ TD-113 — мобильный realtime бейдж уведомлений

## Statistics

- ⏳ TD-114 — мобильный `StatisticsScreen` parity с веб (есть экран, данные неполные)

## i18n

- ⏳ TD-004 — дублирующиеся ключи `ownerCommissionOneTime` vs `bookingOwnerCommOnce` (обе ещё в файле)
- ⬜ TD-010 — `WebPropertyDetailPanel` `TYPE_COLOR` хардкод
- ✅ TD-011 — язык в `users_profile.settings` (закрыт 2026-04-08, отмечен в CURSOR_RULES)
- ⬜ TD-012 — `WebPropertyDetailPanel` / `WebSettingsModal` хардкод строк

## Miscellaneous

- ✅ TD-003 — `CONTEXT_FOR_AI.md` cleanup (2026-04-08)
- ⬜ TD-020 — `UserContext.handleUserUpdate` системные поля
- ⬜ TD-035 — `getUserProfile` 4-5 запросов → RPC `get_full_user_profile`
- ⬜ TD-115 — В git нет CREATE TABLE для главных таблиц (`properties`, `locations`, `contacts`, `users_profile`/`agents`). Они существуют только в живой БД (создавались вручную). При пересоздании БД с нуля из git — невозможно. Снять полный schema dump из sandbox и положить как baseline-миграцию (например `supabase/migrations/00000000000000_baseline_schema.sql`). Найдено 2026-04-30 при чистке legacy-папки `supabase_migrations/`.
- ⬜ TD-116 — Полная чистка OAuth-кода. Удалить из проекта: функции `signInWithGoogle`/`signInWithFacebook` в `authService.js`, обработчики `handleGoogleLogin`/`handleFacebookLogin` в `Login.js`, закомментированный JSX социальных кнопок в `Login.js` строки 220-232, стили `socialBtn`/`socialBtnFacebook`/`socialIconGoogle`/`socialIconFacebook` в `Login.js`, перевод `orSignIn` в трёх языках (en/th/ru), все правила AU-OAUTH-* в `docs/MODULE_RULES/auth.md`, упоминание OAuth в `docs/RULES_HUMAN/01_Регистрация_и_вход.html`. Заведено 2026-04-30 после снятия TD-033 — OAuth-кнопки уходят из продукта целиком.
- ⬜ TD-118 — Native deep links (Universal Links на iOS, App Links на Android) для confirmation/recovery-ссылок. Сейчас при клике на ссылку из письма на телефоне открывается браузер вместо приложения; юзер видит экран «Почта подтверждена» в Safari/Chrome и должен сам вернуться в приложение и войти. Чтобы система предлагала «Открыть в I am Agent?», нужно: associated domain в Apple Developer Console + файл `apple-app-site-association` на сайте; App Links в Google Play + `assetlinks.json`; схемы в Expo `app.json`; redirectTo в Supabase. Заведено 2026-04-30 — отдельная задача от TD-014 и TD-015.
- ⬜ TD-119 — Унификация picker'а занятых дат (booking calendar) между веб и мобильным. Сейчас веб (`WebBookingCalendarPicker`) принимает `bookedRanges` как массив `{checkIn, checkOut}` и сам строит `occupiedSet`; мобильный (`AddBookingModal`) принимает `occupiedDates` как готовый массив строк дат. Поведение одинаковое (юзер не выбирает занятые дни), но интерфейс разный — баг-фикс надо делать дважды. Привести к единому формату (рекомендуется `bookedRanges` как ranges — компактнее в БД-ответе). Заведено 2026-05-01. Делать в фазу 9 «технический долг кода» — функционально обе платформы работают, это рефакторинг для чистоты.

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
- ⬜ P3-001 — mobile parity review-flow
- ⬜ P3-002 — экспорт CSV истории отклонений
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

## Сводка прогресса (по аудиту 2026-04-27)

- Всего TD: **111** уникальных пунктов (TD-001..TD-114, минус TD-002/003/028 которые объединены или закрыты, плюс TD-010..TD-012 — итого 114 номеров, 111 активных)
- ✅ Закрыто: **48** TD
- ⏳ Частично: **13** TD
- ⬜ Не начато: **53** TD
- ✅ Объединено: **1** (TD-028→TD-042)
- Идеи P1-P3: **14**, закрыто **1** (P3-005), объединены с TD: **3** (P1-003=TD-008, P2-003=TD-005, P3-003=TD-090)
- Финальный релиз: **10** шагов

**Прогресс: ~43% TD закрыто**, и за апрель проделана колоссальная работа (миграции `20260415000001..010`, мобильные правки, фото, бронирования). Остаётся в основном веб-фронтенд, мелкие фичи и финальный релиз.
