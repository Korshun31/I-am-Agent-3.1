/**
 * FolderIcons — иконки для кнопки «свернуть/развернуть все карточки».
 *
 * Метафора — не папка, а сам список объектов:
 *   IconFolderClosed  — три плотные равные полосы (карточки свёрнуты в строки)
 *   IconFolderOpen    — первая полоса шире + indent + две строки под ней
 *                       (карточка раскрыта, детали видны)
 *
 * Единый outline-стиль: stroke 1.6, round caps/joins — совпадает с TabIcons.js.
 */

import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

const SW  = 1.6;
const CAP = 'round';
const JN  = 'round';
const RX  = 1.2; // скругление углов полос

// ─────────────────────────────────────────────────────────────
// Свёрнуто: три одинаковые полосы — карточки-строки
// ─────────────────────────────────────────────────────────────
export function IconFolderClosed({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5}  width={18} height={3.8} rx={RX}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Rect x={3} y={10.1} width={18} height={3.8} rx={RX}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      <Rect x={3} y={15.2} width={18} height={3.8} rx={RX}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Развёрнуто: первая карточка «открыта» — высокая рамка,
// внутри indent + две строки-деталей, под ней обычная строка
// ─────────────────────────────────────────────────────────────
export function IconFolderOpen({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Раскрытая карточка — высокий блок */}
      <Rect x={3} y={3} width={18} height={11} rx={RX}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
      {/* Детали внутри: две строки с indent */}
      <Path d="M6 7.5 L18 7.5"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      <Path d="M6 10 L14 10"
        stroke={color} strokeWidth={SW * 0.75} strokeLinecap={CAP} opacity={0.55} />
      {/* Свёрнутая карточка под ней */}
      <Rect x={3} y={16.5} width={18} height={3.8} rx={RX}
        stroke={color} strokeWidth={SW} strokeLinecap={CAP} strokeLinejoin={JN} />
    </Svg>
  );
}
