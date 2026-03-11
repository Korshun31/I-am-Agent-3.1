# История работы над сборкой и TestFlight (I am Agent 3.1)

Документ восстанавливает ключевую информацию из переписки по проекту.

---

## Два шага выгрузки в TestFlight

1. **Build** — сборка приложения:
   ```bash
   npm run build:ios
   ```
   (выполняет verify-build, затем `eas build --platform ios --profile production`)

2. **Submit** — выгрузка IPA в TestFlight:
   ```bash
   eas submit --platform ios --profile production --latest
   ```
   `--latest` использует последнюю успешную сборку.

---

## Что нужно было обновить перед последней попыткой (из-за этого submit упал)

Перед `eas submit` должны были быть обновлены:

| Файл | Что | Было (ошибка) | Нужно было |
|------|-----|---------------|------------|
| `eas.json` | `appVersionSource` | `"remote"` | `"local"` |
| `app.json` | `ios.buildNumber` | меньше или равно 10 | `"11"` (больше последнего в App Store Connect) |

Итог: submit пытался отправить build 10, который уже был в App Store Connect — Apple отклонил дубликат.

---

## Проблема с Build Number (подробнее)

- При `appVersionSource: "remote"` EAS брал версию/build с серверов, из-за чего отправлялась уже использованная сборка (build 10) — Apple отклонял дубликат.
- **Исправлено:**
  - `eas.json`: `appVersionSource` → `"local"` (версия и build берутся из app.json)
  - `app.json`: `ios.buildNumber` → `"11"` (следующая сборка будет с номером 11)

---

## Что было в последней версии (до проблем с квотой)

- Календарь: прошедшие даты серым (#bababe), патч `patch-calendar-eu-week.js`
- Календарь бронирований: фикс позиции полосок по месяцам, парсинг дат YYYY-MM-DD
- Экран статистики в Account
- Иконка без белых отступов
- Миграция `created_at` для bookings в Supabase

---

## Текущее состояние

- **buildNumber:** 11 (готово к следующей сборке)
- **appVersionSource:** local
- Бесплатные сборки EAS израсходованы — следующий build возможен после сброса квоты или оформления платного плана.

---

## Перед следующим build

1. `npm run verify-build` — проверка патча календаря
2. Убедиться, что `app.json` → `ios.buildNumber` больше последнего отправленного в App Store Connect
3. `npm run build:ios`
4. После успешной сборки: `eas submit --platform ios --profile production --latest`
