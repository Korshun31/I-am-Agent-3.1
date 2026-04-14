# Module: Sync & Realtime

## Скоуп

Модуль покрывает: broadcast канал для синхронизации между участниками компании, экспериментальную выгрузку данных.

**Файлы модуля:**
- `src/services/companyChannel.js` — broadcast канал (34 строки)
- `src/services/dataUploadService.js` — выгрузка данных в другую Supabase (158 строк)

## Company Channel (broadcast)

**SY-1.** Паттерн синхронизации: действие (CRUD) → `broadcastChange('table_name')` → другие участники компании получают сигнал → вызывают `refreshX()` → UI обновляется.

**SY-2.** Канал создаётся при входе: `initCompanyChannel(companyId, callbacks)`. Подписка на Supabase broadcast channel `company-{companyId}`.

**SY-3.** `sessionId` предотвращает обработку собственных сигналов — пользователь не получает свои же broadcast.

**SY-4.** Callbacks привязаны к таблицам: `properties`, `bookings`, `contacts`, `calendar_events`, `permissions`. Каждый вызывает соответствующий `refreshX()` из AppDataContext
 (мобильный) или аналогичную загрузку (веб).

**SY-5.** Канал уничтожается при выходе: `destroyCompanyChannel()`.

**SY-6.** Это **лёгкий** механизм — WebSocket соединение, маленькие сообщения. Не нагружает базу.

### Сравнение веб vs мобильный

| Аспект | Мобильный | Веб | Совпадает? |
|---|---|---|---|
| Подписка на канал | ✅ `AppDataContext` | ✅ `WebMainScreen` | ✅ |
| broadcastChange после мутаций | ✅ Все сервисы | ✅ Все сервисы | ✅ |

## Data Upload (экспериментальная)

**SY-7.** Тестовая функция для тарифа korshun — выгрузка всех данных пользователя из основной базы Supabase в другую базу Supabase. Только мобильный. На вебе не нужна.

**SY-8.** Процесс: пользователь вводит URL и ключ другой базы → система берёт все данные (локации → контакты → объекты → бронирования → события) → удаляет старые в target →
вставляет свежие.

## Связь с другими модулями

| Модуль | Связь |
|---|---|
| **Все модули с CRUD** | broadcastChange вызывается после каждой мутации в propertiesService, bookingsService, contactsService, calendarEventsService |
| **AppDataContext** | Получает broadcast → вызывает refreshProperties/Bookings/Contacts/CalendarEvents |
| **Company & Team** | Канал привязан к companyId. broadcastChange('permissions') при изменении прав агента |

## Известные пробелы и TD

Нет TD для этого модуля. Всё работает одинаково на обеих платформах.
