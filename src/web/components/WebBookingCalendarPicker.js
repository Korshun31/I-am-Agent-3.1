import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  bg:        '#F4F6F9',
  surface:   '#FFFFFF',
  border:    '#E9ECEF',
  text:      '#212529',
  muted:     '#6C757D',
  light:     '#ADB5BD',
  danger:    '#E53935',
  dangerBg:  '#FFF5F5',
  accentBg:  '#EAF4F5',
};

const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Строим множество занятых дней [checkIn, checkOut)
function buildOccupiedSet(bookedRanges) {
  const set = new Set();
  (bookedRanges || []).forEach(({ checkIn, checkOut }) => {
    if (!checkIn || !checkOut) return;
    let d = dayjs(checkIn);
    const end = dayjs(checkOut); // checkOut — НЕ включаем
    while (d.isBefore(end, 'day')) {
      set.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  });
  return set;
}

// Проверяем, есть ли занятая дата в диапазоне (для валидации выбора)
function hasOccupiedInRange(start, end, occupiedSet) {
  if (!start || !end) return false;
  let d = dayjs(start).add(1, 'day');
  const endDay = dayjs(end);
  while (d.isBefore(endDay, 'day')) {
    if (occupiedSet.has(d.format('YYYY-MM-DD'))) return true;
    d = d.add(1, 'day');
  }
  return false;
}

export default function WebBookingCalendarPicker({
  visible,
  onClose,
  checkIn,
  checkOut,
  onSelect,
  bookedRanges,
}) {
  const { t } = useLanguage();

  const today = dayjs().startOf('day');
  const [viewMonth, setViewMonth] = useState(() => {
    const base = checkIn ? dayjs(checkIn) : today;
    return base.startOf('month');
  });
  const [selecting, setSelecting] = useState(null); // 'in' | 'out' | null
  const [hoverDate, setHoverDate] = useState(null);
  const [tempIn, setTempIn] = useState(checkIn || null);
  const [tempOut, setTempOut] = useState(checkOut || null);
  const [rangeError, setRangeError] = useState(false);

  const occupiedSet = useMemo(() => buildOccupiedSet(bookedRanges), [bookedRanges]);

  // Синхронизируем при открытии
  useEffect(() => {
    if (visible) {
      setTempIn(checkIn || null);
      setTempOut(checkOut || null);
      setSelecting(null);
      setHoverDate(null);
      setRangeError(false);
      const base = checkIn ? dayjs(checkIn) : today;
      setViewMonth(base.startOf('month'));
    }
  }, [visible]);

  const prevMonth = () => setViewMonth(m => m.subtract(1, 'month'));
  const nextMonth = () => setViewMonth(m => m.add(1, 'month'));

  const handleDayPress = (dateStr) => {
    const d = dayjs(dateStr);
    setRangeError(false);

    // Первый клик — выбираем checkIn
    if (!selecting || selecting === 'in' || (selecting === 'out' && d.isBefore(dayjs(tempIn), 'day'))) {
      setTempIn(dateStr);
      setTempOut(null);
      setSelecting('out');
      return;
    }

    // Второй клик — выбираем checkOut
    if (selecting === 'out') {
      if (d.isSame(dayjs(tempIn), 'day')) {
        // Клик по той же дате — сброс
        setTempIn(null);
        setTempOut(null);
        setSelecting('in');
        return;
      }
      // Проверяем нет ли занятых дат в диапазоне
      if (hasOccupiedInRange(tempIn, dateStr, occupiedSet)) {
        setRangeError(true);
        return;
      }
      setTempOut(dateStr);
      setSelecting(null);
    }
  };

  const handleConfirm = () => {
    if (tempIn && tempOut) {
      onSelect(tempIn, tempOut);
      onClose();
    }
  };

  const handleClear = () => {
    setTempIn(null);
    setTempOut(null);
    setSelecting('in');
    setRangeError(false);
  };

  // Строим сетку дней для текущего месяца
  const calendarDays = useMemo(() => {
    const firstDay = viewMonth.startOf('month');
    // Понедельник = 0 в нашей сетке (dayjs: 0=Sun, 1=Mon, ..., 6=Sat)
    const startOffset = (firstDay.day() + 6) % 7; // сдвиг чтобы неделя с Пн
    const daysInMonth = viewMonth.daysInMonth();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(viewMonth.date(i));
    }
    return cells;
  }, [viewMonth]);

  const getDateStyle = (dayjsDate) => {
    if (!dayjsDate) return {};
    const dateStr = dayjsDate.format('YYYY-MM-DD');
    const isOccupied = occupiedSet.has(dateStr);
    const isPast = dayjsDate.isBefore(today, 'day');
    const isIn = tempIn && dateStr === tempIn;
    const isOut = tempOut && dateStr === tempOut;

    // Диапазон выделения (или предпросмотр при hover)
    const hoverRangeBlocked = selecting === 'out' && tempIn && hoverDate && hoverDate > tempIn
      && hasOccupiedInRange(tempIn, hoverDate, occupiedSet);

    let inRange = false;
    const rangeEnd = tempOut || (selecting === 'out' && hoverDate ? hoverDate : null);
    if (tempIn && rangeEnd && !isIn) {
      const rangeEndDay = dayjs(rangeEnd);
      if (dayjsDate.isAfter(dayjs(tempIn), 'day') && dayjsDate.isBefore(rangeEndDay, 'day') && !hoverRangeBlocked) {
        inRange = true;
      }
    }

    return { isOccupied, isPast, isIn, isOut, inRange, dateStr };
  };

  const canConfirm = tempIn && tempOut && !rangeError;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={s.popup}>

            {/* Заголовок */}
            <View style={s.header}>
              <Text style={s.title}>{t('selectDates') || 'Select dates'}</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Выбранные даты */}
            <View style={s.selectedRow}>
              <TouchableOpacity
                style={[s.dateChip, (!tempIn || selecting === 'in') && s.dateChipActive]}
                onPress={() => { setSelecting('in'); setTempOut(null); setRangeError(false); }}
              >
                <Text style={s.dateChipLabel}>{t('checkIn') || 'Check-in'}</Text>
                <Text style={[s.dateChipValue, !tempIn && s.dateChipPlaceholder]}>
                  {tempIn ? dayjs(tempIn).format(t('dateFormat') || 'DD.MM.YYYY') : '—'}
                </Text>
              </TouchableOpacity>
              <Text style={s.dateArrow}>→</Text>
              <TouchableOpacity
                style={[s.dateChip, selecting === 'out' && s.dateChipActive]}
                onPress={() => tempIn && setSelecting('out')}
              >
                <Text style={s.dateChipLabel}>{t('checkOut') || 'Check-out'}</Text>
                <Text style={[s.dateChipValue, !tempOut && s.dateChipPlaceholder]}>
                  {tempOut ? dayjs(tempOut).format(t('dateFormat') || 'DD.MM.YYYY') : '—'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Подсказка по шагу выбора */}
            <Text style={s.hint}>
              {selecting === 'in' || !tempIn
                ? (t('calPickerSelectCheckIn') || 'Select check-in date')
                : selecting === 'out'
                  ? (t('calPickerSelectCheckOut') || 'Select check-out date')
                  : tempIn && tempOut
                    ? `${dayjs(tempOut).diff(dayjs(tempIn), 'day')} ${t('nights') || 'nights'}`
                    : ''}
            </Text>

            {rangeError && (
              <Text style={s.rangeError}>
                {t('calPickerRangeError') || 'Selected range includes occupied dates'}
              </Text>
            )}

            {/* Навигация по месяцу */}
            <View style={s.monthNav}>
              <TouchableOpacity style={s.monthNavBtn} onPress={prevMonth}>
                <Text style={s.monthNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={s.monthTitle}>
                {viewMonth.format('MMMM YYYY')}
              </Text>
              <TouchableOpacity style={s.monthNavBtn} onPress={nextMonth}>
                <Text style={s.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Заголовки дней недели */}
            <View style={s.weekRow}>
              {DAYS_SHORT.map(d => (
                <Text key={d} style={s.weekDayLabel}>{d}</Text>
              ))}
            </View>

            {/* Сетка дней */}
            <View style={s.grid}>
              {calendarDays.map((dayjsDate, idx) => {
                if (!dayjsDate) {
                  return <View key={`empty-${idx}`} style={s.dayCell} />;
                }
                const { isOccupied, isPast, isIn, isOut, inRange, dateStr } = getDateStyle(dayjsDate);
                const isDisabled = isPast || isOccupied;

                let cellBg = 'transparent';
                let textColor = C.text;
                let borderColor = 'transparent';

                if (isIn || isOut) {
                  cellBg = ACCENT;
                  textColor = '#FFF';
                } else if (inRange) {
                  cellBg = C.accentBg;
                  textColor = ACCENT;
                } else if (isOccupied) {
                  cellBg = C.dangerBg;
                  textColor = C.danger;
                } else if (isPast) {
                  textColor = C.light;
                }

                if (isIn || isOut) borderColor = ACCENT;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      s.dayCell,
                      { backgroundColor: cellBg, borderColor },
                      (isIn || isOut) && s.dayCellSelected,
                      isOccupied && s.dayCellOccupied,
                    ]}
                    onPress={() => !isDisabled && handleDayPress(dateStr)}
                    onMouseEnter={() => selecting === 'out' && tempIn && setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                    disabled={isDisabled}
                    activeOpacity={isDisabled ? 1 : 0.7}
                  >
                    <Text style={[s.dayText, { color: textColor }, isPast && s.dayTextPast]}>
                      {dayjsDate.date()}
                    </Text>
                    {isOccupied && <View style={s.occupiedDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Легенда */}
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: ACCENT }]} />
                <Text style={s.legendText}>{t('checkIn') || 'Check-in'} / {t('checkOut') || 'Check-out'}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.danger }]} />
                <Text style={s.legendText}>{t('calPickerOccupied') || 'Occupied'}</Text>
              </View>
            </View>

            {/* Кнопки */}
            <View style={s.actions}>
              <TouchableOpacity style={s.clearBtn} onPress={handleClear}>
                <Text style={s.clearBtnText}>{t('reset') || 'Reset'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, !canConfirm && s.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm}
              >
                <Text style={s.confirmBtnText}>{t('apply') || 'Apply'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  popup: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    width: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  // Заголовок
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: C.bg,
  },
  closeBtnText: {
    fontSize: 14,
    color: C.muted,
    fontWeight: '600',
  },

  // Чипы выбранных дат
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dateChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.bg,
  },
  dateChipActive: {
    borderColor: ACCENT,
    backgroundColor: C.accentBg,
  },
  dateChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateChipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  dateChipPlaceholder: {
    color: C.light,
    fontWeight: '400',
  },
  dateArrow: {
    fontSize: 18,
    color: C.muted,
  },

  // Подсказка
  hint: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: '500',
    marginBottom: 4,
    minHeight: 16,
  },
  rangeError: {
    fontSize: 12,
    color: C.danger,
    fontWeight: '500',
    marginBottom: 4,
    backgroundColor: C.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // Навигация
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: C.bg,
  },
  monthNavArrow: {
    fontSize: 20,
    color: C.text,
    lineHeight: 24,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    textTransform: 'capitalize',
  },

  // Заголовки дней недели
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Сетка
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  dayCellSelected: {
    borderRadius: 10,
  },
  dayCellOccupied: {
    opacity: 0.85,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
  },
  dayTextPast: {
    opacity: 0.4,
  },
  occupiedDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.danger,
  },

  // Легенда
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: C.muted,
  },

  // Кнопки
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  clearBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
  },
  confirmBtn: {
    flex: 2,
    height: 44,
    backgroundColor: ACCENT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
