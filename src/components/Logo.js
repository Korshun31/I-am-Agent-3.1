import React from 'react';
import { View, StyleSheet } from 'react-native';

export const COLORS = {
  background: '#F5F5F7',
  redOrange: '#E85D4C',
  yellowOrange: '#F0A84A',
  green: '#5DB87A',
  teal: '#3BA99A',
  darkTeal: '#2D8B7E',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  facebookBlue: '#1877F2',
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
