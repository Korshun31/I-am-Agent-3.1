import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

const REVENUE       = '#3D7D82';
const REVENUE_MUTED = '#B7D3D5';
const INCOME        = '#4AA87D';
const INCOME_MUTED  = '#B8DCC9';

const C = {
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
  light:   '#9AA3AC',
  current: '#F8FAFC',
};

const COL_WIDTH    = 52;
const COL_GAP      = 4;
const SCROLL_HEIGHT = 210;
const COL_HEIGHT    = 188;

function fmtShort(n) {
  if (n == null) return '';
  if (n === 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000)    return Math.round(n / 1000) + 'K';
  return String(Math.round(n));
}

function niceStep(rough) {
  if (rough <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / exp;
  let nice;
  if (norm <= 1.5) nice = 1;
  else if (norm <= 3) nice = 2;
  else if (norm <= 7) nice = 5;
  else nice = 10;
  return nice * exp;
}

export default function StatisticsRevenueChart({ data, title, currencySymbol, labels, scrollable, onSelectMonth }) {
  const [hoverKey, setHoverKey] = useState(null);
  const scrollRef = useRef(null);
  const rawMax = Math.max(
    0,
    ...data.map((d) => Math.max(d.revenue || 0, d.agencyIncome || 0))
  );
  const step = rawMax > 0 ? niceStep(rawMax / 5) : 1;
  const max = rawMax > 0 ? Math.ceil(rawMax / step) * step : 1;
  const ticks = [];
  for (let v = max; v >= 0; v -= step) ticks.push(v);

  useEffect(() => {
    if (!scrollable || !scrollRef.current) return;
    const idx = data.findIndex((d) => d.isCurrent);
    if (idx < 0) return;
    const stride = COL_WIDTH + COL_GAP;
    const visible = scrollRef.current.clientWidth || stride * 10;
    const target = Math.max(0, idx * stride + COL_WIDTH / 2 - visible / 2);
    scrollRef.current.scrollLeft = target;
  }, [scrollable, data]);

  const Cols = data.map((d, idx) => {
    const hRev = max > 0 ? Math.round(((d.revenue || 0) / max) * 140) : 0;
    const hInc = max > 0 ? Math.round(((d.agencyIncome || 0) / max) * 140) : 0;
    const isHovered = hoverKey === d.key;
    return (
      <Pressable
        key={d.key}
        style={[s.col, scrollable && s.colFixed, d.isCurrent && s.colCurrent]}
        onHoverIn={() => setHoverKey(d.key)}
        onHoverOut={() => setHoverKey((k) => (k === d.key ? null : k))}
        onPress={() => onSelectMonth?.(d, idx)}
      >
        <View style={s.barsRow}>
          <View style={s.barColumn}>
            <View style={s.valueSlot}>
              {isHovered && d.revenue > 0 && (
                <Text style={[s.barValue, { color: REVENUE }]}>{fmtShort(d.revenue)}</Text>
              )}
            </View>
            <View
              style={[
                s.bar,
                { height: Math.max(2, hRev), backgroundColor: isHovered ? REVENUE : REVENUE_MUTED },
              ]}
            />
          </View>
          <View style={s.barColumn}>
            <View style={s.valueSlot}>
              {isHovered && d.agencyIncome > 0 && (
                <Text style={[s.barValue, { color: INCOME }]}>{fmtShort(d.agencyIncome)}</Text>
              )}
            </View>
            <View
              style={[
                s.bar,
                { height: Math.max(2, hInc), backgroundColor: isHovered ? INCOME : INCOME_MUTED },
              ]}
            />
          </View>
        </View>
        <Text style={[s.label, (isHovered || d.isCurrent) && s.labelEmph]} numberOfLines={1}>
          {d.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={s.card}>
      {title || currencySymbol ? (
        <View style={s.titleRow}>
          {title ? <Text style={s.title}>{title}</Text> : <View />}
          {currencySymbol ? <Text style={s.currency}>{currencySymbol}</Text> : null}
        </View>
      ) : null}

      {labels ? (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: REVENUE }]} />
            <Text style={s.legendText}>{labels.revenue}</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: INCOME }]} />
            <Text style={s.legendText}>{labels.income}</Text>
          </View>
        </View>
      ) : null}

      {scrollable ? (
        <View style={s.chartFrame}>
          {/* Числа на оси Y — отдельный слой слева, не пересекается со скрол-зоной. */}
          <View style={s.numbersLayer} pointerEvents="none">
            {ticks.map((tick) => {
              const y = 22 + (tick / max) * 140;
              return (
                <Text key={tick} style={[s.gridLabel, { bottom: y - 6 }]}>
                  {fmtShort(tick)}
                </Text>
              );
            })}
          </View>
          <View style={s.chartScrollWrap}>
            <View style={s.yAxisSpacer} />
            <View ref={scrollRef} style={s.scrollOuter}>
              {/* Линии лежат ВНУТРИ scrollOuter — обрезаются его границами как столбцы.
                  Ширина = полная ширина содержимого, чтобы линии шли через все 24 столбца. */}
              <View
                style={[
                  s.gridLinesLayer,
                  { width: data.length * COL_WIDTH + (data.length - 1) * COL_GAP + 8 },
                ]}
                pointerEvents="none"
              >
                {ticks.map((tick) => {
                  const y = 22 + (tick / max) * 140;
                  return (
                    <View key={tick} style={[s.gridLine, { bottom: y - 0.5 }]} />
                  );
                })}
              </View>
              <View style={s.scrollInner}>{Cols}</View>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.chartArea}>{Cols}</View>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700', color: C.text },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: C.muted, fontWeight: '500' },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: COL_GAP,
    height: SCROLL_HEIGHT,
    paddingTop: 16,
  },
  chartFrame: { position: 'relative', height: SCROLL_HEIGHT },
  chartScrollWrap: { flexDirection: 'row', alignItems: 'stretch', height: '100%' },
  yAxisSpacer: { width: 44 },
  numbersLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 44,
    pointerEvents: 'none',
    zIndex: 2,
  },
  gridLinesLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  gridLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 12,
    textAlign: 'right',
    paddingRight: 4,
    fontSize: 10,
    lineHeight: 12,
    color: C.muted,
    fontWeight: '500',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  scrollOuter: {
    height: SCROLL_HEIGHT,
    overflowX: 'auto',
    overflowY: 'hidden',
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.07)',
  },
  scrollInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: COL_GAP,
    paddingTop: 16,
    paddingHorizontal: 4,
    height: SCROLL_HEIGHT,
  },
  col: { flex: 1, alignItems: 'center', gap: 4, cursor: 'pointer', paddingVertical: 4, borderRadius: 6 },
  colFixed: { flexGrow: 0, flexShrink: 0, flexBasis: COL_WIDTH, width: COL_WIDTH, height: COL_HEIGHT, justifyContent: 'flex-end' },
  colCurrent: { backgroundColor: C.current },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, width: '85%', flex: 1, justifyContent: 'center' },
  barColumn: { flex: 1, maxWidth: 18, alignItems: 'center', justifyContent: 'flex-end' },
  valueSlot: { height: 18, alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 2,
    transitionProperty: 'background-color',
    transitionDuration: '180ms',
  },
  barValue: { fontSize: 11, fontWeight: '700' },
  label: { fontSize: 11, color: C.muted, fontWeight: '500' },
  labelEmph: { color: C.text, fontWeight: '700' },
  currency: { fontSize: 11, color: C.muted, fontWeight: '600' },
});
