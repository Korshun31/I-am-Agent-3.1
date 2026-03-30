import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Alert,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import {
  getNotifications,
  markAllRead,
  deleteNotification,
} from '../services/notificationsService';

const SCREEN_HEIGHT    = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.80;

// ── Типы уведомлений ──────────────────────────────────────────────────────────
const PENDING_TYPES  = new Set(['property_submitted', 'edit_submitted', 'price_submitted']);
const APPROVED_TYPES = new Set(['property_approved',  'edit_approved',  'price_approved']);
const REJECTED_TYPES = new Set(['property_rejected',  'edit_rejected',  'price_rejected']);

// Цвет точки-индикатора
function dotColor(type) {
  if (APPROVED_TYPES.has(type)) return '#4CAF50';
  if (REJECTED_TYPES.has(type)) return '#E53935';
  if (PENDING_TYPES.has(type))  return '#FFA726';
  return '#9E9E9E';
}

// Ключ заголовка карточки для approve/reject/pending типов
function cardHeadingKey(type) {
  if (APPROVED_TYPES.has(type)) return 'notifCardApproved';
  if (REJECTED_TYPES.has(type)) return 'notifCardRejected';
  if (PENDING_TYPES.has(type))  return 'notifCardSubmitted';
  return null;
}

// Строка кода объекта: "BPT051" или "BPT051-A"
function formatCode(prop) {
  if (!prop?.code) return null;
  return prop.code_suffix ? `${prop.code}-${prop.code_suffix}` : prop.code;
}

// Убираем технический префикс ("Причина: " / "Reason: " и т.д.),
// который мог попасть в тело уведомления при его создании.
const REASON_PREFIXES = ['Причина:', 'Reason:', 'เหตุผล:'];
function stripReasonPrefix(body) {
  if (!body) return body;
  for (const prefix of REASON_PREFIXES) {
    if (body.startsWith(prefix)) {
      return body.slice(prefix.length).trim();
    }
  }
  return body;
}

