# 🗺 Карта продукта — Web и App

---

## Модули системы

| Модуль | Web | App (Flutter) | Примечание |
|--------|-----|---------------|------------|
| **Dashboard** | ✅ `WebDashboardScreen` | ✅ | Статистика, заезды/выезды |
| **Base (Properties)** | ✅ `WebPropertiesScreen` | ✅ | Список + детальная карточка |
| **Bookings** | ✅ `WebBookingsScreen` | ✅ | Ганtt + формы |
| **Contacts** | ✅ `WebContactsScreen` | ✅ | Собственники + клиенты |
| **Account / Team** | ✅ `WebAccountScreen` | ✅ | Профиль, команда, разрешения |
| **Notifications** | ✅ `WebNotificationBell` | ✅ | Review-flow, approve/reject |

---

## Источник истины по UI

Детальная матрица ролей (что видит Админ / Агент по каждому элементу):  
→ [`docs/APP_MAP_WEB.md`](../APP_MAP_WEB.md)

---

## Web/App parity

Контролируется через `09_Бэклог_идей_и_TODO.md`.  
Правило: фича, реализованная в Web, фиксируется в бэклоге как кандидат на App, и наоборот.

---

## Ключевые компоненты Web

```
src/web/
├── WebMainScreen.js          — root, роутинг вкладок, refreshKey
├── components/
│   ├── WebLayout.js          — sidebar, WebNotificationBell
│   ├── WebNotificationBell.js — review-панель, approve/reject
│   ├── WebPropertyEditPanel.js — create/edit/review (readOnly mode)
│   └── WebPropertyDetailPanel.js — боковая панель детали
└── screens/
    ├── WebPropertiesScreen.js — список + PropertyDetail
    ├── WebBookingsScreen.js
    ├── WebContactsScreen.js
    ├── WebDashboardScreen.js
    └── WebAccountScreen.js
```

---

## Review-flow (актуальный)

```
Agent creates/edits property
  ↓ sendNotification (property_submitted / edit_submitted)
Admin sees bell notification
  ↓ click "Посмотреть и принять решение"
WebPropertyEditPanel (readOnly=true, reviewMode=true)
  ↓ onApprove / onReject
propertiesService → update properties + property_rejection_history
  ↓ broadcastChange('properties')
WebPropertiesScreen refreshes via refreshKey
```

---

## Статусы объекта

| Статус | Смысл | UI-поведение |
|--------|-------|--------------|
| `pending` | Ожидает проверки | ⏳ чип в карточке + правой панели |
| `approved` | Одобрен | Стандартный вид |
| `rejected` | Отклонён, требует правки | ⏳ чип + "На обработке" + Edit + история отклонений |
