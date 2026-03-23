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
import { approveProperty, approvePropertyDraft, rejectProperty, rejectPropertyDraft } from '../../services/propertiesService';
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

// Человекочитаемые названия полей объекта для diff-таблицы
const FIELD_LABELS = {
  name:                     'Название',
  city:                     'Город',
  district:                 'Район',
  address:                  'Адрес',
  bedrooms:                 'Спален',
  bathrooms:                'Санузлов',
  area:                     'Площадь (м²)',
  floors:                   'Этажей',
  houses_count:             'Кол-во домов',
  air_conditioners:         'Кондиционеры',
  internet_speed:           'Интернет (Мбит/с)',
  beach_distance:           'До пляжа (м)',
  market_distance:          'До магазина (м)',
  google_maps_link:         'Google Maps',
  website_url:              'Сайт объекта',
  description:              'Описание',
  price_monthly:            'Цена/мес',
  booking_deposit:          'Депозит бронирования',
  save_deposit:             'Сохранный депозит',
  commission:               'Комиссия от клиента',
  owner_commission_one_time:'Комиссия от собств. разовая',
  owner_commission_monthly: 'Комиссия от собств. ежемес.',
  electricity_price:        'Электричество',
  water_price:              'Вода',
  gas_price:                'Газ',
  internet_price:           'Интернет/мес',
  cleaning_price:           'Уборка',
  exit_cleaning_price:      'Уборка при выезде',
  pets_allowed:             'Питомцы разрешены',
  long_term_booking:        'Длинные даты',
  video_url:                'Видео ссылка',
};

// Поля которые не показываем в diff (технические / не информативные)
const DIFF_SKIP_FIELDS = new Set([
  'photos', 'amenities', 'currency', 'code', 'code_suffix', 'type',
  'location_id', 'resort_id', 'owner_id', 'owner_id_2',
  'price_monthly_is_from', 'booking_deposit_is_from', 'save_deposit_is_from',
  'commission_is_from', 'owner_commission_one_time_is_from',
  'owner_commission_one_time_is_percent', 'owner_commission_monthly_is_from',
  'owner_commission_monthly_is_percent', 'water_price_type',
]);

// Уведомления которые требуют действия от Админа
const ACTION_TYPES = new Set(['property_submitted', 'edit_submitted', 'price_submitted']);

// Форматирование значения поля для отображения в diff
function formatValue(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? '✅ Да' : '❌ Нет';
  return String(val);
}

