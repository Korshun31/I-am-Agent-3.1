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

export default function StatisticsTopProperties({ data, title, currencySymbol, emptyText, columns }) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.title}>{title}</Text> : null}

      <View style={s.headerRow}>
        <Text style={[s.headerCell, { flex: 2 }]}>{columns.property}</Text>
        <Text style={[s.headerCell, { flex: 1, minWidth: 90, textAlign: 'right' }]}>{columns.revenue}</Text>
        <Text style={[s.headerCell, { width: 70, textAlign: 'right' }]}>{columns.occupancy}</Text>
      </View>

      {data.length === 0 ? (
        <Text style={s.empty}>{emptyText}</Text>
      ) : (
        data.map((d, i) => (
          <View key={d.id} style={[s.row, i < data.length - 1 && s.rowBorder]}>
            <View style={{ flex: 2 }}>
              <Text style={s.propName} numberOfLines={1}>{d.name}</Text>
              {d.code ? <Text style={s.propCode} numberOfLines={1}>{d.code}</Text> : null}
            </View>
            <Text style={[s.value, { flex: 1, minWidth: 90, textAlign: 'right' }]} numberOfLines={1}>
              {fmtMoney(d.revenue, currencySymbol)}
            </Text>
            <Text style={[s.value, { width: 70, textAlign: 'right' }]} numberOfLines={1}>
              {d.occupancyPercent}%
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
  propName: { fontSize: 14, fontWeight: '600', color: C.text },
  propCode: { fontSize: 12, color: C.muted, marginTop: 2 },
  value: { fontSize: 14, color: C.text, fontWeight: '600' },
  empty: { fontSize: 14, color: C.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
});
