# Module: UI Infrastructure

## Скоуп

Модуль покрывает: запуск приложения, проверку сессии, платформенное разделение (мобильный vs веб), загрузку данных, обёртки контекстов, Preloader.

**Файлы модуля:**
- `App.js` — корневой компонент, маршрутизация: preloader → login → main
- `src/context/AppDataContext.js` — общее хранилище данных (мобильный и веб с 2026-05-04, коммит `84e6508`)
- `src/context/UserContext.js` — текущий пользователь
- `src/context/LanguageContext.js` — язык и валюта
- `src/screens/Preloader.js` — экран загрузки
- `src/navigation/MainNavigator.js` — навигация с вкладками (мобильный)
- `src/web/WebMainScreen.js` — главный экран с боковым меню (веб)

## Правила

### Запуск приложения

**UI-1.** Порядок при запуске:
1. Показывается Preloader (экран загрузки с логотипом)
2. Проверяется сессия (`getCurrentUser()`)
3. Если сессия есть → загружается профиль → рабочий экран
4. Если нет → экран входа

**UI-1.1.** *(TD-019, закрыт 2026-04-30)* Стадия `screen === 'preloader'` в `App.js` теперь рендерит `<Preloader />` на обеих платформах. Залогиненный пользователь больше не видит мелькание Login при перезагрузке.

### Платформенное разделение

**UI-2.** После входа:
- Телефон → `MainNavigator` (вкладки внизу) обёрнут в `AppDataProvider`
- Компьютер → `WebMainScreen` (боковое меню) тоже обёрнут в `AppDataProvider`

**UI-3.** *(обновлено 2026-05-04, коммит `84e6508`)* Обе платформы используют единый `AppDataContext`: данные загружаются один раз при старте и хранятся в памяти, переключение между экранами мгновенное. Раньше веб загружал данные на каждом экране отдельно — это историческая практика, замена сделана для уменьшения дубля кода между мобильным и вебом и более быстрых экранов.

### Загрузка данных (мобильный)

**UI-4.** `AppDataContext` загружает при старте:
- Properties (`getProperties`)
- Bookings (`getBookings`)
- Contacts (`getContacts`)
- Calendar Events (`getCalendarEvents`)

Прогресс: 4 × 25%. Preloader показывает процент.

**UI-5.** `refreshX()` функции обновляют данные после мутаций. Вызываются из broadcast callbacks (SY-4) и после CRUD операций.

### Обёртки контекстов

**UI-6.** Порядок (сверху вниз):
1. `ErrorBoundary` — ловит ошибки, показывает экран вместо белого
2. `SafeAreaProvider` — безопасные отступы для iPhone
3. `UserProvider` — текущий пользователь
4. `NavigationContainer` — навигация
5. `LanguageProvider` — язык и валюта
6. `AppContent` — маршрутизация (preloader/login/main)
7. `AppDataProvider` — данные (мобильный и веб, внутри main)

Порядок важен: язык загружается из профиля пользователя, поэтому `UserProvider` выше `LanguageProvider`.

### Auth state listener

**UI-7.** Слушает события Supabase Auth: если сессия истекла или пользователь вышел → автоматический переход на экран входа (AU-SESSION-3).

### Приглашения через URL

**UI-8.** На вебе: если URL содержит `?token=...` → показывается `WebInviteAcceptScreen` вместо обычного приложения (CO-JOIN-2 Путь A).

### Notification handler

**UI-9.** На мобильном: настроен обработчик уведомлений — показывает баннер и звук для локальных уведомлений. На вебе пропускается.

### Сравнение веб vs мобильный

| Аспект | Мобильный | Веб | Совпадает? |
|---|---|---|---|
| Preloader при старте | ✅ | ✅ (TD-019 закрыт 2026-04-30) | ✅ |
| Навигация | Вкладки внизу | Боковое меню | Допустимая разница |
| Хранилище данных | ✅ AppDataContext | ✅ AppDataContext (с 2026-05-04) | ✅ |
| ErrorBoundary | ✅ | ✅ | ✅ |
| Auth state listener | ✅ | ✅ | ✅ |
| Invite token в URL | — | ✅ | ✅ |