// Модальное окно с карточками изменений и встроенным принятием решения
function DiffModal({ visible, onClose, draft, originalProperty, onApprove, onReject }) {
  // Локальный стейт для режима ввода причины отклонения
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  // Сброс режима при закрытии/открытии модала
  React.useEffect(() => {
    if (!visible) {
      setRejectMode(false);
      setReason('');
    }
  }, [visible]);

  if (!draft || !originalProperty) return null;

  // Вычисляем только изменённые поля
  const changes = [];
  const draftData = draft.draft_data || {};
  for (const [field, newVal] of Object.entries(draftData)) {
    if (DIFF_SKIP_FIELDS.has(field)) continue;
    const label = FIELD_LABELS[field];
    if (!label) continue;
    const oldVal = originalProperty[field];
    const oldStr = formatValue(oldVal);
    const newStr = formatValue(newVal);
    if (oldStr === newStr) continue;
    changes.push({ label, oldStr, newStr });
  }

  const propName = originalProperty.name || null;

  const handleApprove = () => {
    onApprove?.();
    onClose();
  };

  const handleRejectConfirm = () => {
    onReject?.(reason);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade"
           onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={sd.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={e => e.stopPropagation()}
        >
          <View style={sd.popup}>

            {/* Заголовок с названием объекта и крестиком */}
            <View style={sd.header}>
              <View style={sd.headerLeft}>
                <View>
                  <Text style={sd.title}>Изменения объекта</Text>
                  {propName ? (
                    <Text style={sd.subtitle}>{propName}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity style={sd.closeBtn} onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={sd.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Счётчик изменений */}
            {changes.length > 0 && (
              <View style={sd.countRow}>
                <Text style={sd.countText}>
                  {changes.length} {changes.length === 1 ? 'изменение' : changes.length < 5 ? 'изменения' : 'изменений'}
                </Text>
              </View>
            )}

            {/* Компактная таблица изменений */}
            <ScrollView style={sd.scroll} showsVerticalScrollIndicator={false}
                        contentContainerStyle={sd.scrollContent}>
              {changes.length === 0 ? (
                <Text style={sd.empty}>Нет отслеживаемых изменений</Text>
              ) : (
                <>
                  {/* Шапка таблицы */}
                  <View style={sd.tableHead}>
                    <Text style={[sd.tableHeadCell, sd.colField]}>Поле</Text>
                    <Text style={[sd.tableHeadCell, sd.colOld]}>Было</Text>
                    <Text style={sd.tableArrow}>{' '}</Text>
                    <Text style={[sd.tableHeadCell, sd.colNew]}>Стало</Text>
                  </View>
                  {/* Строки изменений */}
                  {changes.map((c, i) => {
                    const isLong = (c.oldStr || '').length > 60 || (c.newStr || '').length > 60;
                    if (isLong) {
                      return (
                        <View key={i} style={[sd.tableRowExpanded, i % 2 === 0 && sd.tableRowEven]}>
                          <Text style={sd.expandedFieldLabel}>{c.label}</Text>
                          <View style={sd.expandedValuesRow}>
                            <View style={sd.expandedBlock}>
                              <Text style={sd.expandedBlockLabel}>Было</Text>
                              <ScrollView style={sd.expandedScroll} nestedScrollEnabled>
                                <Text style={sd.expandedOldText}>{c.oldStr}</Text>
                              </ScrollView>
                            </View>
                            <View style={sd.expandedBlock}>
                              <Text style={sd.expandedBlockLabel}>Стало</Text>
                              <ScrollView style={sd.expandedScroll} nestedScrollEnabled>
                                <Text style={sd.expandedNewText}>{c.newStr}</Text>
                              </ScrollView>
                            </View>
                          </View>
                        </View>
                      );
                    }
                    return (
                      <View key={i} style={[sd.tableRow, i % 2 === 0 && sd.tableRowEven]}>
                        <Text style={[sd.tableCell, sd.colField, sd.fieldText]} numberOfLines={2}>
                          {c.label}
                        </Text>
                        <Text style={[sd.tableCell, sd.colOld, sd.oldText]} numberOfLines={2}>
                          {c.oldStr}
                        </Text>
                        <Text style={sd.tableArrow}>→</Text>
                        <Text style={[sd.tableCell, sd.colNew, sd.newText]} numberOfLines={2}>
                          {c.newStr}
                        </Text>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>

            {/* Зона принятия решения — за пределами ScrollView */}
            <View style={sd.actionZone}>
              {!rejectMode ? (
                /* Состояние A: кнопки «Одобрить» и «Отклонить» */
                <View style={sd.actionBtns}>
                  <TouchableOpacity style={sd.approveBtn} onPress={handleApprove}>
                    <Text style={sd.approveBtnText}>✓ Одобрить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={sd.rejectBtn} onPress={() => setRejectMode(true)}>
                    <Text style={sd.rejectBtnText}>✕ Отклонить</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Состояние B: форма ввода причины отклонения */
                <>
                  <TextInput
                    style={sd.rejectInput}
                    placeholder="Причина отклонения..."
                    placeholderTextColor="#ADB5BD"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    autoFocus
                  />
                  <View style={sd.rejectActions}>
                    <TouchableOpacity
                      style={sd.backBtn}
                      onPress={() => { setRejectMode(false); setReason(''); }}
                    >
                      <Text style={sd.backBtnText}>Назад</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={sd.rejectConfirmBtn} onPress={handleRejectConfirm}>
                      <Text style={sd.rejectConfirmBtnText}>Отклонить</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function NotificationItem({ item, onDelete, onApprove, onReject, onViewDiff }) {
  const time = dayjs(item.created_at).fromNow();
  const needsAction = ACTION_TYPES.has(item.type) && !item.action_taken;
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <View style={[s.item, !item.is_read && s.itemUnread]}>
      <View style={s.itemRow}>
        {/* Цветная точка статуса: красная — ждёт действия, тиловая — выполнено, серая — инфо */}
        <View style={s.statusDot}>
          <View style={[
            s.statusDotInner,
            needsAction
              ? s.statusDotPending
              : ['property_approved', 'edit_approved', 'price_approved'].includes(item.type)
                ? s.statusDotDone
                : ['property_rejected', 'edit_rejected', 'price_rejected'].includes(item.type)
                  ? s.statusDotRejected
                  : s.statusDotInfo
          ]} />
        </View>
        <View style={s.itemBody}>
          <Text style={s.itemTitle}>
            {(item.title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()}
          </Text>
          {!!item.body && (
            <Text style={s.itemBodyText}>
              {(item.body || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()}
            </Text>
          )}
          <Text style={s.itemTime}>{time}</Text>
        </View>
        <TouchableOpacity style={s.itemDelete} onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.itemDeleteText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Кнопки действия — только для Админа, только если не выполнено */}
      {needsAction && (
        item.type === 'edit_submitted' ? (
          /* Для edit_submitted: только кнопка открытия DiffModal с принятием решения */
          <TouchableOpacity style={s.diffBtn} onPress={() => onViewDiff(item)}>
            <Text style={s.diffBtnText}>🔍 Посмотреть и принять решение</Text>
          </TouchableOpacity>
        ) : (
          /* Для property_submitted / price_submitted: стандартные кнопки */
          <>
            {!rejectMode && (
              <View style={s.actionRow}>
                <TouchableOpacity style={s.approveBtn} onPress={() => onApprove(item)}>
                  <Text style={s.approveBtnText}>✓ Одобрить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => setRejectMode(true)}>
                  <Text style={s.rejectBtnText}>✕ Отклонить</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Форма причины отклонения — только для не-edit_submitted */}
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
          </>
        )
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
  const [diffModal, setDiffModal]   = useState(null); // { draft, originalProperty } или null
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
        // Ищем pending черновик для этого объекта
        const { data: draft } = await supabase
          .from('property_drafts')
          .select('id')
          .eq('property_id', notif.property_id)
          .eq('status', 'pending')
          .maybeSingle();

        if (draft) {
          // Есть черновик — применяем его (draft_data копируется в properties)
          await approvePropertyDraft(draft.id);
        } else {
          // Нет черновика — это новый объект на модерации (create/create-unit flow)
          await approveProperty(notif.property_id);
        }
      }
      await markActionTaken(notif.id);
      setNotifs(prev => prev.map(n =>
        n.id === notif.id ? { ...n, action_taken: true } : n
      ));
      // Уведомляем агента
      if (notif.sender_id) {
        const typeMap = {
          property_submitted: 'property_approved',
          edit_submitted: 'edit_approved',
          price_submitted: 'price_approved',
        };
        await sendNotification({
          recipientId: notif.sender_id,
          senderId: userId,
          type: typeMap[notif.type] || 'property_approved',
          title: 'Изменения одобрены',
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
        const { data: draft } = await supabase
          .from('property_drafts')
          .select('id')
          .eq('property_id', notif.property_id)
          .eq('status', 'pending')
          .maybeSingle();

        if (draft) {
          // Есть черновик — отклоняем его (данные в properties не меняются)
          await rejectPropertyDraft(draft.id, reason);
        } else {
          // Нет черновика — это новый объект (create flow), отклоняем объект
          await rejectProperty(notif.property_id, reason);
        }
      }
      await markActionTaken(notif.id);
      setNotifs(prev => prev.map(n =>
        n.id === notif.id ? { ...n, action_taken: true } : n
      ));
      if (notif.sender_id) {
        const typeMap = {
          property_submitted: 'property_rejected',
          edit_submitted: 'edit_rejected',
          price_submitted: 'price_rejected',
        };
        await sendNotification({
          recipientId: notif.sender_id,
          senderId: userId,
          type: typeMap[notif.type] || 'property_rejected',
          title: 'Изменения отклонены',
          body: reason ? `Причина: ${reason}` : notif.title,
          propertyId: notif.property_id,
        });
      }
    } catch (e) {
      console.warn('reject error', e);
    }
  };

  // Загружаем черновик и оригинальный объект для показа diff
  const handleViewDiff = async (notif) => {
    if (!notif.property_id) return;
    try {
      const [draftRes, propRes] = await Promise.all([
        supabase
          .from('property_drafts')
          .select('*')
          .eq('property_id', notif.property_id)
          .eq('status', 'pending')
          .maybeSingle(),
        supabase
          .from('properties')
          .select('*')
          .eq('id', notif.property_id)
          .single(),
      ]);
      if (draftRes.data && propRes.data) {
        // Сохраняем notif чтобы вызвать handleApprove/handleReject прямо из DiffModal
        setDiffModal({ draft: draftRes.data, originalProperty: propRes.data, notif });
      }
    } catch (e) {
      console.warn('handleViewDiff error', e);
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
                    onViewDiff={handleViewDiff}
                  />
                ))}
              </ScrollView>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Модальное окно просмотра изменений с принятием решения */}
      <DiffModal
        visible={!!diffModal}
        onClose={() => setDiffModal(null)}
        draft={diffModal?.draft}
        originalProperty={diffModal?.originalProperty}
        onApprove={() => {
          if (diffModal?.notif) handleApprove(diffModal.notif);
          setDiffModal(null);
        }}
        onReject={(reason) => {
          if (diffModal?.notif) handleReject(diffModal.notif, reason);
          setDiffModal(null);
        }}
      />
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
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  itemBodyText: { fontSize: 12, color: C.muted, lineHeight: 17 },
  itemTime: { fontSize: 11, color: C.muted, marginTop: 2 },
  itemDelete: { padding: 4 },
  itemDeleteText: { fontSize: 13, color: C.muted },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 48 },
  // Одобрить — тиловый акцент (Primary системы, не зелёный)
  approveBtn: { flex: 1, backgroundColor: '#EAF4F5', borderWidth: 1, borderColor: '#B2D8DB', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#3D7D82' },
  // Отклонить — тихий красный (честный сигнал без крика)
  rejectBtn: { flex: 1, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: '#C62828' },

  rejectForm: { marginTop: 10, marginLeft: 48, gap: 8 },
  rejectInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: C.text, outlineWidth: 0 },
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

// Стили для модального окна DiffModal (табличный дизайн)
const sd = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    width: '100%',
    maxWidth: 660,
    maxHeight: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
  },

  // Шапка модала
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#212529' },
  subtitle: { fontSize: 12, color: '#6C757D', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F4F6F9',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: { fontSize: 14, color: '#6C757D', fontWeight: '700' },

  // Счётчик изменений
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F4F6F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  countText: { fontSize: 12, color: '#6C757D', fontWeight: '600' },

  scroll: { maxHeight: 320 },
  scrollContent: { paddingVertical: 0 },

  empty: {
    textAlign: 'center',
    padding: 32,
    color: '#6C757D',
    fontSize: 14,
  },

  // Шапка таблицы
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F4F6F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  tableHeadCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ADB5BD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Строки таблицы
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingRight: 56,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6F9',
    minHeight: 40,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#FAFBFC',
  },
  tableRowExpanded: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6F9',
  },
  expandedFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  expandedValuesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  expandedBlock: {
    flex: 1,
  },
  expandedBlockLabel: {
    fontSize: 11,
    color: '#ADB5BD',
    marginBottom: 4,
  },
  expandedScroll: {
    maxHeight: 80,
  },
  expandedOldText: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 18,
  },
  expandedNewText: {
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 18,
  },
  tableCell: {
    fontSize: 13,
  },

  // Стрелка между «Было» и «Стало»
  tableArrow: {
    fontSize: 14,
    color: '#CED4DA',
    paddingHorizontal: 8,
    flexShrink: 0,
    textAlign: 'center',
    alignSelf: 'center',
  },

  // Колонки — пропорции
  colField: { flex: 3, paddingRight: 8, color: '#495057', fontWeight: '500' },
  colOld:   { flex: 2, paddingRight: 8, textAlign: 'center' },
  colNew:   { flex: 2, textAlign: 'center' },

  // Стили значений
  fieldText: {},
  oldText: {
    color: '#ADB5BD',
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },
  newText: {
    color: '#3D7D82',
    fontWeight: '700',
    textAlign: 'center',
  },

  // Зона принятия решения — фиксирована внизу модала, за пределами ScrollView
  actionZone: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  // Одобрить — Primary-кнопка системы (тил, белый текст)
  approveBtn: {
    flex: 1,
    backgroundColor: '#3D7D82',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Отклонить — тихий красный (честный сигнал без крика)
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C62828',
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#212529',
    minHeight: 72,
    outlineWidth: 0,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  backBtnText: {
    fontSize: 13,
    color: '#6C757D',
    fontWeight: '600',
  },
  // Финальное подтверждение — тихий Danger по системе (не яркий красный)
  rejectConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  rejectConfirmBtnText: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '700',
  },
});
