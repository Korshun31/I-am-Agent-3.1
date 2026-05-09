/**
 * EditIcons — иконка карандаша для кнопок редактирования.
 *
 * Outline-стиль: stroke 1.6, round caps/joins — совпадает с TabIcons.js / FolderIcons.js.
 * Горизонтальный «пухлый» карандаш с явными сегментами:
 * грифель | скос заточки | корпус | поясок (ferrule) | резинка.
 * Толщина корпуса ~6pt, длина ~18pt.
 */

import React from 'react';
import Svg, { Path, Line, G } from 'react-native-svg';

const SW  = 1.6;
const CAP = 'round';
const JN  = 'round';

export function IconPencil({ size = 24, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform="rotate(-45 12 12)">
      {/* Грифель — закрашенный конус, остриё влево */}
      <Path
        d="M3.0 12.0 L6.2 9.8 L6.2 14.2 Z"
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin={JN}
      />
      {/* Скос заточки — трапеция между грифелем и корпусом */}
      <Path
        d="M6.2 9.8 L8.8 9.0 L8.8 15.0 L6.2 14.2 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      {/* Корпус — длинный прямоугольник */}
      <Path
        d="M8.8 9.0 L17.4 9.0 L17.4 15.0 L8.8 15.0 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      {/* Поясок (ferrule) — короткий сегмент */}
      <Path
        d="M17.4 9.0 L19.6 9.0 L19.6 15.0 L17.4 15.0 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      {/* Насечки пояска — две тонкие поперечные линии */}
      <Line
        x1="18.2" y1="9.0" x2="18.2" y2="15.0"
        stroke={color} strokeWidth={1.0} strokeLinecap="butt" opacity={0.7}
      />
      <Line
        x1="18.9" y1="9.0" x2="18.9" y2="15.0"
        stroke={color} strokeWidth={1.0} strokeLinecap="butt" opacity={0.7}
      />
      {/* Резинка — закруглённый правый торец */}
      <Path
        d="M19.6 9.0 L21.4 9.0 Q22.6 9.0 22.6 12.0 Q22.6 15.0 21.4 15.0 L19.6 15.0 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      </G>
    </Svg>
  );
}
