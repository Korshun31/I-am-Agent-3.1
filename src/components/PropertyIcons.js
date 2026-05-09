/**
 * PropertyIcons — иконки для секций карточки объекта PropertyDetailScreen.
 *
 * Единый outline-стиль: stroke 1.6, round caps/joins — совпадает с
 * TabIcons.js / FolderIcons.js / EditIcons.js.
 * Активная зона геометрии ~16-18pt из 24pt viewBox.
 */

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const SW  = 1.6;
const CAP = 'round';
const JN  = 'round';

// IconPrices — ценник-бирка с дыркой
export function IconPrices({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Контур наклонной бирки — острый угол смотрит влево-вниз */}
      <Path
        d="M12 3 L20 3 L20 11 L11 20 Q10 21 9 20 L3 14 Q2 13 3 12 Z"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Дырочка для верёвки */}
      <Circle cx={16} cy={8} r={1.5}
        stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

// IconContacts — визитка: рамка, силуэт слева, две строки справа
export function IconContacts({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Рамка карточки */}
      <Rect x={2} y={5} width={20} height={14} rx={2}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      {/* Голова */}
      <Circle cx={7.5} cy={10} r={1.6}
        stroke={color} strokeWidth={SW} />
      {/* Плечи (бюст) */}
      <Path d="M4.5 15.5 Q4.5 12.6 7.5 12.6 Q10.5 12.6 10.5 15.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      {/* Две текст-строки справа */}
      <Path d="M13 10 L19 10"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Path d="M13 13 L17 13"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
    </Svg>
  );
}

// IconSpecifications — «i в круге», знак параметров/характеристик
export function IconSpecifications({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9}
        stroke={color} strokeWidth={SW} />
      {/* Вертикальная палочка «i» */}
      <Path d="M12 11 L12 17"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      {/* Точка над «i» */}
      <Circle cx={12} cy={7.8} r={1.05} fill={color} />
    </Svg>
  );
}

// IconPhoto — рамка изображения с горой и солнцем
export function IconPhoto({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Circle cx={8} cy={9} r={2}
        stroke={color} strokeWidth={SW} />
      <Path
        d="M3 17 L9 11 L14 15 L17 12 L21 17"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
    </Svg>
  );
}

// IconVideo — контур логотипа YouTube: горизонтальный
// сильно скруглённый прямоугольник + закрашенный play-треугольник по центру.
export function IconVideo({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={6} width={20} height={14} rx={4}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Path
        d="M10 9.5 L16 13 L10 16.5 Z"
        fill={color}
        stroke={color} strokeWidth={0.6} strokeLinejoin={JN}
      />
    </Svg>
  );
}

// IconDescription — лист с тремя строками текста
export function IconDescription({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3 L15 3 L19 7 L19 21 Q19 22 18 22 L6 22 Q5 22 5 21 Z"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M15 3 L15 7 L19 7"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path d="M8 10 L16 10"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Path d="M8 13.5 L16 13.5"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Path d="M8 17 L13 17"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
    </Svg>
  );
}

// IconBookingList — планшет со строками-записями (отличие от IconCalendar:
// нет сетки дней, есть строки с маркером).
export function IconBookingList({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Path d="M3 8 L21 8"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Circle cx={7} cy={12} r={0.9} fill={color} />
      <Path d="M10 12 L18 12"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Circle cx={7} cy={15.5} r={0.9} fill={color} />
      <Path d="M10 15.5 L18 15.5"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Circle cx={7} cy={19} r={0.9} fill={color} opacity={0.4} />
      <Path d="M10 19 L15 19"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.3} />
    </Svg>
  );
}

// IconAmenities — чек-лист: три галочки + линии (список удобств с отметками)
export function IconAmenities({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Галочки слева */}
      <Path d="M3.5 7.5 L5.5 9.5 L9 5.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Path d="M3.5 12.5 L5.5 14.5 L9 10.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Path d="M3.5 17.5 L5.5 19.5 L9 15.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      {/* Линии-«текст» справа */}
      <Path d="M12 7.5 L21 7.5"
        stroke={color} strokeWidth={SW * 0.85} strokeLinecap={CAP} />
      <Path d="M12 12.5 L21 12.5"
        stroke={color} strokeWidth={SW * 0.85} strokeLinecap={CAP} />
      <Path d="M12 17.5 L18 17.5"
        stroke={color} strokeWidth={SW * 0.85} strokeLinecap={CAP} />
    </Svg>
  );
}

