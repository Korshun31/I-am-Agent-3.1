import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';
import {
  IconProperties,
  IconBookings,
  IconCalendar,
  IconAccount,
} from './TabIcons';

// Высота капсулы (pill)
export const TAB_BAR_CONTENT_HEIGHT = 56;

// Зазор сверху над pill (внутри контейнера) — фиксированный.
const PILL_TOP_GAP = 8;
// На устройствах БЕЗ home indicator (iPhone SE и старше) поднимаем pill
// вверх — иначе он прижимается к самому нижнему краю экрана.
const SE_BOTTOM_LIFT = 12;

// Горизонтальный отступ pill от краёв экрана
const PILL_SIDE_INSET = 16;

// Высота внутренней активной таблетки
const SUB_PILL_HEIGHT = 44;
const SUB_PILL_RADIUS = 22;

// Боковой отступ активной таблетки от внешнего края pill — равен
// (PILL — SUB_PILL) / 2 сверху/снизу = (56 − 44) / 2 = 6pt.
// Так таблетка имеет одинаковый воздух со всех четырёх сторон.
const SUB_PILL_SIDE_INSET = (TAB_BAR_CONTENT_HEIGHT - SUB_PILL_HEIGHT) / 2;

// Внутренние отступы активной таблетки и размеры контента
const ACTIVE_PADDING_H = 16;
const ACTIVE_GAP       = 6;
const ACTIVE_ICON_SIZE   = 22;
const INACTIVE_ICON_SIZE = 22;
const LABEL_FONT_SIZE    = 16;

// Цвет неактивных иконок
const COLOR_INACTIVE = '#9CA3AF';

// Палитра вкладок — насыщенный цвет иконки/текста + alpha-фон таблетки
const TABS = [
  { key: 'RealEstate', Icon: IconProperties, color: '#C97A52', bgColor: 'rgba(201,122,82,0.22)', labelKey: 'base' },
  { key: 'Bookings',   Icon: IconBookings,   color: '#C4973A', bgColor: 'rgba(196,151,58,0.22)', labelKey: 'bookings' },
  { key: 'Calendar',   Icon: IconCalendar,   color: '#8BAF8E', bgColor: 'rgba(139,175,142,0.22)', labelKey: 'calendar' },
  { key: 'Account',    Icon: IconAccount,    color: '#7BAEC8', bgColor: 'rgba(123,174,200,0.22)', labelKey: 'account' },
];

