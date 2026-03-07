import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import Constants from 'expo-constants';
import dayjs from 'dayjs';
import CalendarRangePicker from 'react-native-calendar-range-picker';
import { useLanguage } from '../context/LanguageContext';
import { getBookings } from '../services/bookingsService';
import { getProperties } from '../services/propertiesService';
import { getContactById } from '../services/contactsService';
import { getCalendarEvents } from '../services/calendarEventsService';
import AddCalendarEventModal from '../components/AddCalendarEventModal';
import AddBookingModal from '../components/AddBookingModal';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#81C784', '#4DB6AC', '#64B5F6',
];

const CALENDAR_LOCALES = {
  en: { monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], today: 'Today', year: '' },
  ru: { monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], today: 'Сегодня', year: '' },
  th: { monthNames: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'], dayNames: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'], today: 'วันนี้', year: '' },
};

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return timeStr;
}

function getBookingNumber(booking, allBookings) {
  const year = new Date(booking.checkIn).getFullYear();
  const yearShort = year % 100;
  const sameYear = (allBookings || [])
    .filter(x => new Date(x.checkIn).getFullYear() === year)
    .sort((a, b) => new Date(a.createdAt || a.checkIn) - new Date(b.createdAt || b.checkIn));
  const idx = sameYear.findIndex(x => x.id === booking.id);
  const seq = idx >= 0 ? idx + 1 : 0;
  return `${seq}/${String(yearShort).padStart(2, '0')}`;
}

