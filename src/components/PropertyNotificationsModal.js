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
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import {
  getNotifications,
  markAllRead,
  deleteNotification,
} from '../services/notificationsService';

const SCREEN_HEIGHT    = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.80;

// Строка кода объекта: "BPT051" или "BPT051-A"
function formatCode(prop) {
  if (!prop?.code) return null;
  return prop.code_suffix ? `${prop.code}-${prop.code_suffix}` : prop.code;
}

// ── Карточка уведомления ──────────────────────────────────────────────────────
function NotificationCard({ notif, t, onDelete, onOpenProperty }) {
  const isUnread = !notif.is_read;
  const isRead   = !!notif.is_read;
  const dotClr   = isRead ? '#B0B7C3' : '#3D7D82';

  // Данные объекта из join (могут отсутствовать)
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
      <View style={[s.dot, { backgroundColor: dotClr }]} />

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={s.cardTextWrap}>
            <Text style={[s.cardTitle, isUnread && s.cardTitleUnread, isRead && s.cardTitleRead]} numberOfLines={3}>
              {notif.title || '—'}
            </Text>
            {hasProperty && (
              <TouchableOpacity
                onPress={canNavigate ? handleOpenProperty : undefined}
                activeOpacity={canNavigate ? 0.55 : 1}
                disabled={!canNavigate}
              >
                <Text style={[s.cardPropLine, canNavigate && s.cardPropLineNav, isRead && s.cardPropLineRead]}>
                  {propName && propCode
                    ? <><Text style={[s.cardPropName, isRead && s.cardPropNameRead]}>{propName}{' '}</Text><Text style={[s.cardPropCode, isRead && s.cardPropCodeRead]}>{propCode}</Text></>
                    : propCode
                      ? <Text style={[s.cardPropCode, isRead && s.cardPropCodeRead]}>{propCode}</Text>
                      : <Text style={[s.cardPropName, isRead && s.cardPropNameRead]}>{propName}</Text>
                  }
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.deleteBtnText, isRead && s.deleteBtnTextRead]}>✕</Text>
          </TouchableOpacity>
        </View>
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
  const panelAnim    = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isClosingRef = useRef(false);

  const animateIn = useCallback(() => {
    backdropAnim.setValue(0);
    panelAnim.setValue(SCREEN_HEIGHT);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 520,
        easing: EASE_OUT_OPEN,
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 520,
        easing: EASE_OUT_OPEN,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropAnim, panelAnim]);

  const animateOut = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 320,
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

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    animateOut(() => {
      setInternalVisible(false);
      isClosingRef.current = false;
      onClose?.();
    });
  }, [animateOut, onClose]);

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

  useEffect(() => {
    if (!refreshSignal) return;
    if (!internalVisible) return;
    if (isClosingRef.current) return;
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
      <Animated.View
        style={[s.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />

      <View style={s.layout}>
        <Pressable style={s.dismissArea} onPress={handleClose} />

        <Animated.View
          style={[s.sheet, { transform: [{ translateY: panelAnim }] }]}
        >
          <View style={s.dragHandle} />

          <View style={s.header}>
            <View style={s.headerSpacer} />
            <Text style={s.headerTitle}>{t('notifications')}</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.stateWrap}>
              <ActivityIndicator size="large" color="#9E9E9E" />
            </View>
          ) : notifs.length === 0 ? (
            <View style={s.stateWrap}>
              <Ionicons name="notifications-outline" size={40} color="#3D7D82" />
              <Text style={s.emptyTitle}>{t('notifNoItems')}</Text>
            </View>
          ) : (
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
const SHEET_BG = '#FFFFFF';
const BORDER   = 'rgba(0,0,0,0.07)';
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerSpacer: { width: 36 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2C',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {},
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
    color: '#D81B60',
  },
  cardPropCodeRead: {
    color: '#5F6670',
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
});