// ── Карточка уведомления ──────────────────────────────────────────────────────
function NotificationCard({ notif, t, onDelete, onOpenProperty }) {
  const [expanded, setExpanded] = useState(false);
  const isRejected  = REJECTED_TYPES.has(notif.type);
  const isUnread    = !notif.is_read;
  const isRead      = !!notif.is_read;
  const headingKey  = cardHeadingKey(notif.type);
  const dotClr      = isRead ? '#B0B7C3' : dotColor(notif.type);

  // Данные объекта из join (могут отсутствовать для старых уведомлений)
  const prop        = notif.properties ?? null;
  const propName    = prop?.name ?? null;
  const propCode    = formatCode(prop);
  const hasProperty = !!(propName || propCode);
  const canNavigate = !!(notif.property_id && onOpenProperty);

  const handleDeletePress = () => {
    Alert.alert(
      t('notifDeleteTitle'),
      t('notifDeleteConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => onDelete(notif.id) },
      ],
    );
  };

  const handleOpenProperty = () => {
    if (canNavigate) onOpenProperty(notif.property_id);
  };

  return (
    <View style={[s.card, isUnread && s.cardUnread]}>
      {/* Цветная точка-индикатор */}
      <View style={[s.dot, { backgroundColor: dotClr }]} />

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={s.cardTextWrap}>
            {headingKey ? (
              <>
                {/* Заголовок: "Изменения приняты" / "Изменения отклонены" */}
                <Text style={[s.cardHeading, isUnread && s.cardHeadingUnread, isRead && s.cardHeadingRead]}>
                  {t(headingKey)}
                </Text>
                {/* Название объекта + жирный малиновый код — тап открывает объект */}
                {hasProperty && (
                  <TouchableOpacity
                    onPress={canNavigate ? handleOpenProperty : undefined}
                    activeOpacity={canNavigate ? 0.55 : 1}
                    disabled={!canNavigate}
                  >
                    <Text style={[s.cardPropLine, canNavigate && s.cardPropLineNav, isRead && s.cardPropLineRead, canNavigate && isRead && s.cardPropLineNavRead]}>
                      {propName && propCode
                        ? <><Text style={[s.cardPropName, isRead && s.cardPropNameRead]}>{propName}{' '}</Text><Text style={[s.cardPropCode, isRead && s.cardPropCodeRead]}>{propCode}</Text></>
                        : propCode
                          ? <Text style={[s.cardPropCode, isRead && s.cardPropCodeRead]}>{propCode}</Text>
                          : <Text style={[s.cardPropName, isRead && s.cardPropNameRead]}>{propName}</Text>
                      }
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Для остальных типов — стандартный title
              <Text style={[s.cardTitle, isUnread && s.cardTitleUnread, isRead && s.cardTitleRead]} numberOfLines={3}>
                {notif.title || '—'}
              </Text>
            )}
          </View>

          {/* Крестик удаления */}
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.deleteBtnText, isRead && s.deleteBtnTextRead]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Причина отклонения — отдельная кнопка toggle + раскрытый блок */}
        {isRejected && notif.body && (
          <>
            <TouchableOpacity
              onPress={() => setExpanded(v => !v)}
              activeOpacity={0.65}
              style={s.reasonToggle}
            >
              <Text style={[s.reasonToggleText, isRead && s.reasonToggleTextRead]}>
                {expanded ? '▾' : '▸'} {t('propRejectionReason')}
              </Text>
            </TouchableOpacity>
            {expanded && (
              <View style={[s.reasonBlock, isRead && s.reasonBlockRead]}>
                <Text style={[s.reasonLabel, isRead && s.reasonLabelRead]}>{t('notifReasonLabel')}</Text>
                <Text style={[s.reasonText, isRead && s.reasonTextRead]}>{stripReasonPrefix(notif.body)}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE_OUT_OPEN = Easing.out(Easing.cubic);
const EASE_IN_CLOSE = Easing.in(Easing.cubic);

// ── Основной компонент ────────────────────────────────────────────────────────
export default function PropertyNotificationsModal({ visible, onClose, onBadgeUpdate, refreshSignal, onOpenProperty }) {
  const { t } = useLanguage();
  const [notifs, setNotifs]                   = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [internalVisible, setInternalVisible] = useState(false);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  // Старт всегда с SCREEN_HEIGHT → панель гарантированно ниже экрана до анимации
  const panelAnim    = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isClosingRef = useRef(false);

  // ── Анимации ──────────────────────────────────────────────────────────────
  // Открытие и закрытие симметричны: backdrop и панель имеют одинаковую длительность
  // внутри каждой пары, чтобы не было "вспышки" фона до прихода панели.
  const animateIn = useCallback(() => {
    // Сброс до начальных позиций перед стартом (важно при повторном открытии)
    backdropAnim.setValue(0);
    panelAnim.setValue(SCREEN_HEIGHT);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 520,          // совпадает с панелью → нет опережения фона
        easing: EASE_OUT_OPEN,
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 520,          // медленнее и плавнее, чем было (420ms)
        easing: EASE_OUT_OPEN,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropAnim, panelAnim]);

  const animateOut = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 320,          // совпадает с панелью
        easing: EASE_IN_CLOSE,
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 320,
        easing: EASE_IN_CLOSE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) callback?.();
    });
  }, [backdropAnim, panelAnim]);

  // ── Монтирование ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setInternalVisible(true);
    }
  }, [visible]);

  useEffect(() => {
    if (internalVisible && visible) animateIn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalVisible]);

  // ── Close guard ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    animateOut(() => {
      setInternalVisible(false);
      isClosingRef.current = false;
      onClose?.();
    });
  }, [animateOut, onClose]);

  // Закрываем модалку с анимацией, затем вызываем внешний callback навигации
  const handleOpenProperty = useCallback((propertyId) => {
    if (!propertyId || !onOpenProperty) return;
    if (isClosingRef.current) {
      onOpenProperty(propertyId);
      return;
    }
    isClosingRef.current = true;
    animateOut(() => {
      setInternalVisible(false);
      isClosingRef.current = false;
      onClose?.();
      onOpenProperty(propertyId);
    });
  }, [animateOut, onClose, onOpenProperty]);

  // ── Данные ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 60 });
      setNotifs(data);
    } catch (e) {
      console.warn('[PropertyNotificationsModal] load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    load();
    markAllRead().then(() => onBadgeUpdate?.()).catch(() => {});
  }, [visible]);

  // Внешний триггер от realtime-подписки в RealEstateScreen:
  // если модалка открыта и не закрывается — перезагружаем список.
  useEffect(() => {
    if (!refreshSignal) return;               // 0 = initial, пропускаем
    if (!internalVisible) return;             // модалка не смонтирована
    if (isClosingRef.current) return;         // идёт анимация закрытия
    load();
  }, [refreshSignal]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteNotification(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
      onBadgeUpdate?.();
    } catch (e) {
      console.warn('[PropertyNotificationsModal] delete error:', e.message);
    }
  }, [onBadgeUpdate]);

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop: только fade, не двигается */}
      <Animated.View
        style={[s.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />

      <View style={s.layout}>
        {/* Тап выше панели — закрытие */}
        <Pressable style={s.dismissArea} onPress={handleClose} />

        {/*
          Sheet = Animated.View, единый блок.
          Высота — только от контента, ограничена maxHeight: 80%.
          Никакого принудительного минимума: вместо него — паддинги
          в пустом состоянии, которые дают естественную высоту.
          translateY двигает весь блок целиком.
        */}
        <Animated.View
          style={[s.sheet, { transform: [{ translateY: panelAnim }] }]}
        >
          <View style={s.dragHandle} />

          <View style={s.header}>
            <View style={s.headerSpacer} />
            <Text style={s.headerTitle}>{t('notifications')}</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.8}>
              <Text style={s.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            // Спиннер с паддингами — даёт естественную высоту панели
            <View style={s.stateWrap}>
              <ActivityIndicator size="large" color="#9E9E9E" />
            </View>
          ) : notifs.length === 0 ? (
            // Пустое состояние с большими паддингами — панель выглядит комфортно
            <View style={s.stateWrap}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyTitle}>{t('notifNoItems')}</Text>
            </View>
          ) : (
            /*
              Список: ScrollView с maxHeight = MAX_SHEET_HEIGHT - overhead.
              Когда контента мало — ScrollView имеет естественную высоту.
              Когда контента много — упирается в maxHeight и включает скролл.
            */
            <ScrollView
              style={s.list}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              bounces
              keyboardShouldPersistTaps="handled"
            >
              {notifs.map(n => (
                <NotificationCard
                  key={n.id}
                  notif={n}
                  t={t}
                  onDelete={handleDelete}
                  onOpenProperty={handleOpenProperty}
                />
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Стили ─────────────────────────────────────────────────────────────────────
const SHEET_BG = '#FAFAF8';
const BORDER   = '#E8E4DE';
const MUTED    = '#888';

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.45)',
  },
  layout: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Высота — только от контента. Ограничение сверху: 80% экрана.
    maxHeight: MAX_SHEET_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0CCC6',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerSpacer: { width: 36 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#E85D4C',
    fontWeight: '600',
  },
  // Обёртка для loading и empty — большие паддинги дают панели визуальный объём
  stateWrap: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIcon: {
    fontSize: 36,
    opacity: 0.35,
  },
  emptyTitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
  },
  // ScrollView: растёт по контенту, ограничен maxHeight родителя (sheet)
  list: {
    // без flex:1 — пусть ScrollView занимает столько, сколько нужно контенту
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardUnread: {
    borderColor: '#D0E8F0',
    backgroundColor: '#F3FAFD',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTextWrap: {
    flex: 1,
    gap: 3,
  },
  // Для approve/reject/pending — форматированный заголовок
  cardHeading: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    lineHeight: 20,
  },
  cardHeadingUnread: {
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardHeadingRead: {
    color: '#4D545D',
  },
  cardPropLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardPropLineNav: {
    textDecorationLine: 'underline',
    textDecorationColor: '#D81B60',
  },
  cardPropLineRead: {
    color: '#2F343A',
  },
  cardPropLineNavRead: {
    textDecorationColor: '#9AA1AA',
  },
  cardPropName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardPropNameRead: {
    color: '#2F343A',
  },
  cardPropCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D81B60',   // малиновый — как в PropertyItem
  },
  cardPropCodeRead: {
    color: '#5F6670',
  },
  // Для остальных типов — стандартный title
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    lineHeight: 20,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardTitleRead: {
    color: '#2F343A',
  },
  deleteBtn: {
    paddingTop: 2,
  },
  deleteBtnText: {
    fontSize: 13,
    color: '#BBBBBB',
    fontWeight: '600',
  },
  deleteBtnTextRead: {
    color: '#8A919B',
  },
  reasonBlock: {
    marginTop: 6,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 2,
  },
  reasonBlockRead: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D6DAE0',
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C62828',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reasonLabelRead: {
    color: '#5F6670',
  },
  reasonText: {
    fontSize: 13,
    color: '#5D1A1A',
    lineHeight: 18,
  },
  reasonTextRead: {
    color: '#4F5661',
  },
  reasonToggle: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  reasonToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C62828',
    lineHeight: 20,
  },
  reasonToggleTextRead: {
    color: '#5F6670',
  },
});
