import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLOR_BORDER = '#D1D1D6';
const COLOR_ACTIVE = '#3D7D82';

export default function Checkbox({ checked, size = 22, style }) {
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size },
        checked && styles.boxChecked,
        style,
      ]}
    >
      {checked && <Text style={styles.mark}>✓</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLOR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { borderColor: COLOR_ACTIVE },
  mark: { color: COLOR_ACTIVE, fontSize: 14, fontWeight: '700' },
});