export default function BottomNav({ activeTab, onSelect }) {
  const insets    = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t }     = useLanguage();

  const pillWidth = width - PILL_SIDE_INSET * 2;

  // Ширина активного варианта каждой вкладки. Замеряется через невидимый ряд
  // (off-screen), чтобы знать сколько места займёт «иконка + лейбл + отступы»
  // у каждой вкладки. Меняется при смене языка или метрик шрифта.
  const [activeWidths, setActiveWidths] = useState([0, 0, 0, 0]);
  const allMeasured = activeWidths.every(w => w > 0);

  const handleMeasure = useCallback((index, w) => {
    setActiveWidths(prev => {
      if (Math.abs(prev[index] - w) < 0.5) return prev;
      const next = [...prev];
      next[index] = w;
      return next;
    });
  }, []);

  // Позиция (translateX) и ширина активной таблетки для заданного индекса.
  // Активная ячейка визуально шире sub-pill на 2 × SIDE_INSET — внутри ячейки
  // sub-pill отступает с обеих сторон по SIDE_INSET. На крайних индексах это
  // даёт зазор от внешнего края pill, в средних — равномерный воздух между
  // соседними ячейками.
  const computeXandW = useCallback((index) => {
    if (!allMeasured) return { x: 0, w: 0 };
    const activeW     = activeWidths[index];
    const activeCellW = activeW + 2 * SUB_PILL_SIDE_INSET;
    const inactiveW   = (pillWidth - activeCellW) / (TABS.length - 1);
    return { x: index * inactiveW + SUB_PILL_SIDE_INSET, w: activeW };
  }, [allMeasured, activeWidths, pillWidth]);

  const animX = useRef(new Animated.Value(0)).current;
  const animW = useRef(new Animated.Value(0)).current;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!allMeasured) return;
    const { x, w } = computeXandW(activeTab);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      animX.setValue(x);
      animW.setValue(w);
      return;
    }

    Animated.parallel([
      Animated.spring(animX, { toValue: x, useNativeDriver: false, tension: 68, friction: 10 }),
      Animated.spring(animW, { toValue: w, useNativeDriver: false, tension: 68, friction: 10 }),
    ]).start();
  }, [activeTab, allMeasured, animX, animW, computeXandW]);

  // Текущая ширина видимой ячейки. Активная = sub-pill + двойной SIDE_INSET
  // (sub-pill центрирован внутри). Неактивные равномерно делят остаток.
  const cellWidthFor = (index) => {
    if (!allMeasured) return pillWidth / TABS.length;
    const activeCellW = activeWidths[activeTab] + 2 * SUB_PILL_SIDE_INSET;
    if (index === activeTab) return activeCellW;
    return (pillWidth - activeCellW) / (TABS.length - 1);
  };

  const bottomLift      = insets.bottom === 0 ? SE_BOTTOM_LIFT : 0;
  const containerHeight = PILL_TOP_GAP + TAB_BAR_CONTENT_HEIGHT + bottomLift + insets.bottom;

  return (
    <View
      style={[styles.container, { height: containerHeight }]}
      pointerEvents="box-none"
    >
      {/* Невидимый off-screen ряд: только для замера ширин активных вариантов.
          opacity:0 + position:absolute + top:-9999 — не виден и не перехватывает тапы. */}
      <View style={styles.measureRow} pointerEvents="none">
        {TABS.map(({ key, Icon, labelKey }, index) => (
          <View
            key={key}
            style={styles.measureCell}
            onLayout={(e) => handleMeasure(index, e.nativeEvent.layout.width)}
          >
            <Icon size={ACTIVE_ICON_SIZE} color={COLOR_INACTIVE} />
            <Text style={styles.label} numberOfLines={1}>{t(labelKey)}</Text>
          </View>
        ))}
      </View>

      {/* Видимая капсула. Вокруг — прозрачно, контент страницы виден за щелями.
          Внутри — матовый блюр (как iOS / Telegram): BlurView размывает пиксели
          страницы под пилюлей, поверх — лёгкая белая вуаль для контраста иконок. */}
      <View style={styles.pillShadow} pointerEvents="auto">
        <View style={styles.pillClip}>
          <BlurView
            intensity={50}
            tint="light"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            style={[StyleSheet.absoluteFill, styles.pillTint]}
            pointerEvents="none"
          />

          {allMeasured && (
            <Animated.View
              style={[
                styles.subPill,
                {
                  backgroundColor: TABS[activeTab].bgColor,
                  borderWidth:     1,
                  borderColor:     TABS[activeTab].color,
                  width:           animW,
                  transform:       [{ translateX: animX }],
                },
              ]}
              pointerEvents="none"
            />
          )}

          <View style={styles.row}>
            {TABS.map(({ key, Icon, color, labelKey }, index) => {
              const isActive = activeTab === index;
              const w        = cellWidthFor(index);

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.cell, { width: w }]}
                  onPress={() => onSelect(index)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                >
                  {isActive ? (
                    <View style={styles.activeContent}>
                      <Icon size={ACTIVE_ICON_SIZE} color={color} />
                      <Text style={[styles.label, { color }]} numberOfLines={1}>
                        {t(labelKey)}
                      </Text>
                    </View>
                  ) : (
                    <Icon size={INACTIVE_ICON_SIZE} color={COLOR_INACTIVE} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:             '100%',
    backgroundColor:   'transparent',
    justifyContent:    'flex-start',
    paddingTop:        PILL_TOP_GAP,
    paddingHorizontal: PILL_SIDE_INSET,
  },

  measureRow: {
    position:      'absolute',
    top:           -9999,
    left:          0,
    flexDirection: 'row',
    opacity:       0,
  },
  measureCell: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: ACTIVE_PADDING_H,
    gap:               ACTIVE_GAP,
    height:            SUB_PILL_HEIGHT,
  },

  pillShadow: {
    height:          TAB_BAR_CONTENT_HEIGHT,
    borderRadius:    TAB_BAR_CONTENT_HEIGHT / 2,
    // backgroundColor отсутствует — пилюля полупрозрачная, заливку даёт BlurView.
    // Микроскопический non-zero фон нужен только для iOS shadow rasterization.
    backgroundColor: 'rgba(255,255,255,0.001)',
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.08,
    shadowRadius:    14,
    elevation:       6,
  },
  pillClip: {
    flex:            1,
    borderRadius:    TAB_BAR_CONTENT_HEIGHT / 2,
    backgroundColor: 'transparent',
    overflow:        'hidden',
  },
  // Лёгкая белая вуаль поверх блюра — поднимает контраст иконок и текста,
  // не убивая ощущение «матового стекла».
  pillTint: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  subPill: {
    position:     'absolute',
    top:          (TAB_BAR_CONTENT_HEIGHT - SUB_PILL_HEIGHT) / 2,
    left:         0,
    height:       SUB_PILL_HEIGHT,
    borderRadius: SUB_PILL_RADIUS,
  },
  row: {
    position:      'absolute',
    top:           0,
    left:          0,
    right:         0,
    bottom:        0,
    flexDirection: 'row',
    alignItems:    'center',
  },
  cell: {
    height:         TAB_BAR_CONTENT_HEIGHT,
    alignItems:     'center',
    justifyContent: 'center',
  },
  activeContent: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               ACTIVE_GAP,
    paddingHorizontal: ACTIVE_PADDING_H,
  },
  label: {
    fontSize:      LABEL_FONT_SIZE,
    fontWeight:    '600',
    letterSpacing: -0.2,
  },
});
