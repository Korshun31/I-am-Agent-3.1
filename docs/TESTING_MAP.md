# Карта тестирования — ветка dev

> Тестируем только пофикшенные TD и SM-2. Не тестируем то что не трогали.
> Статусы: ⬜ не начато | 🔄 в процессе | ✅ ок | ❌ баг | ⏭️  skip (нет сетапа)

## Текущий сетап

| Параметр | Значение |
|----------|----------|
| Supabase | SANDBOX (mdxujiuvmondmagfnwob) |
| Платформа | iOS (телефон) |
| Аккаунт 1 | Solo Admin (без компании) |
| Аккаунт 2 | — нет |

---

## Фаза 1: Solo Admin × iOS

Один пользователь, без компании, без агентов. Базовый CRUD.

### Auth

| # | Фикс | Правило | Что проверить | Статус |
|---|-------|---------|---------------|--------|
| 1 | TD-031: пароль 8+ символов | AU-REG-1 | Регистрация с паролем 7 символов → отказ. 8 символов → ок. "password", "12345678" → отказ (common). | ✅ |
| 2 | TD-017: handle_new_user trigger | AU-REG-5 | При регистрации создаётся profile + workspace + membership. Проверить в Supabase: users_profile, companies, company_members. | ✅ |
| 3 | TD-040: pending invitation | AU-REG-5 | ⏭️  Требует invitation — Фаза 3 | ⏭️  |

### Properties

| #   | Фикс                                  | Правило  | Что проверить                                                                              | Статус |
| --- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------ | ------ |
| 4   | TD-058: split save by permissions     | PR-EDIT  | Solo admin сохраняет все поля объекта (info + prices). Проверить что ничего не потерялось. | ✅      |
| 5   | TD-053: очистка фото из Storage       | PR-PHOTO | Удалить объект с фото → проверить в Supabase Storage что фото удалены.                     | ✅      |
| 6   | TD-062/063: web-компрессия фото       | PR-PHOTO | ⏭️  Web only — Фаза 2                                                                      | ⏭️     |
| 7   | TD-025/052: auto_set_property_company | PR-CR    | Создать объект → в БД company_id заполнен автоматически.                                   | ✅      |
| 8   | Responsible field: видимость          | PR-RESP  | Solo admin без компании → поле "Ответственный" скрыто.                                     | ✅      |
| 9   | SM-2: refresh после rename district   | PR-LOC   | Переименовать район → объекты обновляются без pull-to-refresh.                             | ✅      |

### Contacts

| # | Фикс | Правило | Что проверить | Статус |
|---|-------|---------|---------------|--------|
| 10 | SM-2: refresh после create/delete | CT-CR | Создать/удалить контакт → список обновляется без pull-to-refresh. | ✅ |
| 11 | SM-2: refresh после создания owner в wizard | CT-CR | В PropertyEditWizard создать owner → Contacts → owner виден. | ✅ |

### Bookings

| # | Фикс | Правило | Что проверить | Статус |
|---|-------|---------|---------------|--------|
| 12 | TD-080: помесячный расчёт | BK-CR-9 | priceMonthly=30000. (a) 1мая→1июня=30000 (b) 1мая→16мая≈14516 (c) 1мая→1авг=90000. Авто-пересчёт при смене дат. Ручная перезапись работает. | ✅ |
| 13 | TD-079: trigger напоминаний | BK-REM-4 | Создать бронь с напоминанием 3 дня. Нет crash. | ✅ |
| 14 | TD-078: время по умолчанию | BK-CR-12 | Новое бронирование → Step 2 → check-in=14:00, check-out=12:00. | ✅ |
| 15 | TD-083: owner booking скрывает финансы | BK-CR-5 | ⏭️  Web only — Фаза 2 | ⏭️  |
| 16 | Overlap detection | BK-CR-6 | Бронь 1-15мая. Попытка 10-20мая → CONFLICT. Попытка 16-20мая → ок. | ✅ |
| 17 | SM-2: refresh контактов из booking | BK-CR | В AddBookingModal создать клиента → Contacts → клиент виден. | ✅ |
| 18 | TD-075: пикер напоминаний web | BK-REM | ⏭️  Web only — Фаза 2 | ⏭️  |
| 19 | TD-081: PDF confirmation web | BK-CONF | ⏭️  Web only — Фаза 2 | ⏭️  |
| 20 | Предзаполнение цен из объекта | BK-CR-8 | Объект с ценами → новая бронь → Step 3 цены подтянулись. | ✅ |
| 21 | PDF confirmation mobile | BK-CONF-1 | Детали бронирования → PDF → документ генерируется, суммы по BK-CR-9. | ✅ |

