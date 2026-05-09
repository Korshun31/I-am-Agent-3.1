/**
 * Кастомный SVG-иконсет для нижнего таб-бара — v8.
 *
 * Единый outline-стиль для всех состояний (активная и неактивная).
 * В активном состоянии иконка просто меняет цвет на насыщенный — без заливки.
 *
 * Семейство:
 *   1. База      — домик с дверью (по референсу Figma)
 *   2. Брони     — gantt: вертикальный рейл + три горизонтальные полосы
 *   3. Календарь — сетка месяца с шапкой и кольцами
 *   4. Аккаунт   — человечек: голова + плечи (по референсу Figma)
 *
 * Все иконки: stroke only, weight 1.6, round caps/joins.
 * Цвет задаётся пропом color (серый для неактивной, насыщенный для активной).
 */

import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const SW  = 1.6;
const CAP = 'round';
const JN  = 'round';

// ─────────────────────────────────────────────────────────────
// 1. База — домик с дверью
// ─────────────────────────────────────────────────────────────
export function IconProperties({ size = 24, color = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Корпус домика: крыша-треугольник + стены */}
      <Path
        d="M4 11 L12 4 L20 11 L20 19 Q20 20 19 20 L5 20 Q4 20 4 19 Z"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Дверь: проём без нижней линии */}
      <Path
        d="M10 20 L10 14 L14 14 L14 20"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
      {/* Ручка двери */}
      <Circle cx={13} cy={17.3} r={0.5} fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Брони — gantt (вертикальный рейл + три горизонтальные полосы)
// ─────────────────────────────────────────────────────────────
export function IconBookings({ size = 24, color = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Вертикальный рейл — ось времени */}
      <Path d="M5 4 L5 20" stroke={color} strokeWidth={SW * 0.7} strokeLinecap={CAP} strokeOpacity={0.5} />
      {/* Полоса 1 — длинная */}
      <Rect x={7} y={5} width={12} height={4} rx={1.2}
        stroke={color} strokeWidth={SW} />
      {/* Полоса 2 — средняя */}
      <Rect x={7} y={11} width={9} height={4} rx={1.2}
        stroke={color} strokeWidth={SW} />
      {/* Полоса 3 — короткая */}
      <Rect x={7} y={17} width={6} height={3} rx={1}
        stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Календарь — сетка месяца с шапкой и двумя кольцами
// ─────────────────────────────────────────────────────────────
export function IconCalendar({ size = 24, color = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Тело календаря */}
      <Rect x={3} y={5} width={18} height={16} rx={2}
        stroke={color} strokeWidth={SW} />
      {/* Линия отбивающая шапку */}
      <Path d="M3 10 L21 10" stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      {/* Два кольца крепления */}
      <Path d="M8 3 L8 7" stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      <Path d="M16 3 L16 7" stroke={color} strokeWidth={SW} strokeLinecap={CAP} />
      {/* Точки-дни 3×2: верхний ряд + нижний с выделенным «сегодня» */}
      <Circle cx={7.5}  cy={14} r={0.9} fill={color} opacity={0.5} />
      <Circle cx={12}   cy={14} r={0.9} fill={color} opacity={0.5} />
      <Circle cx={16.5} cy={14} r={0.9} fill={color} opacity={0.5} />
      <Circle cx={7.5}  cy={17.5} r={0.9} fill={color} opacity={0.5} />
      <Circle cx={12}   cy={17.5} r={1.4} fill={color} />
      <Circle cx={16.5} cy={17.5} r={0.9} fill={color} opacity={0.5} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Аккаунт — человечек: голова + плечи
// ─────────────────────────────────────────────────────────────
export function IconAccount({ size = 24, color = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Голова */}
      <Circle cx={12} cy={8.5} r={3.5}
        stroke={color} strokeWidth={SW} />
      {/* Плечи — плавная дуга */}
      <Path
        d="M5 20 C 5 15.5, 19 15.5, 19 20"
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN}
      />
    </Svg>
  );
}
