import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
  accentBg: '#EAF4F5',
};

const PRESETS = [
  { id: 'thisMonth',   key: 'statisticsPeriodThisMonth' },
  { id: 'lastMonth',   key: 'statisticsPeriodLastMonth' },
  { id: 'thisQuarter', key: 'statisticsPeriodThisQuarter' },
  { id: 'thisYear',    key: 'statisticsPeriodThisYear' },
];

export default function StatisticsPeriodPicker({ value, onChange }) {
  const { t } = useLanguage();
  return (
    <View style={s.row}>
      {PRESETS.map((p) => {
        const active = value === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[s.btn, active && s.btnActive]}
            onPress={() => onChange(p.id)}
            activeOpacity={0.8}
          >
            <Text style={[s.btnText, active && s.btnTextActive]}>{t(p.key)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  btnActive: { borderColor: ACCENT, backgroundColor: C.accentBg },
  btnText: { fontSize: 14, color: C.muted, fontWeight: '600' },
  btnTextActive: { color: ACCENT, fontWeight: '600' },
});
