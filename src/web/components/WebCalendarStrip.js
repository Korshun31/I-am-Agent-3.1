import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import dayjs from 'dayjs';
import { getBookings } from '../../services/bookingsService';
import { getCalendarEvents, eventOccursOnDate } from '../../services/calendarEventsService';
import { getCommissionDateAmounts } from '../../services/commissionRemindersService';

const CARD_WIDTH = 70; // 60 (width) + 10 (margins 5+5)

export default function WebCalendarStrip({ selectedDate, onDateSelect }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [commissionEvents, setCommissionEvents] = useState([]);
  const [days, setDays] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Генерируем дни: 60 дней назад и 120 дней вперед
    const list = [];
    const start = dayjs().subtract(60, 'day');
    for (let i = 0; i < 180; i++) {
      list.push(start.add(i, 'day'));
    }
    setDays(list);

    async function loadData() {
      try {
        const [bData, eData] = await Promise.all([
          getBookings(),
          getCalendarEvents()
        ]);
        setBookings(bData);
        setCalendarEvents(eData);

        // Расчет комиссий
        const allComms = [];
        bData.forEach(b => {
          if (b.ownerCommissionOneTime || b.ownerCommissionMonthly) {
            const dates = getCommissionDateAmounts(b.checkIn, b.checkOut, b.ownerCommissionOneTime, b.ownerCommissionMonthly);
            dates.forEach(d => {
              allComms.push(d.date);
            });
          }
        });
        setCommissionEvents(allComms);
      } catch (e) {
        console.error('Calendar strip load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const scrollToToday = () => {
    if (flatListRef.current && containerWidth > 0) {
      const todayIndex = days.findIndex(d => d.isSame(dayjs(), 'day'));
      if (todayIndex !== -1) {
        const offset = (todayIndex * CARD_WIDTH) - (containerWidth / 2) + (CARD_WIDTH / 2);
        flatListRef.current.scrollToOffset({
          offset: offset > 0 ? offset : 0,
          animated: false
        });
      }
    }
  };

  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (!loading && days.length > 0 && containerWidth > 0 && !initialScrollDone.current) {
      const timer = setTimeout(() => {
        scrollToToday();
        initialScrollDone.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, days, containerWidth]);

  const getDayEvents = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const hasCheckIn = bookings.some(b => b.checkIn === dateStr && !b.notMyCustomer);
    const hasCheckOut = bookings.some(b => b.checkOut === dateStr);
    const hasPersonalEvent = calendarEvents.some(e => eventOccursOnDate(e, dateStr));
    const hasCommission = commissionEvents.includes(dateStr);
    return { hasCheckIn, hasCheckOut, hasPersonalEvent, hasCommission };
  };

  const renderDay = ({ item: day }) => {
    const isSelected = day.isSame(selectedDate, 'day');
    const isToday = day.isSame(dayjs(), 'day');
    const { hasCheckIn, hasCheckOut, hasPersonalEvent, hasCommission } = getDayEvents(day);

    return (
      <TouchableOpacity
        style={[
          styles.dayCard,
          isSelected && styles.daySelected,
          isToday && !isSelected && styles.dayToday
        ]}
        onPress={() => onDateSelect(day)}
      >
        <View style={styles.dayCardInner}>
          <Text style={[styles.monthText, isSelected && styles.textSelected]}>
            {day.format('MMM').toUpperCase()}
          </Text>
          <View style={styles.dotContainer}>
            {hasCheckIn && (
              <View style={[styles.eventDot, styles.dotIn, isSelected && styles.dotSelected]} />
            )}
            {hasCheckOut && (
              <View style={[styles.eventDot, styles.dotOut, isSelected && styles.dotSelected]} />
            )}
            {hasPersonalEvent && (
              <View style={[styles.eventDot, styles.dotPersonal, isSelected && styles.dotSelected]} />
            )}
            {hasCommission && (
              <View style={[styles.eventDot, styles.dotComm, isSelected && styles.dotSelected]} />
            )}
          </View>
          <Text style={[styles.dateText, isSelected && styles.textSelected]}>
            {day.date()}
          </Text>
          <Text style={[styles.dayNameText, isSelected && styles.textSelected]}>
            {day.format('ddd').toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator size="small" color="#D81B60" />;

  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <FlatList
        ref={flatListRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.format('YYYY-MM-DD')}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={(data, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    height: 100,
  },
  scrollContent: {
    alignItems: 'center',
  },
  dayCard: {
    width: 60,
    height: 90,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dayCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dotContainer: {
    height: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  daySelected: {
    backgroundColor: '#D81B60',
    borderColor: '#D81B60',
  },
  dayToday: {
    borderColor: '#D81B60',
    borderWidth: 2,
  },
  monthText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ADB5BD',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#212529',
    lineHeight: 20,
  },
  dayNameText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#868E96',
  },
  textSelected: {
    color: '#FFFFFF',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotIn: {
    backgroundColor: '#4CAF50',
  },
  dotOut: {
    backgroundColor: '#D81B60',
  },
  dotPersonal: {
    backgroundColor: '#0088CC',
  },
  dotComm: {
    backgroundColor: '#FF9800',
  },
  dotSelected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
