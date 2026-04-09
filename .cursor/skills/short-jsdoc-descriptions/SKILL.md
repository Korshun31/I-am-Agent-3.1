---
name: short-jsdoc-descriptions
description: Adds one-line or brief JSDoc/block comments above React components, hooks, and functions (what it does, key props or return value). Use when creating or editing components or functions, when refactoring exports, or when the user asks for краткое описание, JSDoc, or комментарий к компоненту/функции.
---

# Краткие описания компонентов и функций

## Когда применять

- Новый или изменённый **компонент**, **экран**, **хук**, **функция в сервисе**.
- Пользователь просит «короткое описание», «JSDoc», «комментарий к функции/компоненту».

## Правила

1. **Коротко**: одна строка смысла; при необходимости вторая — неочевидное поведение (сайд-эффекты, ограничения).
2. **Что делает**, а не как реализовано внутри. Не дублировать очевидное из имени (`getUserById` → не «получает пользователя по id» без добавленной ценности).
3. **Компоненты**: зачем существует блок UI; при необходимости кратко перечислить важные `props` в `@param` или в одной фразе.
4. **Функции/хуки**: вход/выход или контракт, если неочевиден (`@returns`, важные аргументы).
5. **Язык**: как в окружающем файле (в проекте чаще английий в коде; если файл смешанный — приоритет стиля файла).
6. Не раздувать: без очевидных `@param` для каждого примитива; без длинных докблоков «на будущее».

## Формат (по умолчанию JSDoc)

```javascript
/**
 * Booking row in the list: shows dates, property title, and status chip.
 */
export function BookingListRow({ booking, onPress }) { ... }

/**
 * Returns overlapping bookings for the property in the given interval, or [].
 */
export async function findOverlappingBookings(propertyId, start, end) { ... }
```

Для простых внутренних хелперов достаточно одной строки `// ...`, если так принято в файле.

## Анти-паттерны

- Пустые шаблоны `@param {Object} props`.
- Комментарии, которые повторяют название без новой информации.
- Удаление или переписывание существующих полезных комментариев без причины.

## Связь с проектом

- Компоненты: `src/components/`, `src/web/components/`, экраны: `src/screens/`, `src/web/screens/`.
- Сервисы: `src/services/` — описывать публичные экспорты и нетривиальную логику.
