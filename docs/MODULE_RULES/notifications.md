# Module: Notifications & Reminders

## Скоуп

Модуль покрывает: in-app уведомления (колокольчик), отправку/получение/управление уведомлениями. Локальные напоминания описаны в модулях Bookings (BK-REM) и Calendar Events
(CE-CR-5).

**НЕ покрывается:**
- Напоминания о заезде (→ Bookings BK-REM-1)
- Напоминания о комиссиях (→ Bookings BK-REM-2)
- Напоминания о событиях календаря (→ Calendar Events CE-CR-5)

**Файлы модуля:**
- `src/services/notificationsService.js` — CRUD уведомлений
- `src/components/PropertyNotificationsModal.js` — список уведомлений (мобильный)
- `src/web/components/WebNotificationBell.js` — колокольчик + панель (веб). После этапа 2 simple-perms — простой просмотрщик заголовков с переходом на объект, без кнопок одобрить/отклонить.

**DB:**
- Таблица `notifications`: recipient_id, sender_id, type, title, body, property_id, booking_id, is_read, action_taken (колонка осталась с прошлой модели; новые типы её не используют, но поле существует)
- RPC-функция `create_notification(recipient_id, sender_id, type, title, body, property_id, booking_id)` — создание уведомления (SECURITY DEFINER)
- RLS: одна политика `notifications: own records` (`recipient_id = auth.uid()`) — пользователь видит/управляет только своими
- FK: `notifications_property_id_fkey` → `properties(id)` ON DELETE CASCADE
- FK: `notifications_booking_id_fkey` → `bookings(id)` ON DELETE CASCADE

## Подмодули

Модуль не разбивается на подмодули — он достаточно компактный.

## Правила

### Отправка уведомлений

**NT-1.** Уведомления отправляются через RPC `create_notification(recipient_id, sender_id, type, title, body, property_id, booking_id)`. Может отправить любой аутентифицированный
пользователь.

**NT-2.** Типы уведомлений (актуальные после этапа 2 simple-perms):

| Тип | Когда | Кому |
|---|---|---|
| `property_created` | Агент создал новый объект | Админу компании |
| `booking_created` | Агент создал новую бронь | Админу компании |
| `property_assigned` | Объект закреплён за агентом | Назначенному агенту |
| `booking_assigned` | Бронь закреплена за агентом | Назначенному агенту |
| `booking_updated` | Изменены ключевые поля брони (даты, цена, объект) | Закреплённому агенту |

Плюс уведомления из модуля Company (CO-JOIN-7): принятие/отклонение приглашения.

Старые типы модерации (`property_submitted`, `edit_submitted`, `property_approved`, `edit_approved`, `property_rejected`, `edit_rejected`, `price_*`) удалены из БД миграцией этапа 1 simple-perms (`20260429000000`). Код их больше не отправляет.

### Получение и управление

**NT-3.** Каждый пользователь видит **только свои** уведомления (`recipient_id = auth.uid()`).

**NT-4.** Функции:
- `getNotifications()` — список (с лимитом, фильтр по непрочитанным)
- `getUnreadCount()` — количество непрочитанных (для бейджа)
- `getTotalCount()` — общее количество уведомлений
- `markAllRead()` — пометить все прочитанными
- `markActionTaken(id)` — пометить что действие выполнено (legacy-флаг, новая модель его не использует)
- `deleteNotification(id)` — удалить

### UI

**NT-5.** Мобильный: `PropertyNotificationsModal` — модалка со списком уведомлений. Доступна с экранов RealEstate, BookingCalendar, AgentCalendar.

**NT-6.** Веб: `WebNotificationBell` — колокольчик в шапке с выпадающей панелью.

### Бейдж

**NT-7.** Бейдж на колокольчике показывает количество **непрочитанных** уведомлений.

### При удалении объекта

**NT-8.** При удалении объекта уведомления удаляются каскадно (FK ON DELETE CASCADE). При удалении брони — то же самое через `notifications.booking_id` ON DELETE CASCADE.

### Сравнение веб vs мобильный

| Аспект | Мобильный | Веб | Совпадает? |
|---|---|---|---|
| Колокольчик с бейджем | ✅ | ✅ | ✅ |
| Список уведомлений | ✅ Модалка | ✅ Панель | ✅ |
| Пометить все прочитанными | ✅ | ✅ | ✅ |
| Удалить уведомление | ✅ | ✅ | ✅ |
| Realtime обновление бейджа | ✅ WebSocket | ✅ WebSocket | ✅ TD-113 закрыт |

**Все правила применяются одинаково на вебе и мобильном.**

## Связь с RBAC

- Нет permissions для уведомлений — каждый видит свои.
- `property_created` и `booking_created` отправляются только когда создатель — агент, чтобы админ узнал о новой записи в компании. Если создаёт админ — уведомления нет (отправлять самому себе бессмысленно).

## Связь с другими модулями

| Модуль | Связь |
|---|---|
| **Properties** | Уведомление `property_created` админу при создании объекта агентом; `property_assigned` назначенному агенту. Каскадное удаление уведомлений при удалении объекта. |
| **Bookings** | Уведомления `booking_created` админу, `booking_assigned`/`booking_updated` агенту. Локальные напоминания (BK-REM) — отдельная система. |
| **Calendar Events** | Локальные напоминания (CE-CR-5) — отдельная система. |
| **Company & Team** | Уведомления при принятии/отклонении приглашения (CO-JOIN-7). |

## Известные пробелы и TD

| TD | Описание | Приоритет |
|---|---|---|
| **TD-113** | ✅ ЗАКРЫТ (подтверждено 2026-05-02). Realtime-подписка на `notifications` с фильтром `recipient_id` подключена в `RealEstateScreen.js:154-177`, `AgentCalendarScreen.js:333`, `BookingCalendarScreen.js:333` — счётчик пересчитывается без перезахода | Закрыт |

**Снято в этапе 2 simple-perms:** TD-111 (markActionTaken после approve/reject), TD-112 (кнопки одобрить/отклонить в уведомлениях) — модерации больше нет.
