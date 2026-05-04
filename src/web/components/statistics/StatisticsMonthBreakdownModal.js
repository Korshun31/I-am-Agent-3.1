import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';

const C = {
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
  light:   '#9AA3AC',
  hover:   '#F4F6F9',
  totalBg: '#F8FAFC',
};

function fmt(n) {
  if (n == null || n === 0) return '0';
  return Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
}

export default function StatisticsMonthBreakdownModal({
  visible,
  monthLabel,
  rows,
  currencySymbol,
  columns,
  totalLabel,
  emptyText,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onClose,
}) {
  const [hoverRow, setHoverRow] = useState(null);

  if (!visible) return null;

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalIncome  = rows.reduce((s, r) => s + (r.agencyIncome || 0), 0);
  const hovered = rows.find((r) => r.propertyId === hoverRow);

  return (
    <Pressable style={s.backdrop} onPress={onClose}>
      <Pressable style={s.modal} onPress={(e) => e.stopPropagation()}>
        <View style={s.header}>
          <Pressable
            onPress={canGoPrev ? onPrev : undefined}
            style={[s.navBtn, !canGoPrev && s.navBtnDisabled]}
            disabled={!canGoPrev}
          >
            <Text style={[s.navText, !canGoPrev && s.navTextDisabled]}>‹</Text>
          </Pressable>
          <Text style={s.title}>{monthLabel}</Text>
          <Pressable
            onPress={canGoNext ? onNext : undefined}
            style={[s.navBtn, !canGoNext && s.navBtnDisabled]}
            disabled={!canGoNext}
          >
            <Text style={[s.navText, !canGoNext && s.navTextDisabled]}>›</Text>
          </Pressable>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.th, s.colCode]}>{columns?.code || 'Код'}</Text>
          <Text style={[s.th, s.colMoney]}>{columns?.revenue || 'Оборот'}</Text>
          <Text style={[s.th, s.colSource]}>{columns?.source || 'За что?'}</Text>
          <Text style={[s.th, s.colMoney]}>{columns?.income || 'Доход'}</Text>
        </View>

        <ScrollView style={s.tableBody} contentContainerStyle={{ paddingBottom: 4 }}>
          {rows.length === 0 ? (
            <Text style={s.empty}>{emptyText || 'Нет данных за этот месяц'}</Text>
          ) : (
            rows.map((r) => {
              const isHover = hoverRow === r.propertyId;
              return (
                <Pressable
                  key={r.propertyId}
                  style={[s.row, isHover && s.rowHover]}
                  onHoverIn={() => setHoverRow(r.propertyId)}
                  onHoverOut={() => setHoverRow((x) => (x === r.propertyId ? null : x))}
                >
                  <Text style={[s.td, s.colCode, s.codeText]}>{r.code}</Text>
                  <Text style={[s.td, s.colMoney]}>{fmt(r.revenue)} {currencySymbol}</Text>
                  <Text style={[s.td, s.colSource, s.sourceText]}>
                    {r.sources && r.sources.length > 0 ? r.sources.join(' + ') : '—'}
                  </Text>
                  <Text style={[s.td, s.colMoney]}>{fmt(r.agencyIncome)} {currencySymbol}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {rows.length > 0 ? (
          <View style={s.totalRow}>
            <Text style={[s.td, s.colCode, s.totalLabel]}>{totalLabel || 'Итого'}</Text>
            <Text style={[s.td, s.colMoney, s.totalValue]}>{fmt(totalRevenue)} {currencySymbol}</Text>
            <View style={s.colSource} />
            <Text style={[s.td, s.colMoney, s.totalValue]}>{fmt(totalIncome)} {currencySymbol}</Text>
          </View>
        ) : null}

        {hovered ? (
          <View style={s.preview}>
            {hovered.photo ? (
              <Image source={{ uri: hovered.photo }} style={s.previewPhoto} />
            ) : (
              <View style={[s.previewPhoto, s.previewPhotoEmpty]}>
                <Text style={s.previewNoPhoto}>—</Text>
              </View>
            )}
            <View style={s.previewInfo}>
              <Text style={s.previewCode}>{hovered.code}</Text>
              <Text style={s.previewName} numberOfLines={2}>{hovered.name}</Text>
              {hovered.city ? <Text style={s.previewCity}>{hovered.city}</Text> : null}
            </View>
          </View>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: 560,
    maxHeight: '80%',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 20,
    gap: 12,
    position: 'relative',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, position: 'relative' },
  title: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.hover,
    cursor: 'pointer',
  },
  navBtnDisabled: { backgroundColor: 'transparent', cursor: 'default' },
  navText: { fontSize: 20, color: C.text, fontWeight: '700', lineHeight: 22 },
  navTextDisabled: { color: '#D0D6DD' },
  closeBtn: { position: 'absolute', right: 0, top: -4, padding: 6, borderRadius: 6 },
  closeText: { fontSize: 16, color: C.muted, fontWeight: '600' },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  th: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },
  tableBody: { maxHeight: 380 },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowHover: { backgroundColor: C.hover },
  td: { fontSize: 13, color: C.text },
  colCode: { flex: 1.2 },
  colMoney: { flex: 1, textAlign: 'right' },
  colSource: { flex: 0.9, textAlign: 'center', paddingHorizontal: 6 },
  codeText: { fontWeight: '600', cursor: 'pointer' },
  sourceText: { color: C.muted, fontWeight: '600', fontSize: 12 },
  empty: { textAlign: 'center', color: C.muted, paddingVertical: 24, fontSize: 13 },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: C.totalBg,
    borderRadius: 8,
  },
  totalLabel: { fontWeight: '700', color: C.text },
  totalValue: { fontWeight: '700', color: C.text },
  preview: {
    position: 'absolute',
    top: 16,
    right: -260,
    width: 240,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 8,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
    zIndex: 1001,
  },
  previewPhoto: { width: '100%', height: 140, borderRadius: 8, backgroundColor: '#EEF1F4' },
  previewPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewNoPhoto: { fontSize: 18, color: C.light },
  previewInfo: { gap: 2 },
  previewCode: { fontSize: 13, fontWeight: '700', color: C.text },
  previewName: { fontSize: 12, color: C.muted },
  previewCity: { fontSize: 11, color: C.light },
});
