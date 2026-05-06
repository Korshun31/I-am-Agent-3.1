import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ACCENT = '#3D7D82';
const C = {
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
};

function fmtMoney(n, sym) {
  if (n == null) return '—';
  return Number(Math.round(n)).toLocaleString('ru-RU') + (sym ? ` ${sym}` : '');
}

function Card({ label, value, sub, tone, flexBasis }) {
  return (
    <View style={[s.card, { flexBasis }, tone === 'accent' && { borderColor: ACCENT }]}>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
      <Text style={[s.value, tone === 'accent' && { color: ACCENT }]} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

export default function StatisticsKpiCards({
  revenue,
  agencyIncome,
  activeBookings,
  occupancyPercent,
  currencySymbol,
  labels,
  cardFlexBasis = 200,
}) {
  return (
    <View style={s.grid}>
      <Card label={labels.revenue}        value={fmtMoney(revenue, currencySymbol)}          flexBasis={cardFlexBasis} />
      <Card label={labels.agencyIncome}   value={fmtMoney(agencyIncome, currencySymbol)}     flexBasis={cardFlexBasis} tone="accent" />
      <Card label={labels.activeBookings} value={String(activeBookings)} sub={labels.activeBookingsSub} flexBasis={cardFlexBasis} />
      <Card label={labels.occupancy}      value={`${occupancyPercent}%`} sub={labels.occupancySub}     flexBasis={cardFlexBasis} />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 6,
  },
  label: { fontSize: 12, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 24, fontWeight: '700', color: C.text },
  sub:   { fontSize: 11, color: C.muted },
});