### Account

| # | Фикс | Правило | Что проверить | Статус |
|---|-------|---------|---------------|--------|
| 22 | TD-038: удаление аккаунта | — | Account → Delete → подтверждение → логин-экран. В Supabase: auth.users + users_profile удалены. | ✅ |

---

## Фаза 2: Solo Admin × Web

Те же сценарии + web-only фиксы.

| # | Фикс | Что проверить | Статус |
|---|-------|---------------|--------|
| 23 | TD-062/063: web-компрессия фото | Загрузить фото → размер в Storage < оригинала. | ✅ |
| 24 | TD-083: owner booking скрывает финансы | Включить "Owner booking" → финансовые поля скрыты. | ✅ |
| 25 | TD-075: пикер напоминаний | Создание/редактирование → чекбоксы 1/3/7/30 дней видны. | ✅ |
| 26 | TD-081: PDF confirmation | Детали бронирования → кнопка PDF → документ. | ✅ |
| 27 | TD-080: помесячный расчёт web | Те же кейсы что #12. | ✅ |
| 28 | TD-048: owners для агента web | ⏭️  Требует Agent — Фаза 4 | ⏭️  |
| 29 | TD-088: удалён can_see_financials | Комиссии собственнику видны без permission check. | ✅ |
| 30 | Responsible field web | Solo admin без компании → "Ответственный" скрыто. | ✅ |
| 31 | TD-058: split save web | Все поля объекта сохраняются корректно. | ✅ |

---

## Фаза 3: Admin + Agent × iOS

Сетап: создать компанию, пригласить агента (2й аккаунт).

### Подготовка

- [ ] Аккаунт 1: активировать компанию (premium план в SANDBOX)
- [ ] Создать приглашение (invite code)
- [ ] Аккаунт 2: зарегистрироваться по email приглашения
- [ ] Назначить агента ответственным за 1 объект
- [ ] Admin создаёт 2+ объекта (один с агентом, один без)

### Тесты

| # | Фикс | Правило | Что проверить | Статус |
|---|-------|---------|---------------|--------|
| 32 | TD-040: pending invitation | AU-REG-5 | Регистрация по email приглашения → НЕ создаётся workspace. После ввода кода → join как agent. | ✅ |
| 33 | TD-027: rate limiting invite codes | CO-INV | 5+ неправильных кодов → блокировка. | ⬜ |
| 34 | TD-084: RLS агент не видит чужие брони | BK-VIS-2 | Admin бронь на НЕ-агентском объекте → Agent не видит. | ✅ |
| 35 | TD-086: booking_agent_id | BK-EDIT-4 | Agent создаёт бронь → в БД booking_agent_id=Agent. Agent не может edit/delete бронь Admin. | ✅ |
| 36 | TD-042: деактивация сотрудника | CO-DEACT-MEMBER | Admin деактивирует Agent → блокирован, email свободен, объекты отвязаны. | ✅ |
| 37 | TD-058: agent save через draft | PR-EDIT | Agent меняет цены → draft (pending), не прямое обновление. | ✅ |
| 38 | Responsible field с компанией | PR-RESP | Admin → "Ответственный" видно. Agent → скрыто. | ✅ |

---

## Фаза 4: Admin + Agent × Web

| # | Фикс | Что проверить | Статус |
|---|-------|---------------|--------|
| 39 | TD-084+086: RLS web | Те же тесты что #34-35 на вебе. | ⬜ |
| 40 | TD-048: owners для агента web | Agent видит owners в контактах. | ⬜ |
| 41 | TD-058: agent save web | Agent меняет цены → draft flow. | ⬜ |

---

## Баги найденные при тестировании

