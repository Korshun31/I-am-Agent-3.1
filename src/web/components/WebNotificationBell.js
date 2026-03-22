import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { supabase } from '../../services/supabase';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  deleteNotification,
  markActionTaken,
  sendNotification,
} from '../../services/notificationsService';
import { approveProperty } from '../../services/propertiesService';
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

const TYPE_ICON = {
  property_submitted: '🏠',
  property_approved:  '✅',
  property_rejected:  '❌',
  edit_submitted:     '✏️',
  edit_approved:      '✅',
  edit_rejected:      '❌',
  price_submitted:    '💰',
  price_approved:     '✅',
  price_rejected:     '❌',
};

// Уведомления которые требуют действия от Админа
const ACTION_TYPES = new Set(['property_submitted', 'edit_submitted', 'price_submitted']);

function NotificationItem({ item, onDelete, onApprove, onReject }) {
  const icon = TYPE_ICON[item.type] || '🔔';
  const time = dayjs(item.created_at).fromNow();
  const needsAction = ACTION_TYPES.has(item.type) && !item.action_taken;
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <View style={[s.item, !item.is_read && s.itemUnread]}>
      <View style={s.itemRow}>
        <View style={s.itemIcon}>
          <Text style={s.itemIconText}>{icon}</Text>
        </View>
        <View style={s.itemBody}>
          <Text style={s.itemTitle}>{item.title}</Text>
          {!!item.body && <Text style={s.itemBodyText}>{item.body}</Text>}
          <Text style={s.itemTime}>{time}</Text>
        </View>
        <TouchableOpacity style={s.itemDelete} onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.itemDeleteText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Кнопки действия — только для Админа, только если не выполнено */}
      {needsAction && !rejectMode && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.approveBtn} onPress={() => onApprove(item)}>
            <Text style={s.approveBtnText}>✓ Одобрить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.rejectBtn} onPress={() => setRejectMode(true)}>
            <Text style={s.rejectBtnText}>✕ Отклонить</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Форма причины отклонения */}
      {rejectMode && (
        <View style={s.rejectForm}>
          <TextInput
            style={s.rejectInput}
            placeholder="Причина отклонения..."
            value={reason}
            onChangeText={setReason}
            autoFocus
          />
          <View style={s.rejectFormActions}>
            <TouchableOpacity style={s.rejectCancelBtn} onPress={() => { setRejectMode(false); setReason(''); }}>
              <Text style={s.rejectCancelText}>Назад</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.rejectConfirmBtn} onPress={() => onReject(item, reason)}>
              <Text style={s.rejectConfirmText}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Уже выполнено */}
      {ACTION_TYPES.has(item.type) && item.action_taken && (
        <Text style={s.actionDone}>✓ Действие выполнено</Text>
      )}
    </View>
  );
}

export default function WebNotificationBell({ userId }) {
  const [unread, setUnread]         = useState(0);
  const [open, setOpen]             = useState(false);
  const [notifications, setNotifs]  = useState([]);
  const [loading, setLoading]       = useState(false);
  const loadedRef = useRef(false);

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

  // Загружаем счётчик при монтировании
  useEffect(() => {
    loadCount();
  }, [loadCount]);

  // Realtime: обновляем счётчик при новых уведомлениях
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notif-bell')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        loadCount();
        if (open) loadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, open, loadCount, loadAll]);

  const handleOpen = async () => {
    setOpen(true);
    if (!loadedRef.current) {
      loadedRef.current = true;
      await loadAll();
    }
    // Помечаем все как прочитанные
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

  const handleApprove = async (notif) => {
    try {
      if (notif.property_id) {
        await approveProperty(notif.property_id);
      }
      await markActionTaken(notif.id);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, action_taken: true } : n));
      // Уведомляем агента
      if (notif.sender_id) {
        const typeMap = { property_submitted: 'property_approved', edit_submitted: 'edit_approved', price_submitted: 'price_approved' };
        await sendNotification({
          recipientId: notif.sender_id,
          senderId: userId,
          type: typeMap[notif.type] || 'property_approved',
          title: '✅ Одобрено',
          body: notif.title,
          propertyId: notif.property_id,
        });
      }
    } catch (e) {
      console.warn('approve error', e);
    }
  };

  const handleReject = async (notif, reason) => {
    try {
      if (notif.property_id) {
        // Помечаем объект как отклонённый
        await supabase.from('properties').update({ property_status: 'rejected', rejection_reason: reason || null }).eq('id', notif.property_id);
      }
      await markActionTaken(notif.id);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, action_taken: true } : n));
      // Уведомляем агента
      if (notif.sender_id) {
        const typeMap = { property_submitted: 'property_rejected', edit_submitted: 'edit_rejected', price_submitted: 'price_rejected' };
        await sendNotification({
          recipientId: notif.sender_id,
          senderId: userId,
          type: typeMap[notif.type] || 'property_rejected',
          title: '❌ Отклонено',
          body: reason ? `Причина: ${reason}` : notif.title,
          propertyId: notif.property_id,
        });
      }
    } catch (e) {
      console.warn('reject error', e);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity style={s.bell} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={s.bellIcon}>🔔</Text>
        <Text style={s.bellLabel}>Уведомления</Text>
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
                <Text style={s.popupTitle}>🔔 Уведомления</Text>
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
                    <Text style={s.emptyText}>Уведомлений пока нет</Text>
                  </View>
                )}
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    item={n}
                    onDelete={handleDelete}
                    onApprove={handleApprove}
                    onReject={handleReject}
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

  list: { maxHeight: 440 },

  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  itemUnread: { backgroundColor: C.unread },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemIconText: { fontSize: 18 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  itemBodyText: { fontSize: 12, color: C.muted, lineHeight: 17 },
  itemTime: { fontSize: 11, color: C.muted, marginTop: 2 },
  itemDelete: { padding: 4 },
  itemDeleteText: { fontSize: 13, color: C.muted },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 48 },
  approveBtn: { flex: 1, backgroundColor: '#F0FAF5', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  rejectBtn: { flex: 1, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: C.danger },

  rejectForm: { marginTop: 10, marginLeft: 48, gap: 8 },
  rejectInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.text, outlineWidth: 0 },
  rejectFormActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  rejectCancelBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  rejectCancelText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  rejectConfirmBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.danger },
  rejectConfirmText: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  actionDone: { marginTop: 8, marginLeft: 48, fontSize: 12, color: '#16A34A', fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', padding: 20 },
});
