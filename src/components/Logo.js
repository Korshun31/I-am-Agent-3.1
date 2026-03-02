import React from 'react';
import { View, StyleSheet } from 'react-native';

export const COLORS = {
  background: '#F5F2EB',
  backgroundLogin: '#FDF7EF', // кремовый фон экрана входа по макету
  redOrange: '#E85D4C',
  yellowOrange: '#F0A84A',
  green: '#5DB87A',
  teal: '#3BA99A',
  darkTeal: '#2D8B7E',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  stickerYellow: '#F7E98E',   // стикер жёлтый (E-mail)
  stickerBlue: '#A8D0E6',     // стикер голубой (Password)
  facebookBlue: '#1877F2',
  signUpPink: '#D85A6A',
  backRed: '#C73E3E',         // ссылка Back
  // Регистрация: цветные стикеры полей (светлый = поле, тёмный = метка)
  regNameBg: '#F5D0D0',       // поле Name — светлый розовый
  regNameLabel: '#E8A0A0',    // метка Name — тёмнее
  regEmailBg: '#FFE0B8',      // поле E-mail — светлый оранжевый
  regEmailLabel: '#F0C070',   // метка E-mail — тёмнее
  regPasswordBg: '#FFF4B8',   // поле Password — светлый жёлтый
  regPasswordLabel: '#F7E98E', // метка Password — тёмнее
  regConfirmBg: '#C5E3F0',    // поле Confirm — светлый голубой
  regConfirmLabel: '#A8D0E6', // метка Password (confirm) — тёмнее
};

// Один логотип везде: 5 полос, веер. size только меняет масштаб.
const barColors = [
  COLORS.redOrange,
  COLORS.yellowOrange,
  COLORS.green,
  COLORS.teal,
  COLORS.darkTeal,
];
const rotations = [-8, -4, 0, 4, 8];

export default function Logo({ size = 'medium' }) {
  const isSmall = size === 'small';
  const barWidth = isSmall ? 12 : 14;
  const barHeight = isSmall ? 36 : 48;
  const gap = isSmall ? 5 : 6;

  return (
    <View style={[styles.container, { gap }]}>
      {barColors.map((color, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              transform: [{ rotate: `${rotations[i]}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 4,
  },
});
