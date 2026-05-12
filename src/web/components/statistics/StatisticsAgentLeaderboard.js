import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = {
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
  light:   '#F1F5F9',
};

function fmtMoney(n, sym) {
  if (!n) return '—';
  return Number(Math.round(n)).toLocaleString('ru-RU') + (sym ? ` ${sym}` : '');
}

export default function StatisticsAgentLeaderboard({
  data,
  title,
  currencySymbol,
  emptyText,
  companyLabel,
  columns,
}) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.title}>{title}</Text> : null}

      <View style={s.headerRow}>
        <Text style={[s.headerCell, { flex: 2 }]}>{columns.agent}</Text>
        <Text style={[s.headerCell, { width: 70, textAlign: 'right' }]}>{columns.bookings}</Text>
        <Text style={[s.headerCell, { flex: 1, minWidth: 90, textAlign: 'right' }]}>{columns.income}</Text>
      </View>

      {data.length === 0 ? (
        <Text style={s.empty}>{emptyText}</Text>
      ) : (
        data.map((d, i) => (
          <View key={d.id} style={[s.row, i < data.length - 1 && s.rowBorder]}>
            <Text style={[s.name, { flex: 2 }]} numberOfLines={1}>
              {d.isCompany ? (companyLabel || 'Company') : d.name}
            </Text>
            <Text style={[s.value, { width: 70, textAlign: 'right' }]} numberOfLines={1}>
              {d.count}
            </Text>
            <Text style={[s.value, { flex: 1, minWidth: 90, textAlign: 'right' }]} numberOfLines={1}>
              {fmtMoney(d.agencyIncome, currencySymbol)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerCell: { fontSize: 12, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.light },
  name: { fontSize: 14, fontWeight: '600', color: C.text },
  value: { fontSize: 14, color: C.text, fontWeight: '600' },
  empty: { fontSize: 14, color: C.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
});