const DRAWER_ANIMATION = {
  duration: 300,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

function SectionBlock({ color, border, children }) {
  return (
    <View style={[styles.sectionBlock, { backgroundColor: color, borderColor: border }]}>
      {children}
    </View>
  );
}

function EventCard({ event, expanded, onToggle, onEdit, isBooking, t }) {
  const [contactName, setContactName] = useState('');

  useEffect(() => {
    if (!isBooking || !event.booking) return;
    const b = event.booking;
    if (b.notMyCustomer) {
      setContactName(t('ownerCustomer'));
      return;
    }
    if (!b.contactId) {
      setContactName('');
      return;
    }
    getContactById(b.contactId).then((c) => {
      setContactName(c ? `${c.name} ${c.lastName}`.trim() : '');
    }).catch(() => setContactName(''));
  }, [isBooking, event?.booking?.contactId, event?.booking?.notMyCustomer, t]);

  if (isBooking) {
    const typeLabel = event.eventType === 'checkIn' ? t('agentCalendarCheckIn') : t('agentCalendarCheckOut');
    const displayName = contactName || (event.booking?.notMyCustomer ? t('ownerCustomer') : '');
    return (
      <View style={[styles.eventCard, { borderLeftColor: event.color }]}>
        <View style={styles.eventRow}>
          <TouchableOpacity style={styles.eventMainArea} onPress={() => {}} activeOpacity={1}>
            <Text style={styles.eventTypeLabel}>{typeLabel}</Text>
            <Text style={styles.eventName} numberOfLines={1}>{displayName}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggle} style={styles.expandBtn} activeOpacity={0.5}>
            <Image source={require('../../assets/icon-arrow-down.png')} style={[styles.arrowIcon, expanded && styles.arrowIconUp]} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        {expanded && (
          <View style={styles.eventExpanded}>
            <View style={styles.eventDetailRow}>
              <Image source={require('../../assets/icon-property-house.png')} style={styles.eventDetailIcon} resizeMode="contain" />
              <Text style={styles.eventDetailText}>{event.propertyLabel || '—'}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Image source={require('../../assets/icon-calendar-booking.png')} style={styles.eventDetailIcon} resizeMode="contain" />
              <Text style={styles.eventDetailText}>{event.booking?.notMyCustomer ? 'N/A' : (event.bookingNum || '—')}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>{t('editContact')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.eventCard, { borderLeftColor: event.color }]}>
      <View style={styles.eventRow}>
        <TouchableOpacity style={styles.eventMainArea} onPress={() => {}} activeOpacity={1}>
          <View style={[styles.customEventDot, { backgroundColor: event.color }]} />
          <Text style={styles.eventName} numberOfLines={1}>{event.title}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggle} style={styles.expandBtn} activeOpacity={0.5}>
          <Image source={require('../../assets/icon-arrow-down.png')} style={[styles.arrowIcon, expanded && styles.arrowIconUp]} resizeMode="contain" />
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.eventExpanded}>
          {(event.eventDate || event.eventTime) && (
            <Text style={styles.eventDetailText}>
              {formatDateDisplay(event.eventDate)}
              {event.eventTime ? ` ${formatTimeDisplay(event.eventTime)}` : ''}
            </Text>
          )}
          {event.comments ? (
            <Text style={styles.eventComments}>{event.comments}</Text>
          ) : null}
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.editBtnText}>{t('editContact')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AgentCalendarScreen({ isVisible, onBookingEdit }) {
  const { t, language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(() => formatDateYMD(new Date()));
  const [bookings, setBookings] = useState([]);
  const [customEvents, setCustomEvents] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEventVisible, setAddEventVisible] = useState(false);
  const [addBookingVisible, setAddBookingVisible] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, e, p] = await Promise.all([
        getBookings(),
        getCalendarEvents(),
        getProperties(),
      ]);
      setBookings(b);
      setCustomEvents(e);
      setProperties(p);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isVisible) loadData();
  }, [isVisible, loadData]);

  const toggleExpandAll = () => {
    LayoutAnimation.configureNext(DRAWER_ANIMATION);
    if (!allExpanded) {
      const ids = new Set();
      dayEvents.forEach((ev, i) => ids.add(ev.key));
      setExpandedIds(ids);
      setAllExpanded(true);
    } else {
      setExpandedIds(new Set());
      setAllExpanded(false);
    }
  };

  const toggleExpand = (key) => {
    LayoutAnimation.configureNext(DRAWER_ANIMATION);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openAddEvent = () => {
    setEditEvent(null);
    setAddEventVisible(true);
  };

  const openEditEvent = (ev) => {
    setEditEvent(ev);
    setAddEventVisible(true);
  };

  const openEditBooking = (ev) => {
    setEditBooking(ev.booking);
    setAddBookingVisible(true);
  };

  const viewBookingDetail = (ev) => {
    setSelectedBooking({ booking: ev.booking });
  };

  const mergedDayEvents = React.useMemo(() => {
    const list = [];
    const propsMap = {};
    (properties || []).forEach(p => { propsMap[p.id] = p; });
    const getPropertyLabel = (b) => {
      const prop = propsMap[b.propertyId];
      if (!prop) return '—';
      const resort = prop.resort_id ? propsMap[prop.resort_id] : null;
      const code = resort ? (resort.code || resort.name) : (prop.code || prop.name);
      const unit = prop.code_suffix ? ` (${prop.code_suffix})` : '';
      return `${code}${unit}`.trim() || '—';
    };

    (bookings || []).forEach(b => {
      if (!b.checkIn) return;
      const d = dayjs(b.checkIn).format('YYYY-MM-DD');
      if (d === selectedDate) {
        list.push({
          key: `b-in-${b.id}`,
          type: 'booking',
          eventType: 'checkIn',
          color: b.notMyCustomer ? '#BDBDBD' : '#81C784',
          booking: b,
          propertyLabel: getPropertyLabel(b),
          bookingNum: getBookingNumber(b, bookings),
          notMyCustomer: b.notMyCustomer,
        });
      }
      if (b.checkOut) {
        const dOut = dayjs(b.checkOut).format('YYYY-MM-DD');
        if (dOut === selectedDate) {
          list.push({
            key: `b-out-${b.id}`,
            type: 'booking',
            eventType: 'checkOut',
            color: b.notMyCustomer ? '#BDBDBD' : '#E57373',
            booking: b,
            propertyLabel: getPropertyLabel(b),
            bookingNum: getBookingNumber(b, bookings),
            notMyCustomer: b.notMyCustomer,
          });
        }
      }
    });

    (customEvents || []).forEach(e => {
      const d = e.eventDate ? dayjs(e.eventDate).format('YYYY-MM-DD') : null;
      if (d === selectedDate) {
        list.push({
          key: `c-${e.id}`,
          type: 'custom',
          ...e,
        });
      }
    });

    list.sort((a, b) => {
      const timeA = a.type === 'booking' ? (a.eventType === 'checkIn' ? '00:00' : '23:59') : (a.eventTime || '00:00');
      const timeB = b.type === 'booking' ? (b.eventType === 'checkIn' ? '00:00' : '23:59') : (b.eventTime || '00:00');
      return (timeA || '').localeCompare(timeB || '');
    });
    return list;
  }, [selectedDate, bookings, customEvents, properties]);

  const dayEvents = mergedDayEvents;

  const eventCountsByDate = React.useMemo(() => {
    const counts = {};
    (bookings || []).forEach((b) => {
      if (b.checkIn) {
        const d = dayjs(b.checkIn).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }
      if (b.checkOut && b.checkOut !== b.checkIn) {
        const d = dayjs(b.checkOut).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    (customEvents || []).forEach((e) => {
      if (e.eventDate) {
        const d = dayjs(e.eventDate).format('YYYY-MM-DD');
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    return counts;
  }, [bookings, customEvents]);

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{t('agentCalendarTitle')}</Text>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={openAddEvent}
            activeOpacity={0.7}
          >
            <Image source={require('../../assets/icon-add-calendar-event.png')} style={styles.headerIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.step2Content}>
          <View style={[styles.calendarInline, styles.calendarInlineStep2]} collapsable={false}>
            <CalendarRangePicker
              locale={CALENDAR_LOCALES[language] || CALENDAR_LOCALES.en}
              startDate={selectedDate}
              endDate={selectedDate}
              singleSelectMode
              onChange={(date) => date && setSelectedDate(date)}
              eventCountsByDate={eventCountsByDate}
              pastYearRange={1}
              futureYearRange={2}
              isMonthFirst
              dimPastDates
              style={{
                container: { backgroundColor: 'transparent' },
                dayTextColor: '#1d1c1d',
                holidayColor: '#E85D4C',
                selectedDayBackgroundColor: '#FFB74D',
                monthOverlayContainer: {
                  width: Math.round((Math.min(SCREEN_WIDTH - 72, 368)) * 0.8),
                  height: 360,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 12,
                  marginRight: 16,
                  overflow: 'hidden',
                },
                monthNameContainer: {
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingLeft: 0,
                  paddingRight: 0,
                },
                monthNameText: { textAlign: 'center' },
              }}
              flatListProps={(() => {
                const w = Math.round((Math.min(SCREEN_WIDTH - 72, 368)) * 0.8);
                const slot = w + 16;
                const viewportWidth = SCREEN_WIDTH - 40;
                const padH = Math.max(0, (viewportWidth - w) / 2);
                const monthCount = (1 + 2) * 12;
                return {
                  horizontal: true,
                  nestedScrollEnabled: true,
                  removeClippedSubviews: false,
                  scrollEventThrottle: 16,
                  bounces: true,
                  alwaysBounceHorizontal: true,
                  snapToOffsets: Array.from({ length: monthCount }, (_, i) => {
                    const itemCenter = padH + slot * i + slot / 2;
                    return itemCenter - viewportWidth / 2;
                  }),
                  snapToAlignment: 'center',
                  decelerationRate: 'fast',
                  getItemLayout: (_, index) => ({ length: slot, offset: slot * index, index }),
                  contentContainerStyle: { paddingHorizontal: padH },
                  showsHorizontalScrollIndicator: false,
                };
              })()}
            />
          </View>
        </View>

        <View style={styles.eventsSection}>
        <SectionBlock color="rgba(187,222,251,0.5)" border="#64B5F6">
          <View style={styles.toolbarRow}>
            <TouchableOpacity style={styles.toolbarBtn} onPress={openAddEvent} activeOpacity={0.7}>
              <Image source={require('../../assets/icon-calendar-booking.png')} style={styles.toolbarIcon} resizeMode="contain" />
              <Text style={styles.toolbarBtnPlus}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn} onPress={toggleExpandAll} activeOpacity={0.7}>
              <Image
                source={allExpanded ? require('../../assets/icon-folder-open.png') : require('../../assets/icon-folder-closed.png')}
                style={styles.toolbarIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#64B5F6" style={{ marginVertical: 24 }} />
          ) : dayEvents.length === 0 ? (
            <Text style={styles.emptyText}>{t('agentCalendarNoEvents')}</Text>
          ) : (
            dayEvents.map((ev) => (
              <EventCard
                key={ev.key}
                event={ev}
                expanded={expandedIds.has(ev.key)}
                onToggle={() => toggleExpand(ev.key)}
                onEdit={ev.type === 'booking' ? () => openEditBooking(ev) : () => openEditEvent(ev)}
                isBooking={ev.type === 'booking'}
                t={t}
              />
            ))
          )}
        </SectionBlock>
        </View>
      </ScrollView>

      <AddCalendarEventModal
        visible={addEventVisible}
        onClose={() => { setAddEventVisible(false); setEditEvent(null); }}
        onSaved={loadData}
        editEvent={editEvent}
        initialDate={selectedDate}
      />

      <AddBookingModal
        visible={addBookingVisible}
        onClose={() => { setAddBookingVisible(false); setEditBooking(null); }}
        onSaved={() => { loadData(); setEditBooking(null); }}
        property={editBooking ? (properties || []).find(p => p.id === editBooking.propertyId) : null}
        editBooking={editBooking}
        initialMonth={selectedDate ? (() => {
          if (!selectedDate) return null;
          const [y, m] = selectedDate.split('-');
          return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
        })() : null}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerSpacer: {
    width: 36,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 26,
    height: 26,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  step2Content: {
    flexShrink: 1,
    padding: 14,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  calendarInline: {
    marginBottom: 16,
  },
  calendarInlineStep2: { marginBottom: 14 },
  eventsSection: {
    paddingHorizontal: 16,
  },
  sectionBlock: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  toolbarIcon: {
    width: 24,
    height: 24,
  },
  toolbarBtnPlus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
    marginLeft: 4,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B6B6B',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  eventMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  eventTypeLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginRight: 8,
  },
  customEventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  eventName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  expandBtn: {
    padding: 6,
  },
  arrowIcon: {
    width: 14,
    height: 14,
    tintColor: '#888',
    transform: [{ rotate: '-90deg' }],
  },
  arrowIconUp: {
    transform: [{ rotate: '90deg' }],
  },
  eventExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDetailIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
    tintColor: '#6B6B6B',
  },
  eventDetailText: {
    fontSize: 14,
    color: '#2C2C2C',
  },
  eventComments: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  editBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E8E4DE',
    borderRadius: 8,
    marginTop: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
  },
});