## Связь с другими модулями

| Модуль | Связь |
|---|---|
| **Auth & Session** | Session check (AU-SESSION-1), auth state listener (AU-SESSION-3), Preloader (AU-SESSION-2) |
| **Company & Team** | Invite accept через URL (CO-JOIN-2) |
| **Sync & Realtime** | AppDataContext подписан на broadcast (SY-4) |
| **i18n** | LanguageProvider обёрнут в UserProvider |
| **Все модули** | AppDataContext обеспечивает данные для всех экранов (мобильных и веб) |

## Известные пробелы и TD

| TD | Описание | Приоритет |
|---|---|---|
| **TD-019** | ✅ ЗАКРЫТ 2026-04-30 — `App.js` рендерит `<Preloader />` на стадии preloader для обеих платформ | Закрыт |

## Адаптивные мобильные модалки

Цель: одна и та же мобильная модалка должна выглядеть одинаково красиво на iPhone SE (375pt), iPhone 16 (393pt), iPhone Pro Max (440pt) и на любом телефоне между ними. Принцип «протестировал на одном устройстве — на остальных тоже ляжет правильно».

### Утилита масштабирования

**UI-10.** Все размеры внутри мобильной модалки масштабируются через утилиту [src/utils/scale.js](src/utils/scale.js):

```js
import { Dimensions } from 'react-native';
const REFERENCE_WIDTH = 440;   // ширина iPhone Pro Max в point — на ней scale = 1.0
const MIN_SCALE = 0.85;        // нижний пол, чтобы шрифты не уезжали в нечитаемое
const width = Dimensions.get('window').width;
export const SCALE = Math.max(MIN_SCALE, Math.min(1, width / REFERENCE_WIDTH));
export function sz(n) { return Math.round(n * SCALE); }
```

Получается: SE → SCALE ≈ 0.85, iPhone 16 → ≈ 0.89, Pro Max → 1.0. На любом устройстве в этом диапазоне scale считается ровно один раз при загрузке модуля.

**UI-10.1.** Импортировать в файл модалки:

```js
import { sz, SCALE } from '../utils/scale';
```

Если в файле уже есть переменная `s = StyleSheet.create({...})` — НЕ переименовывать её в `s` для helper-а. Использовать `sz` (это «size scaled»). Иначе будет конфликт имён.

**UI-10.2.** Все числовые литералы у следующих свойств в `StyleSheet.create({...})` оборачиваются в `sz()`:

`fontSize`, `lineHeight`, `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `paddingHorizontal`, `paddingVertical`, `margin`, `marginTop`, `marginBottom`, `marginLeft`, `marginRight`, `marginHorizontal`, `marginVertical`, `borderRadius`, `gap`, `columnGap`, `rowGap`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `borderWidth`, `borderTopWidth`, `borderBottomWidth`, `borderLeftWidth`, `borderRightWidth`.

Пример пакетной замены через `sed` (BSD/macOS):

```sh
sed -E -i '' '<startLine>,$s/(fontSize|lineHeight|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingHorizontal|paddingVertical|margin|marginTop|marginBottom|marginLeft|marginRight|marginHorizontal|marginVertical|borderRadius|gap|columnGap|rowGap|width|minWidth|maxWidth|height|minHeight|maxHeight|borderWidth|borderTopWidth|borderBottomWidth|borderLeftWidth|borderRightWidth): ([0-9]+)/\1: sz(\2)/g' <file>
```

Где `<startLine>` — номер строки `StyleSheet.create({` в этом файле. Регекс `[0-9]+` ловит только целые числа — десятичные значения вроде `borderWidth: 1.5` чинятся отдельно: `sed -i '' 's/sz(1)\.5/sz(1.5)/g' <file>`. После любого пакетного `sed` обязательно `node -e "require('@babel/parser').parse(require('fs').readFileSync('<file>','utf8'),{sourceType:'module',plugins:['jsx']})"` для проверки синтаксиса.

**UI-10.3.** Иконки. Числовые `size={N}` у иконок (Ionicons и т.п.) оборачиваются в `sz()`:

```jsx
<Ionicons name="close" size={sz(20)} color="#6B6B6B" />
```

**UI-10.4.** Нативный Switch (родной iOS-переключатель) сам не масштабируется — его сжимаем через `transform`:

```jsx
<Switch
  style={{ transform: [{ scale: SCALE }] }}
  value={...}
  onValueChange={...}
/>
```

Тот же приём — для системного DatePicker, любого нативного компонента с фиксированными внутренними размерами.

**UI-10.5.** Что НЕ масштабируется через `sz`:

- Внешний каркас модалки (`src/components/ModalScrollFrame.js`) — общий для всех модалок. Его пропорция «модалка ужимается под окно» уже сделана и работает; внутренний контент живёт по `sz()`.
- Формулы внутри сторонних либ, у которых уже есть собственное масштабирование (например `react-native-calendar-range-picker` — патчится через `scripts/patch-calendar-eu-week.js`, имеет внутреннюю переменную `__scale` от ширины блока месяца).
- Inline-вычисления в JSX, использующие `Dimensions.get('window').width/height` — оставлять как есть, не трогать.
- Цветовые значения, `opacity`, `flex`, `zIndex`, проценты-строки (`width: '100%'`).

### Ритмика отступов в формах

**UI-11.** В каждой модалке с формой объявляются две константы сразу после импортов:

```js
const LABEL_GAP = 6;   // отступ между подписью (label) и её полем — тесная связь
const BLOCK_GAP = 16;  // отступ между блоком «label+field» и следующим блоком
```

**UI-11.1.** У всех стилей подписей блоков (`fieldLabel`, `fieldLabelStep2`, аналогичные `*Label`) ставится `marginBottom: sz(LABEL_GAP)`.

**UI-11.2.** У всех стилей полей ввода (`input`, `inputWithIconRow`, `dateField`, `selectField`, `timeInput`, аналогичные) ставится `marginBottom: sz(BLOCK_GAP)`.

**UI-11.3.** Композитные поля (когда вместо обычного TextInput идёт несколько элементов в строку — например `PercentMoneyField` с TextInput + кнопками `$/%`) обязательно оборачиваются в `<View style={{ marginBottom: sz(BLOCK_GAP) }}>`. Внутренний TextInput при этом получает `marginBottom: 0`, чтобы не было двойного отступа.

Антипаттерн (приводит к рваной ритмике):

```jsx
return (
  <>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput style={[s.input, { marginBottom: 0 }]} ... />
      <Buttons ... />
    </View>
  </>
);
```

Правильно:

```jsx
return (
  <View style={{ marginBottom: sz(BLOCK_GAP) }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: sz(8) }}>
      <TextInput style={[s.input, { marginBottom: 0 }]} ... />
      <Buttons ... />
    </View>
  </View>
);
```

### Чек-лист «применить правила к модалке X»

1. Импортировать `sz, SCALE` из `../utils/scale`.
2. Объявить `LABEL_GAP = 6`, `BLOCK_GAP = 16` после импортов.
3. Найти строку `const s = StyleSheet.create({` — запомнить её номер.
4. Прогнать `sed` с регексом из UI-10.2 от этой строки до конца файла.
5. Починить десятичные числа (`sz(1).5` → `sz(1.5)`) одним отдельным `sed`.
6. Пройтись по JSX: все `size={N}` у иконок → `size={sz(N)}`.
7. Все `<Switch>` и нативные пикеры обернуть в `style={{ transform: [{ scale: SCALE }] }}`.
8. У всех `*Label` стилей выставить `marginBottom: sz(LABEL_GAP)`.
9. У всех стилей полей выставить `marginBottom: sz(BLOCK_GAP)`.
10. Композитные поля (фрагменты `<>` или строки с несколькими элементами) обернуть в `<View style={{ marginBottom: sz(BLOCK_GAP) }}>`, внутренний TextInput с `marginBottom: 0`.
11. Прогнать babel-parser sanity check (`node -e "..."` из UI-10.2).
12. Запустить Metro с `--clear`, посмотреть модалку на iPhone SE / 16 / 17 Pro Max — на всех должна выглядеть одинаково ритмично, отличаясь только пропорционально.

### Эталон

[src/components/AddBookingModal.js](src/components/AddBookingModal.js) — первая модалка, к которой применены правила UI-10 и UI-11. Использовать как референс при адаптации остальных модалок.

## Брендовые цвета и интерактивные элементы

### Палитра акцента

**UI-12.** Бренд-цвет приложения — `#3D7D82` (тёмно-бирюзовый). В каждом файле модалки в `COLORS` объявляются три производные:

```js
const COLORS = {
  accent: '#3D7D82',                    // основной зелёный — текст, иконки, активный track Switch
  accentBg: 'rgba(61,125,130,0.06)',    // полупрозрачный фон выбранных/активных элементов
  accentBorder: 'rgba(61,125,130,0.5)', // полупрозрачный контур кнопок
  ...
};
```

Эти три значения используются везде где в UI появляется зелёный — кнопки действия, активные сегменты, выбранные опции. Сплошной `#3D7D82` без полупрозрачности — только в `track` нативного Switch и в иконках.

### Кнопки действия (Далее, Назад, Сохранить)

**UI-13.** Все кнопки действия в модалках оформлены в едином стиле «контур + полупрозрачный фон + цветной текст»:

```js
nextBtn: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: sz(13),
  borderRadius: sz(12),
  borderWidth: sz(1),
  borderColor: COLORS.accentBorder,
  backgroundColor: COLORS.accentBg,
  gap: sz(6),
  minHeight: sz(46),
},
nextBtnText: { fontSize: sz(15), fontWeight: '600', color: COLORS.accent },
```

Запрещено: сплошная заливка `backgroundColor: '#3D7D82'` с белым текстом для основной кнопки. Это даёт «тяжёлый» вид и не сочетается с остальным интерфейсом.

### Нативный Switch

**UI-14.** Любой `<Switch>` в мобильной модалке обязательно получает три цветовых пропса плюс масштаб (UI-10.4):

```jsx
<Switch
  style={{ transform: [{ scale: SCALE }] }}
  trackColor={{ false: '#D1D1D6', true: '#3D7D82' }}
  thumbColor="#FFFFFF"
  ios_backgroundColor="#D1D1D6"
  value={...}
  onValueChange={...}
/>
```

`trackColor.true` — единственное место в UI, где допустима сплошная заливка `#3D7D82` (это родной iOS-стиль зелёного переключателя).

### Сегментированные тогглеры (например $/%)

**UI-15.** Тогглер из двух или трёх кнопок-сегментов оформляется по схеме «общий контур + выделение выбранного полупрозрачным фоном и зелёным текстом»:

```jsx
<View style={{
  flexDirection: 'row',
  borderRadius: sz(7),
  borderWidth: sz(1),
  borderColor: COLORS.border,
  overflow: 'hidden',
}}>
  <TouchableOpacity
    onPress={() => setActive('a')}
    style={{
      paddingHorizontal: sz(12),
      paddingVertical: sz(13),
      backgroundColor: active === 'a' ? COLORS.accentBg : COLORS.inputBg,
    }}
  >
    <Text style={{
      fontSize: sz(13),
      fontWeight: '700',
      color: active === 'a' ? COLORS.accent : '#666',
    }}>{labelA}</Text>
  </TouchableOpacity>
  {/* остальные сегменты — по той же схеме */}
</View>
```

Запрещено: сплошная заливка `#3D7D82` с белым текстом для выбранного сегмента. Единственный исключительный случай со сплошным акцентом — нативный Switch (UI-14).

---

**UI-16.** Типографическая шкала. Все размеры шрифтов и иконок в мобильном приложении берутся из четырёх ступеней, объявленных в [src/utils/scale.js](src/utils/scale.js):

```js
export const FONT = {
  title: 22,    // заголовок экрана, иконки нижнего меню
  body: 16,     // основной текст: поиск, имена объектов, кнопки навигации, иконки в шапках (лупа, +, chevron)
  label: 14,    // вторичный текст в плотных местах: коды объектов, даты в полосках броней, шапки месяцев в календаре, имя клиента в баре
  caption: 12,  // мелкая подпись: бейджи, ярлыки статуса, минимальная техническая разметка
};
```

**UI-16.1.** Жирность тоже централизована:

```js
export const WEIGHT = {
  bold: '700',      // акценты: имя клиента в полоске, номер брони, активная вкладка в нижнем меню
  semibold: '600',  // заголовки секций
  regular: '400',   // обычный текст
};
```

**UI-16.2.** На новом экране импортировать и использовать через семантические имена, а не цифры:

```jsx
import { FONT, WEIGHT } from '../utils/scale';
// ...
<Text style={{ fontSize: FONT.body, fontWeight: WEIGHT.regular, color: '#2C2C2C' }}>Имя объекта</Text>
<Text style={{ fontSize: FONT.label, color: '#888' }}>Код APT-001</Text>
<Ionicons name="search" size={FONT.body} color="#888" />
```

**UI-16.3.** `FONT` и `WEIGHT` НЕ оборачиваются в `sz()` — это «голые» значения, одинаковые на всех экранах. Если на конкретном узком месте (модалка, плотная колонка) текст переполняется, тогда точечно: `fontSize: sz(FONT.body)`. Глобально оборачивать всё подряд запрещено — иначе на iPhone SE текст становится неожиданно мелким, а это противоречит самой идее единой шкалы.

**UI-16.4.** Промежуточные размеры (15, 17, 19pt и т.д.) запрещены. Если в макете дизайнера попадается промежуточная цифра — округляем к ближайшей ступени FONT, а не плодим хаос. Исключения зафиксированы в UI-16.5 ниже. В модалках с `sz()`-масштабированием (UI-10) допускаются произвольные числа, но и там при возможности предпочитать FONT-ступень.

**UI-16.5.** Готовые роли с эталонными значениями. Применять как пресеты на новых экранах:

**Заголовок экрана** (`headerTitle`) — `fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: '#2C2C2C'`. Это особый случай вне FONT-шкалы, единый эталон для всех экранов («База», «Календарь броней», «Карточка объекта»). Переопределять размер запрещено.

**Стрелка назад** — `<Ionicons name="chevron-back" size={20} color="#2C2C2C" />`. Не использовать текстовый символ «‹».

**Иконки действий в шапке экрана** (мусорка, карандаш, плюс, колокольчик уведомлений, IconContacts/IconBookings/IconPhoto и подобные секционные иконки, кнопка раскрытия/сворачивания) — 22pt, цвет `#888`. Активное состояние акцентным цветом `#3D7D82`.

**Заголовок секции внутри карточки** (`sectionTitle`) — `fontSize: FONT.body, fontWeight: '600', color: '#2C2C2C'`.

**Пара «метка / значение»** в полях информации:
- метка — `fontSize: FONT.label, color: '#6B6B6B'` (regular)
- значение — `fontSize: FONT.body, fontWeight: '600', color: '#1C1C1E'`
- значение-ссылка (кликабельная сущность) — добавить `color: '#3D7D82'`

**Имя сущности в строке списка** (объект на «Базе», апартамент в комплексе) — `fontSize: FONT.body, fontWeight: '600', color: '#2C2C2C'`. **Код сущности** рядом — `fontSize: FONT.label, fontWeight: '600', color: '#3D7D82'`.

**Полоска брони в календаре** (имя клиента + даты) — `fontSize: FONT.label, fontWeight: '700'`.

**Цена**: метка — `fontSize: FONT.label, fontWeight: '400'`; значение (акцент) — `fontSize: FONT.body, fontWeight: '700'`.

**Длинный читаемый абзац** (описание объекта) — `fontSize: FONT.body, lineHeight: 22, color: '#2C2C2C'`.

**Иконки контактных действий в строках** (телефон, WhatsApp, Telegram в кружках 32×32) — 22pt, цвет `#888`. То же правило что и для шапочных действий.

**Лупа в поле поиска** — `size={FONT.body} color="#999"`. Воронка фильтра — 18pt намеренно мельче (визуально вторична).

**Подпись поля в форме редактирования** (`fieldLabel` в визарде объекта — «АДРЕС», «ГОРОД», «СОБСТВЕННИК») — `fontSize: FONT.caption (12), fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase', color: COLORS.label`. Это специальный КАПС-стиль iOS-форм (как в Settings), вне обычной label/value-пары. На другие экраны не переносить — только для подписей над полями в визардах редактирования.

**Декоративные индикаторы вне текстовой иерархии** (значок ▶ на превью видео и подобные оверлеи на медиа) — могут быть крупнее (28pt). Это исключение из шкалы по функции — индикаторы воспроизведения в iOS традиционно 28-32pt.

**Референс применения:** [src/screens/RealEstateScreen.js](src/screens/RealEstateScreen.js), [src/screens/BookingCalendarScreen.js](src/screens/BookingCalendarScreen.js), [src/screens/PropertyDetailScreen.js](src/screens/PropertyDetailScreen.js), [src/screens/BookingDetailScreen.js](src/screens/BookingDetailScreen.js) и [src/components/OwnerInfoRow.js](src/components/OwnerInfoRow.js) — экраны и общий компонент, переведённые на шкалу. Использовать как образец при адаптации остальных экранов.

**UI-16.6.** Готовые пресеты по типам элементов — копируются в новый экран/модалку без подгонки чисел. Если в существующем экране стоят другие значения — считать это отклонением и приводить к этим, не наоборот.

**Шапка экрана** (`header`). Контейнер экрана: `paddingTop: TOP_INSET` (`Constants.statusBarHeight + 12`). Сама шапка: `flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14`. Слева — кнопка назад 36×36 со стрелкой `<Ionicons name="chevron-back" size={20} color="#2C2C2C" />`. Справа — пустой `<View>` 36 для центрирования заголовка, либо кнопки действий.

**Ряд действий под шапкой** (`actionsRow`). `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 20`. Слева — кнопка удаления (`<Ionicons name="trash-outline" size={22} color="#888" />`). Справа — группа в `<View style={{ flexDirection: 'row', gap: 12 }}>` (PDF, редактирование, добавить и т.д.). Кнопка-кружок: `width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center'`.

**Иконка редактирования** — `<IconPencil size={22} color="#888" />` из [src/components/EditIcons.js](src/components/EditIcons.js). Не использовать `<Ionicons name="create-outline" />` — это другой визуал.

**Поле ввода и его варианты** (`input`, `selectField`, `readOnlyField`, `dateField`, `timeSelectRow`, `reminderTriggerBtn`, `inputWithIconRow`) — единый каркас: `backgroundColor: COLORS.inputBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: COLORS.title, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, minHeight: 46`. `fontWeight` у текста ввода НЕ задавать (regular). Иконка слева внутри поля (типа `card-outline`) — 16pt `#6B6B6B`. Стрелка-шеврон справа (открыть селект) — `<Ionicons name="chevron-down" size={14} color="#6B6B6B" />`.

**Подпись поля КАПС** (`fieldLabel`) — `fontSize: 12, fontWeight: '600', color: COLORS.label, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8`. Применяется только в модалках-визардах редактирования (объект, бронь, контакт). На детальных экранах для пары «метка/значение» использовать обычный label 14 (UI-16.5).

**Заголовок секции с иконкой** (`sectionTitleRow` + `sectionTitleText` или `mediaSectionTitleRow` + `mediaSectionTitle`). Контейнер: `flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10–12`. Иконка слева — 22pt `#888`, тонкая монохромная: из [src/components/PropertyIcons.js](src/components/PropertyIcons.js) (`IconPhoto`, `IconVideo`, `IconPrices`), [src/components/TabIcons.js](src/components/TabIcons.js) (`IconCalendar`, `IconBookings`, `IconContacts`), либо `<Ionicons name="...-outline" size={22} color="#888" />`. НЕ использовать цветные PNG-картинки. Текст заголовка — `fontSize: 16, fontWeight: '600', color: COLORS.title`. Жирность строго 600, не 700.

**Карточка модалки-визарда** (через `ModalScrollFrame`). Параметры: `boxStyle={{ backgroundColor: '#FFFFFF' }}` (сплошной белый, не полупрозрачный), `boxWrapStyle={{ maxWidth: 380 }}` (узкая колонка). В шапке — заголовок 20/600/-0.3, крестик `<Ionicons name="close" size={22} color="#888" />`, кнопка крестика 36×36 без `sz`. Сразу под шапкой — ряд точек прогресса (см. ниже).

**Точки прогресса визарда** (`dotsRow` + `dot`/`dotPassed`/`dotActive`). Ряд: `flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 14, paddingBottom: 16`. Каждая точка `width: 6, height: 6, borderRadius: 3`. Цвета: `dot: '#E5E5EA'`, `dotPassed: '#B0B0B5'`, `dotActive: '#3D7D82'`.

**Кнопки навигации Назад / Далее / Сохранить** в визарде (`navRow` + `navBtn` + `navBtnNext` + `navBtnSave` + текст). Ряд: `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)'`. Кнопка: `paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12`. Текст: `fontSize: 16, fontWeight: '600'`. **Назад** — серый `#6B6B6B`, без рамки и фона, стрелка символом `‹` прямо в тексте (`‹  Назад`). **Далее/Сохранить** — `borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: 'transparent'`, текст цвета `COLORS.accent`, стрелка символом `›` в тексте (`Далее  ›`). Заливка `accentBg` под этими кнопками запрещена (это UI-15-исключение).

**Промежуточная иконка сохранения посередине ряда навигации** (`navSaveIconBtn`) — `width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center'`. Иконка внутри — `assets/icon-save-new.png` 22×22, `tintColor: '#888'`. При disabled — `tintColor: '#C7C7CC'`. Показывается на всех шагах кроме последнего (там основная кнопка справа уже «Сохранить»).

**Подмодалка-пикер** (внутри основной модалки — выбор клиента, собственника, ответственного, уведомлений). Фон: `pickerBackdrop` поверх всего, `padding: 24`. Коробка пикера: `width: '100%', maxWidth: 400, maxHeight: '80%', backgroundColor: COLORS.boxBg (полупрозрачный белый rgba(255,255,255,0.72) + BlurView), borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden'`. Шапка пикера: `paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)'`. Заголовок пикера: `fontSize: 16, fontWeight: '600', color: COLORS.title` — это специально 16, а не 20 (подмодалка вторична). Закрывающий крестик — `<Ionicons name="close" size={22} color="#888" />`. Кнопка-действие внизу (`selectBtn`) — оформлена строго как `navBtnNext` (контур accent, без заливки).

**Адаптация под маленькие экраны (`sz`)**. На уровне детальных экранов и подмодалок-пикеров `sz()` НЕ применяется — все числа из этих пресетов фиксированные. Утилита `sz` остаётся для очень плотных модалок-форм (UI-10), но при возможности предпочитать FONT-шкалу и фиксированные цифры. `SCALE` (без оборачивания) сохраняется для нативного `<Switch>` через `transform: [{ scale: SCALE }]`.

**Референс применения UI-16.6:** [src/components/PropertyEditWizard.js](src/components/PropertyEditWizard.js) и [src/components/AddBookingModal.js](src/components/AddBookingModal.js) — модалки-визарды, [src/screens/PropertyDetailScreen.js](src/screens/PropertyDetailScreen.js) и [src/screens/BookingDetailScreen.js](src/screens/BookingDetailScreen.js) — детальные экраны, [src/screens/RealEstateScreen.js](src/screens/RealEstateScreen.js) и [src/screens/BookingCalendarScreen.js](src/screens/BookingCalendarScreen.js) — главные списки. При работе с новым экраном сначала прочитать UI-16.6, затем заглянуть в любой из этих файлов как образец.
