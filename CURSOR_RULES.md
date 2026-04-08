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

**I am Agent** — CRM-система для частных агентов по аренде недвижимости (помесячная аренда).
Целевой пользователь: частный агент который ведёт базу объектов, бронирования и клиентов.
Уникальность: единственная CRM заточенная под помесячную аренду (не посуточную, не городскую).

**Платформы:**
- **Мобильное приложение:** Expo SDK 54 + React Native (iOS, Android)
- **Веб-версия:** React Native Web → деплой на Vercel
- **Бэкенд:** Supabase (PostgreSQL + Auth + Realtime + Storage)

**Текущий статус:** продукт запущен, идёт мониторинг после релиза (коммит 6e7e637, 2026-03-28).

---

## 2. ФУНДАМЕНТАЛЬНЫЕ ПРАВИЛА АРХИТЕКТУРЫ

### 2.1 Главный принцип: всё привязано к company_id

При регистрации любого пользователя автоматически создаётся компания (companies).
Пользователь становится её владельцем (companies.owner_id = user.id).
Все данные привязаны к company_id, не к user_id.

| Таблица | Привязка |
|---------|---------|
| properties | company_id (NOT NULL обязателен) |
| bookings | company_id (NOT NULL обязателен) |
| contacts | user_id (нет company_id — технический долг TD-002) |
| calendar_events | company_id (NOT NULL) |
| locations | company_id (NOT NULL) |

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

## 3. РОЛИ И ТАРИФЫ — ЕДИНСТВЕННАЯ ПРАВДА

### КРИТИЧЕСКИ ВАЖНО: роль не равно тариф. Это два разных понятия.

### 3.1 Тарифные планы → хранятся в agents.plan

| Значение | Название | Объекты | Фото | Команда |
|----------|----------|---------|------|---------|
| standard | Стандарт | до 10 | до 10/объект | нет |
| premium | Премиум | до 300 | до 30/объект | создать компанию + агенты |
| korshun | Korshun | безлимит | безлимит | полный доступ |

korshun — приватный тариф разработчика. Назначается вручную.

Менять тариф: UPDATE agents SET plan = '...' WHERE id = '...';
Читать тариф: agents.plan — и только оно.

### 3.2 Роли в команде → хранятся в company_members.role

| Значение | Кто | Доступ |
|----------|-----|--------|
| admin | Создал аккаунт самостоятельно, владелец компании | Полный |
| agent | Приглашён администратором | Ограниченный |

Роль owner — legacy, мигрирована в admin (migration 20260330000002).
Роль worker — удалена, не существует.

Читать роль: company_members.role — и только оно.

### 3.3 Поле agents.role — УСТАРЕВШЕЕ

agents.role — НЕ ИСПОЛЬЗОВАТЬ для определения ни роли, ни тарифа.
Это поле содержит мусор. Технический долг TD-001: удалить в следующей миграции.

### 3.4 Канонические поля профиля в коде

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
| Создать | да | да при can_add_property |
| Редактировать | да | да при can_edit_info/can_edit_prices только свои |
| Удалить approved | да | никогда |
| Удалить pending/rejected | да | только если создатель (user_id = uid) |
| Одобрить / Отклонить | да | нет |

LOCK-001 (утверждено, не менять без подтверждения):
Agent может удалить объект ТОЛЬКО при двух одновременных условиях:
1. properties.user_id = auth.uid() (создатель)
2. property_status != 'approved'

CF-001: properties.user_id НЕ является правом доступа после переназначения.
Единственный критерий доступа агента: responsible_agent_id = auth.uid().

### 4.2 Детальные разрешения агента (из company_members.permissions JSONB)

can_add_property — добавлять объекты
can_edit_info — редактировать основные поля
can_edit_prices — редактировать цены
can_see_financials — видеть комиссии и финансы
can_book — создавать бронирования
can_delete_booking — удалять бронирования
can_manage_clients — управлять контактами

### 4.3 Статусы объекта

pending — ожидает проверки (показывать значок)
approved — одобрен (обычный вид)
rejected — отклонён, нужны правки (показывать значок)

---

## 5. ПРАВИЛА ДЛЯ DEVELOPER

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

### Критический — сделать в первую очередь

TD-001: agents.role содержит мусор (значение 'standard' — это тариф, не роль)
Что сделать: UPDATE agents SET role = NULL WHERE role = 'standard'; затем удалить поле

TD-002: ✅ ЗАКРЫТ — company_id добавлен в contacts, RLS настроен, все 137 записей заполнены (проверено 2026-04-08)

TD-003: ✅ ЗАКРЫТ — CONTEXT_FOR_AI.md очищен от устаревших планов (2026-04-08)

### Средний — при ближайшей возможности

TD-004: Дублирующиеся ключи переводов: ownerCommissionOneTime vs bookingOwnerCommOnce
Что сделать: унифицировать в translations.js

TD-005: TODO разрешения не применены в UI
Что сделать: реализовать гарды в WebPropertiesScreen, WebPropertyEditPanel, WebBookingsScreen

TD-006: owner_commission_*_is_from поля в properties — legacy флаги
Что сделать: удалить поля из схемы после проверки

### Низкий — бэклог

TD-007: properties не имеет updated_at — добавить колонку
TD-008: Backfill property_rejection_history для legacy объектов
TD-009: Разрешения can_moderate_properties для старшего агента

---

## 8. СХЕМА БАЗЫ ДАННЫХ (краткая)

agents — профиль пользователя
  id = auth.users.id
  plan → тариф: standard / premium / korshun
  role → УСТАРЕВШЕЕ, не использовать

companies — компания (создаётся автоматически при регистрации)
  owner_id → FK agents.id

company_members — участники компании
  role → admin / agent
  status → active / inactive
  permissions → JSONB с детальными правами

properties — объекты недвижимости
  user_id → кто создал (НЕ право доступа)
  company_id → компания
  responsible_agent_id → ответственный агент (право доступа для агентов)
  property_status → pending / approved / rejected

bookings — бронирования
  user_id → агент
  company_id → компания
  contact_id → арендатор

contacts — контакты
  type → tenant (арендатор) / owner (собственник)
  ВНИМАНИЕ: нет company_id — см. TD-002

property_rejection_history — история отклонений (append-only)
  Записи никогда не обновляются и не удаляются

Типы объектов:
  Дом — отдельный объект
  Резорт — контейнер для домов в резорте
  Кондо — контейнер для апартаментов

Дочерние объекты наследуют responsible_agent_id от родителя. Ручное изменение заблокировано.

---

## 9. ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ В SQL

Правильно — менять тариф:
UPDATE agents SET plan = 'premium' WHERE id = '<uuid>';

Правильно — менять роль в команде:
UPDATE company_members SET role = 'agent' WHERE user_id = '<uuid>' AND company_id = '<uuid>';

НЕПРАВИЛЬНО — читать роль из agents:
SELECT role FROM agents; — это устаревшее поле!

НЕПРАВИЛЬНО — менять тариф через role:
UPDATE agents SET role = 'premium' WHERE id = '<uuid>'; — НЕТ!

---

Версия: 2.0 | Апрель 2026
Обновлять этот файл при любом изменении архитектуры, ролей, тарифов или структуры БД.
