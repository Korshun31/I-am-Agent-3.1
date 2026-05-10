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
