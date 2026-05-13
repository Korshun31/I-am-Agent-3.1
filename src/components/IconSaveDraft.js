import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Иконка «сохранить» — папка со стрелкой вниз внутри.
// Используется в WizardFooter между кнопками Назад и Далее: сохраняет
// текущее состояние без выхода из визарда.
export default function IconSaveDraft({ size = 22, color = '#3D7D82' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H5a2 2 0 0 0-2 2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11v6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M9 14l3 3 3-3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
