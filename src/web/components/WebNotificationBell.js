import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { supabase } from '../../services/supabase';
import { useLanguage } from '../../context/LanguageContext';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  deleteNotification,
} from '../../services/notificationsService';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
dayjs.extend(relativeTime);
dayjs.locale('ru');

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E9ECEF',
  text: '#212529',
  muted: '#6C757D',
  danger: '#E53935',
  unread: '#EAF4F5',
};

function NotificationItem({ item, onDelete, onNavigateToProperty }) {
  const time = dayjs(item.created_at).fromNow();
  const isRead = !!item.is_read;
  const normalizedTitle = (item.title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const normalizedBody = (item.body || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const canNavigateToProperty = !!item.property_id;

  return (
    <View style={[s.item, !item.is_read && s.itemUnread]}>
      <View style={s.itemRow}>
        <View style={s.statusDot}>
          <View style={[s.statusDotInner, isRead ? s.statusDotRead : s.statusDotInfo]} />
        </View>
        <View style={s.itemBody}>
          {canNavigateToProperty ? (
            <TouchableOpacity onPress={() => onNavigateToProperty?.(item.property_id)} activeOpacity={0.7}>
              <Text style={[s.itemTitle, s.itemTitleLink, isRead && s.itemTitleRead, isRead && s.itemTitleLinkRead]}>
                {normalizedTitle}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[s.itemTitle, isRead && s.itemTitleRead]}>{normalizedTitle}</Text>
          )}
          {!!normalizedBody && (
            <Text style={[s.itemBodyText, isRead && s.itemBodyTextRead]}>{normalizedBody}</Text>
          )}
          <Text style={[s.itemTime, isRead && s.itemTimeRead]}>{time}</Text>
        </View>
        <TouchableOpacity style={s.itemDelete} onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.itemDeleteText, isRead && s.itemDeleteTextRead]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function WebNotificationBell({ userId, onNavigateToProperty }) {
  const { t } = useLanguage();
  const [unread, setUnread]         = useState(0);
  const [open, setOpen]             = useState(false);
  const [notifications, setNotifs]  = useState([]);
  const [loading, setLoading]       = useState(false);
  const loadedRef = useRef(false);
  const openRef = useRef(false);

  const loadCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnread(count);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const data = await getNotifications({ limit: 50 });
    setNotifs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-bell-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        loadCount();
        if (openRef.current) loadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadCount, loadAll]);

  const handleOpen = async () => {
    setOpen(true);
    openRef.current = true;
    if (!loadedRef.current) {
      loadedRef.current = true;
      await loadAll();
    }
    if (unread > 0) {
      await markAllRead();
      setUnread(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const handleClose = () => {
    setOpen(false);
    openRef.current = false;
  };

  const handleNavigateToPropertyFromBell = (propertyId) => {
    if (!propertyId) return;
    setOpen(false);
    openRef.current = false;
    onNavigateToProperty?.(propertyId);
  };

  return (
    <View>
      <TouchableOpacity style={s.bell} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={s.bellIcon}>🔔</Text>
        <Text style={s.bellLabel}>{t('notifications')}</Text>
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={s.popup}>

              {/* Шапка */}
              <View style={s.popupHeader}>
                <Text style={s.popupTitle}>{`🔔 ${t('notifications')}`}</Text>
                <TouchableOpacity style={s.closeBtn} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Список */}
              <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {loading && (
                  <Text style={s.emptyText}>Загрузка...</Text>
                )}
                {!loading && notifications.length === 0 && (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyIcon}>🔕</Text>
                    <Text style={s.emptyText}>{t('notifNoItems')}</Text>
                  </View>
                )}
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    item={n}
                    onDelete={handleDelete}
                    onNavigateToProperty={handleNavigateToPropertyFromBell}
                  />
                ))}
              </ScrollView>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    position: 'relative',
  },
  bellIcon:  { fontSize: 16 },
  bellLabel: { fontSize: 15, color: '#495057', fontWeight: '500', flex: 1 },
  badge: {
    backgroundColor: C.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 80, paddingLeft: 16 },

  popup: {
    width: 380,
    maxHeight: 520,
    backgroundColor: C.surface,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  popupTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 13, color: C.muted, fontWeight: '700' },

  actionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  actionErrorText: { flex: 1, fontSize: 13, color: C.danger, fontWeight: '600', lineHeight: 18 },
  actionErrorClose: { fontSize: 14, color: C.danger, fontWeight: '700' },

  list: { maxHeight: 440 },

  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  itemUnread: { backgroundColor: C.unread },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Цветная точка статуса уведомления
  statusDot: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotPending:  { backgroundColor: '#E53935' },
  statusDotDone:     { backgroundColor: '#3D7D82' },
  statusDotRejected: { backgroundColor: '#E53935' },
  statusDotInfo:     { backgroundColor: '#CED4DA' },
  statusDotRead:     { backgroundColor: '#B0B7C3' },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  itemTitleLink: { color: '#D81B60', textDecorationLine: 'underline' },
  itemTitleRead: { color: '#2F343A' },
  itemTitleLinkRead: { color: '#2F343A', textDecorationColor: '#9AA1AA' },
  itemBodyText: { fontSize: 12, color: C.muted, lineHeight: 17 },
  itemBodyTextRead: { color: '#5F6670' },
  reasonToggleText: { fontSize: 12, color: ACCENT, fontWeight: '600', lineHeight: 17 },
  reasonToggleTextRejected: { color: '#C62828' },
  reasonToggleTextRead: { color: '#5F6670' },
  reasonExpandedBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonExpandedBoxRead: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D6DAE0',
  },
  reasonExpandedText: { fontSize: 12, color: '#C62828', lineHeight: 17 },
  reasonExpandedTextRead: { color: '#4F5661' },
  itemTime: { fontSize: 11, color: C.muted, marginTop: 2 },
  itemTimeRead: { color: '#7A828C' },
  itemDelete: { padding: 4 },
  itemDeleteText: { fontSize: 13, color: C.muted },
  itemDeleteTextRead: { color: '#8A919B' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 48 },
  // Одобрить — тиловый акцент (Primary системы, не зелёный)
  approveBtn: { flex: 1, backgroundColor: '#EAF4F5', borderWidth: 1, borderColor: '#B2D8DB', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#3D7D82' },
  // Отклонить — тихий красный (честный сигнал без крика)
  rejectBtn: { flex: 1, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: '#C62828' },

  rejectForm: { marginTop: 10, marginLeft: 48, gap: 8 },
  rejectInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.text, outlineWidth: 0 },
  rejectErrorText: { fontSize: 12, color: C.danger, fontWeight: '600' },
  rejectFormActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  rejectCancelBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  rejectCancelText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  // Финальное подтверждение отклонения — тихий danger (не яркий красный фон)
  rejectConfirmBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
  rejectConfirmText: { fontSize: 13, color: '#C62828', fontWeight: '700' },
  // Успешное действие — тиловый, не зелёный
  actionDone: { marginTop: 8, marginLeft: 48, fontSize: 12, color: '#3D7D82', fontWeight: '600' },

  // Pill-кнопка «Посмотреть изменения» для edit_submitted
  diffBtn: {
    marginLeft: 48,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B2D8DB',
    backgroundColor: '#EAF4F5',
    alignSelf: 'flex-start',
  },
  diffBtnText: {
    fontSize: 12,
    color: '#3D7D82',
    fontWeight: '600',
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', padding: 20 },
});