// IconCalendarBooking — календарь со стрелкой вправо
// (отличие от IconCalendar в табе: стрелка вместо точек-дней)
export function IconCalendarBooking({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={2}
        stroke={color} strokeWidth={SW} />
      <Path d="M3 10 L21 10"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M8 3 L8 7"   stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M16 3 L16 7" stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path
        d="M8 16 L14 16"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M11.5 13 L15 16 L11.5 19"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
    </Svg>
  );
}

// IconHashtag — символ #
export function IconHashtag({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 4 L7 20"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M17 4 L15 20"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M5 9.5 L19 9.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M5 14.5 L19 14.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
    </Svg>
  );
}

// IconHouseType — силуэт одного дома: крыша + корпус + дверь.
// Расширен почти на весь viewBox чтобы визуально совпадать по размеру
// с PNG-резортом и SVG-кондо.
export function IconHouseType({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Крыша */}
      <Path
        d="M1.5 11 L12 2 L22.5 11"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Стены */}
      <Path
        d="M4 10.5 L4 22 L20 22 L20 10.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Дверь */}
      <Path
        d="M9.5 22 L9.5 14 L14.5 14 L14.5 22"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Ручка */}
      <Circle cx={13.5} cy={18.2} r={0.6} fill={color} />
    </Svg>
  );
}

// IconResortType — три одинаковых дома в композиции «посёлок»:
// один задний-верх, два передних снизу слева и справа.
export function IconResortType({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Задний дом (центр-верх) */}
      <Path
        d="M7.5 8 L12 4 L16.5 8"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M9 8 L9 13 L15 13 L15 8"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M11 13 L11 10.8 L13 10.8 L13 13"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Circle cx={12} cy={9.6} r={0.45} fill={color} />

      {/* Передний-левый дом */}
      <Path
        d="M1 16 L5.5 12 L10 16"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M2.5 16 L2.5 21 L8.5 21 L8.5 16"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M4.5 21 L4.5 18.6 L6.5 18.6 L6.5 21"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Circle cx={5.5} cy={17.5} r={0.45} fill={color} />

      {/* Передний-правый дом */}
      <Path
        d="M14 16 L18.5 12 L23 16"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M15.5 16 L15.5 21 L21.5 21 L21.5 16"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Path
        d="M17.5 21 L17.5 18.6 L19.5 18.6 L19.5 21"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      <Circle cx={18.5} cy={17.5} r={0.45} fill={color} />
    </Svg>
  );
}

// IconCondoType — два многоквартирных здания: высокое слева с антенной
// и сеткой pill-окон, ступенька-понижение справа с двумя столбцами окон, дверь.
export function IconCondoType({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Объединённый L-силуэт двух зданий */}
      <Path
        d="M2 4 L2 21 L21 21 L21 9 L13 9 L13 4 Z"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Внутренняя граница между зданиями — для наглядности ступеньки */}
      <Path
        d="M13 9 L13 21"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.5}
      />
      {/* Антенна высокого здания */}
      <Path
        d="M5 4 L5 1.5"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP}
      />

      {/* Окна высокого: 3 столбца × 4 ряда (вертикальные pill 1.2×2.4) */}
      <Rect x={3.4}  y={5.8}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={6.9}  y={5.8}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={10.4} y={5.8}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={3.4}  y={9.4}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={6.9}  y={9.4}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={10.4} y={9.4}  width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={3.4}  y={13.0} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={6.9}  y={13.0} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={10.4} y={13.0} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />

      {/* Дверь высокого внизу */}
      <Path
        d="M6.5 21 L6.5 17 L8.5 17 L8.5 21"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />

      {/* Окна низкого: 2 столбца × 3 ряда */}
      <Rect x={15.0} y={10.6} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={18.0} y={10.6} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={15.0} y={14.2} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={18.0} y={14.2} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={15.0} y={17.8} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
      <Rect x={18.0} y={17.8} width={1.2} height={2.4} rx={0.6} stroke={color} strokeWidth={SW * 0.75} />
    </Svg>
  );
}
