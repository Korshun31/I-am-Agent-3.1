import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

const CREATED       = '#5B82D6';
const CREATED_MUTED = '#C5D1EE';
const CHECKED       = '#C2920E';
const CHECKED_MUTED = '#E8D7A1';

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

export default function StatisticsBookingsCountChart({
  data, title, labels, scrollable, alwaysShowValues,
  colWidth = COL_WIDTH,
  barMaxWidth,
  showYear,
}) {
  const [hoverKey, setHoverKey] = useState(null);
  const [viewportW, setViewportW] = useState(0);
  const scrollRef = useRef(null);
  const rawMax = Math.max(
    0,
    ...data.map((d) => Math.max(d.created || 0, d.checkedIn || 0))
  );
  const step = rawMax > 0 ? niceStep(rawMax / 5) : 1;
  const max = rawMax > 0 ? Math.ceil(rawMax / step) * step : 1;
  const ticks = [];
  for (let v = max; v >= 0; v -= step) ticks.push(v);

  useEffect(() => {
    if (!scrollable || !scrollRef.current) return;
    const idx = data.findIndex((d) => d.isCurrent);
    if (idx < 0) return;
    const stride = colWidth + COL_GAP;
    const visible = viewportW || scrollRef.current.clientWidth || stride * 10;
    const target = Math.max(0, idx * stride + colWidth / 2 - visible / 2);
    if (typeof scrollRef.current.scrollTo === 'function') {
      scrollRef.current.scrollTo({ x: target, animated: false });
    } else if ('scrollLeft' in scrollRef.current) {
      scrollRef.current.scrollLeft = target;
    }
  }, [scrollable, data, viewportW]);

  const Cols = data.map((d) => {
    const hCre = max > 0 ? Math.round(((d.created || 0) / max) * 140) : 0;
    const hChk = max > 0 ? Math.round(((d.checkedIn || 0) / max) * 140) : 0;
    const isHovered = hoverKey === d.key || alwaysShowValues;
    return (
      <Pressable
        key={d.key}
        style={[s.col, scrollable && s.colFixed, scrollable && { flexBasis: colWidth, width: colWidth }, d.isCurrent && s.colCurrent]}
        onHoverIn={() => setHoverKey(d.key)}
        onHoverOut={() => setHoverKey((k) => (k === d.key ? null : k))}
        onPressIn={() => setHoverKey(d.key)}
        onPressOut={() => setHoverKey((k) => (k === d.key ? null : k))}
      >
        <View style={s.barsRow}>
          <View style={[s.barColumn, barMaxWidth ? { maxWidth: barMaxWidth } : null]}>
            <View style={s.valueSlot}>
              {isHovered && d.created > 0 && (
                <Text style={[s.barValue, { color: CREATED }]}>{d.created}</Text>
              )}
            </View>
            <View
              style={[
                s.bar,
                { height: Math.max(2, hCre), backgroundColor: isHovered ? CREATED : CREATED_MUTED },
              ]}
            />
          </View>
          <View style={[s.barColumn, barMaxWidth ? { maxWidth: barMaxWidth } : null]}>
            <View style={s.valueSlot}>
              {isHovered && d.checkedIn > 0 && (
                <Text style={[s.barValue, { color: CHECKED }]}>{d.checkedIn}</Text>
              )}
            </View>
            <View
              style={[
                s.bar,
                { height: Math.max(2, hChk), backgroundColor: isHovered ? CHECKED : CHECKED_MUTED },
              ]}
            />
          </View>
        </View>
        <Text style={[s.label, (isHovered || d.isCurrent) && s.labelEmph]} numberOfLines={1}>
          {showYear ? `${d.label} ${String(d.year).slice(-2)}` : d.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={s.card}>
      {title ? <Text style={s.title}>{title}</Text> : null}

      {labels ? (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: CREATED }]} />
            <Text style={s.legendText}>{labels.created}</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: CHECKED }]} />
            <Text style={s.legendText}>{labels.checkedIn}</Text>
          </View>
        </View>
      ) : null}

      {scrollable ? (
        <View style={s.chartFrame}>
          <View style={s.numbersLayer} pointerEvents="none">
            {ticks.map((tick) => {
              const y = 22 + (tick / max) * 140;
              return (
                <Text key={tick} style={[s.gridLabel, { bottom: y - 6 }]}>
                  {tick}
                </Text>
              );
            })}
          </View>
          <View style={s.chartScrollWrap}>
            <View style={s.yAxisSpacer} />
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.scrollOuter}
              onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}
            >
              <View
                style={[
                  s.scrollInner,
                  { width: data.length * colWidth + (data.length - 1) * COL_GAP + 8 },
                ]}
              >
                <View style={s.gridLinesLayer} pointerEvents="none">
                  {ticks.map((tick) => {
                    const y = 22 + (tick / max) * 140;
                    return (
                      <View key={tick} style={[s.gridLine, { bottom: y - 0.5 }]} />
                    );
                  })}
                </View>
                {Cols}
              </View>
            </ScrollView>
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
  yAxisSpacer: { width: 22 },
  numbersLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    pointerEvents: 'none',
    zIndex: 2,
  },
  gridLinesLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
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
});
