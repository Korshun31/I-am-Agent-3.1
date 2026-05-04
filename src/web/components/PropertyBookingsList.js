import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { pluralByLang } from '../../utils/pluralize';

const ACCENT = '#3D7D82';

export default function PropertyBookingsList({
  bookings,
  property,
  language,
  t,
  psym,
  onBookingPress,
  emptyText,
}) {
  if (!property) return null;

  const todayStr = dayjs().format('YYYY-MM-DD');
  const propBookings = (bookings || [])
    .filter(b => (b.propertyId || b.property_id) === property.id && (b.checkOut || b.check_out) >= todayStr)
    .sort((a, b) => (a.checkIn || a.check_in).localeCompare(b.checkIn || b.check_in))
    .slice(0, 5);

  if (propBookings.length === 0) {
    return <Text style={s.empty}>{emptyText}</Text>;
  }

  return (
    <>
      {propBookings.map((b, i) => {
        const ci = b.checkIn || b.check_in;
        const co = b.checkOut || b.check_out;
        const isActive = ci <= todayStr && co >= todayStr;
        const nights = dayjs(co).diff(dayjs(ci), 'day');
        const total = b.totalPrice ?? b.total_price;
        return (
          <TouchableOpacity
            key={b.id}
            style={[s.row, i < propBookings.length - 1 && s.rowBorder]}
            onPress={() => onBookingPress?.(b)}
            activeOpacity={0.6}
          >
            <View style={[s.dot, { backgroundColor: isActive ? '#16A34A' : ACCENT }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.dates}>
                {dayjs(ci).format('DD MMM')} — {dayjs(co).format('DD MMM YYYY')}
              </Text>
              <Text style={s.meta}>
                {nights} {pluralByLang(nights, language, { one: t('nightOne'), few: t('nightFew'), many: t('nightMany') })}
                {total ? `  ·  ${psym} ${Number(total).toLocaleString()}` : ''}
              </Text>
            </View>
            {isActive && (
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeText}>{t('bookingActiveNow')}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dates: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  activeBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
});