| # | Фаза | Тест | Описание | Файл | Статус |
|---|------|------|----------|------|--------|
| B1 | — | — | mapBooking() маппит agentId: row.user_id вместо row.booking_agent_id | src/services/bookingsService.js:225 | ⬜ |
| B2 | 1 | — | MyDetailsEditModal: поле "Работаю как" по умолчанию = "Компания" вместо текущего значения (private). При сохранении ошибка. Должно показывать текущее значение. | src/components/MyDetailsEditModal.js | ✅ |
| B3 | 1 | — | Телефон профиля: сохраняется в БД (виден в PDF), но не отображается на экране "Мой аккаунт" и пропадает при повторном открытии редактирования. | src/screens/AccountScreen.js, src/components/MyDetailsEditModal.js | ✅ |
| B4 | 1 | — | MyDetailsEditModal: переключение "Частный агент" → "Компания" показывает поля компании вместо немедленного alert о premium. ИСПРАВЛЕНО: вся логика компании перенесена на отдельную страницу CompanyScreen. | src/components/MyDetailsEditModal.js | ✅ |
| B5 | 1 | — | MyDetailsEditModal: после открытия/закрытия dropdown "Работаю как" модалка остаётся растянутой по высоте. Причина: scrollHeight в onScrollLayout (строка 94) только растёт, никогда не уменьшается. minHeight фиксируется на максимуме. | src/components/MyDetailsEditModal.js:94 | ⬜ |
| B6 | 1 | — | AccountScreen: нет визуальной информации о компании. ИСПРАВЛЕНО: добавлен блок-кнопка "Company" и отдельная страница CompanyScreen с информацией, командой, модалкой редактирования. | src/screens/CompanyScreen.js, src/components/CompanyEditModal.js, src/screens/AccountScreen.js | ✅ |
| B7 | 3 | 32 | Registration.js: после регистрации через invitation профиль загружается до joinCompanyViaInvitation — isAgentRole=false. ИСПРАВЛЕНО: getCurrentUser() после join. | src/screens/Registration.js | ✅ |
| B8 | 3 | — | PropertyDetailScreen: при загрузке на секунду мелькает "название компании" вместо ответственного. Косметический timing issue. | src/screens/PropertyDetailScreen.js | ⬜ |
| B9 | 3 | — | Web: после деактивации агента визуально не обновляется статус в списке команды (данные в БД корректны). ИСПРАВЛЕНО: архив деактивированных сотрудников в сворачиваемом блоке. | src/web/components/WebTeamSection.js | ✅ |
| B10 | 3 | — | Permissions агента (can_book и др.) не обновляются в реальном времени на мобильном — нужен перезапуск. Broadcast permissions есть но UI не перерисовывается. | src/context/AppDataContext.js | ⬜ |
| B11 | 3 | 36 | Деактивированный агент сохранял активную сессию. ИСПРАВЛЕНО: broadcast member_deactivated → signOut на мобильном. | src/context/AppDataContext.js, src/services/companyChannel.js | ✅ |
| B12 | 3 | — | При регистрации агента через invitation — админ не получает уведомление и приглашение висит как неподтверждённое до перезагрузки страницы. ИСПРАВЛЕНО: broadcastChange('team') при входе агента. | src/web/components/WebTeamSection.js | ✅ |
| B13 | 3 | — | Модерация: текст "Changes rejected" при отклонении нового объекта — должно быть "Property rejected". | notifications | ⬜ |
| B14 | 3 | — | Модерация web: нет поля "Собственник" в боковом окне проверки объекта. | src/web/components/ | ⬜ |
| B15 | 3 | — | Модерация web: после одобрения объекта не переходит на страницу объекта. | src/web/screens/WebPropertiesScreen.js | ⬜ |
| B16 | 3 | — | Шрифты: после logout при деактивации некоторые строки текста растягиваются по горизонтали. Возможно side effect crash/hot reload. Наблюдать. | — | ⬜ |
| B17 | 2 | 26 | Web: кнопка "bookingConfirmation" — текст не переведён (показывает ключ), кнопка наезжает на поля окна бронирования. | src/web/screens/WebBookingsScreen.js | ⬜ |
| B18 | 2 | 26 | Web: PDF сразу открывает окно печати. Нужно: отдельная строка + две кнопки "Preview" / "Print". | src/web/screens/WebBookingsScreen.js | ⬜ |
| B19 | 2 | 23 | Web: HEIC формат не поддерживается в Chrome — загрузка фото зависает навсегда. Нужен fallback или сообщение об ошибке. | src/web/components/WebPropertyEditPanel.js | ⬜ |
| B20 | 2 | 23 | Web: спиннер загрузки фото не сбрасывается при закрытии модалки — при повторном открытии продолжает крутиться. | src/web/components/WebPropertyEditPanel.js | ⬜ |

---

## Прогресс

| Фаза | Всего | ✅ | ❌ | ⬜ | ⏭️  |
|------|-------|----|----|----|-----|
| 1. Solo Admin × iOS | 22 | 17 | 0 | 0 | 5 |
| 2. Solo Admin × Web | 9 | 8 | 0 | 0 | 1 |
| 3. Admin+Agent × iOS | 7 | 6 | 0 | 1 | 0 |
| 4. Admin+Agent × Web | 3 | 0 | 0 | 3 | 0 |
| **Итого** | **41** | **31** | **0** | **4** | **6** |
