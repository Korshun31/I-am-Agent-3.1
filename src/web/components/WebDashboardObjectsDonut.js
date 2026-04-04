import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

/** Muted palette aligned with WebPropertiesScreen type colors */
const DONUT_COLORS = {
  houses: '#C9A85A',
  resortHouses: '#6BAF8A',
  apartments: '#7B9BC9',
};

function buildConicGradient(houses, resortHouses, apartments) {
  const total = houses + resortHouses + apartments;
  if (total <= 0) return null;
  const { houses: c1, resortHouses: c2, apartments: c3 } = DONUT_COLORS;
  let start = 0;
  const segments = [];
  const push = (count, color) => {
    if (count <= 0) return;
    const sweep = (count / total) * 360;
    const end = start + sweep;
    segments.push(`${color} ${start}deg ${end}deg`);
    start = end;
  };
  push(houses, c1);
  push(resortHouses, c2);
  push(apartments, c3);
  return `conic-gradient(${segments.join(', ')})`;
}

/**
 * Donut for approved rentable units only (three sectors).
 * Web: conic-gradient; other: compact legend only.
 */
export default function WebDashboardObjectsDonut({
  houses,
  resortHouses,
  apartments,
  labelHouses,
  labelResortHouses,
  labelApartments,
  emptyLabel,
}) {
  const total = houses + resortHouses + apartments;
  const gradient = total > 0 ? buildConicGradient(houses, resortHouses, apartments) : null;
  const webRing = Platform.OS === 'web' && gradient;

  return (
    <View style={styles.wrap}>
      {total === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <View style={styles.innerRow}>
          {webRing ? (
            <View style={styles.ringOuter}>
              <View
                style={[
                  styles.ringFill,
                  Platform.OS === 'web' && gradient ? { background: gradient } : null,
                ]}
              />
              <View style={styles.ringHole} />
            </View>
          ) : null}
          <View style={styles.legend}>
            <LegendRow color={DONUT_COLORS.houses} label={labelHouses} value={houses} />
            <LegendRow color={DONUT_COLORS.resortHouses} label={labelResortHouses} value={resortHouses} />
            <LegendRow color={DONUT_COLORS.apartments} label={labelApartments} value={apartments} />
          </View>
        </View>
      )}
    </View>
  );
}

function LegendRow({ color, label, value }) {
  if (value <= 0) return null;
  return (
    <View style={styles.legendRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText} numberOfLines={1}>
        {label}
        <Text style={styles.legendValue}>{` ${value}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 100,
    maxWidth: 220,
    justifyContent: 'center',
  },
  empty: {
    fontSize: 12,
    color: '#ADB5BD',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ringOuter: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringFill: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  ringHole: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  legend: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendText: {
    fontSize: 10,
    color: '#6C757D',
    fontWeight: '600',
    flex: 1,
  },
  legendValue: {
    color: '#212529',
    fontWeight: '700',
  },
});
