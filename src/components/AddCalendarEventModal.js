import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Platform,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../context/LanguageContext';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/calendarEventsService';
import { requestReminderPermissions, scheduleReminder, cancelReminder } from '../services/calendarRemindersService';
import { getCurrentUser } from '../services/authService';

const REMINDER_OPTIONS = [
  { value: 0, key: 'agentCalendarReminderAtEvent' },
  { value: 5, key: 'agentCalendarReminder5min' },
  { value: 10, key: 'agentCalendarReminder10min' },
  { value: 15, key: 'agentCalendarReminder15min' },
  { value: 30, key: 'agentCalendarReminder30min' },
  { value: 60, key: 'agentCalendarReminder1h' },
  { value: 120, key: 'agentCalendarReminder2h' },
  { value: 1440, key: 'agentCalendarReminder1d' },
];

const CALENDAR_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#81C784', '#4DB6AC', '#64B5F6',
];

const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'],
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
};

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return timeStr;
}

export default function AddCalendarEventModal({ visible, onClose, onSaved, editEvent, initialDate }) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [eventTime, setEventTime] = useState(null);
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [comments, setComments] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (showTimePicker || showReminderPicker) Keyboard.dismiss();
  }, [showTimePicker, showReminderPicker]);

  useEffect(() => {
    if (visible) {
      if (editEvent) {
        setTitle(editEvent.title || '');
        setEventDate(editEvent.eventDate ? new Date(editEvent.eventDate) : null);
        setEventTime(editEvent.eventTime || null);
        setColor(editEvent.color || CALENDAR_COLORS[0]);
        setComments(editEvent.comments || '');
        setReminderMinutes(editEvent.reminderMinutes ?? null);
      } else {
        const base = initialDate ? new Date(initialDate) : new Date();
        setTitle('');
        setEventDate(base);
        setEventTime(null);
        setColor(CALENDAR_COLORS[0]);
        setComments('');
        setReminderMinutes(null);
      }
    }
  }, [visible, editEvent, initialDate]);

  const handleSave = async () => {
    const name = (title || '').trim();
    if (!name) {
      Alert.alert(t('error'), t('agentCalendarEventNameRequired'));
      return;
    }
    const dateToUse = eventDate || new Date();
    const timeStr = eventTime ? formatTimeDisplay(eventTime) : null;
    const dateYMD = formatDateYMD(dateToUse);
    setSaving(true);
    try {
      if (isEdit) {
        await cancelReminder(editEvent.id);
        await updateCalendarEvent(editEvent.id, {
          title: name,
          eventDate: dateYMD,
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes: reminderMinutes,
        });
        if (reminderMinutes !== null && reminderMinutes !== undefined) {
          const profile = await getCurrentUser();
          const settings = profile?.notificationSettings || {};
          const granted = await requestReminderPermissions();
          if (granted) {
            await scheduleReminder(editEvent.id, dateYMD, timeStr, reminderMinutes, name, settings);
          }
        }
      } else {
        const created = await createCalendarEvent({
          title: name,
          eventDate: dateYMD,
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes: reminderMinutes,
        });
        if (created?.id && reminderMinutes !== null && reminderMinutes !== undefined) {
          const profile = await getCurrentUser();
          const settings = profile?.notificationSettings || {};
          const granted = await requestReminderPermissions();
          if (granted) {
            await scheduleReminder(created.id, dateYMD, timeStr, reminderMinutes, name, settings);
          }
        }
      }
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!isEdit) return;
    Alert.alert(t('agentCalendarDeleteEvent'), t('agentCalendarDeleteEventConfirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await cancelReminder(editEvent.id);
            await deleteCalendarEvent(editEvent.id);
            onSaved?.();
            onClose();
          } catch (e) {
            Alert.alert(t('error'), e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const onTimeChange = (_, selectedDate) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      setEventTime(`${h}:${m}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
            <View style={styles.headerRow}>
              {isEdit ? (
                <TouchableOpacity onPress={handleDelete} style={styles.trashBtn} activeOpacity={0.7}>
                  <Image source={require('../../assets/trash-icon.png')} style={styles.trashIcon} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <View style={styles.trashBtn} />
              )}
              <Text style={styles.title}>{isEdit ? t('agentCalendarEditEvent') : t('agentCalendarAddEvent')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateHeaderRow}>
              <Text style={styles.dateHeaderText}>
                {(() => {
                  const d = eventDate || (initialDate ? new Date(initialDate) : new Date());
                  const day = d.getDate();
                  const month = (MONTH_NAMES[language] || MONTH_NAMES.en)[d.getMonth()];
                  const year = d.getFullYear();
                  const yearLast2 = String(year).slice(-2);
                  return (
                    <>
                      <Text style={styles.dateHeaderRed}>{day}</Text>
                      {' '}{month} 20<Text style={styles.dateHeaderRed}>{yearLast2}</Text>
                    </>
                  );
                })()}
              </Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventName')}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('agentCalendarEventNamePlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="sentences"
                editable={!showTimePicker && !showReminderPicker}
                showSoftInputOnFocus={!showTimePicker && !showReminderPicker}
              />

              <Text style={styles.fieldLabel}>{t('agentCalendarEventTime')}</Text>
              <TouchableOpacity style={styles.timeSelectRow} onPress={() => { Keyboard.dismiss(); setShowTimePicker(true); }} activeOpacity={0.7}>
                <Text style={styles.timeSelectText}>
                  {eventTime ? formatTimeDisplay(eventTime) : t('agentCalendarSelectEventTime')}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={eventTime ? (() => {
                      const [h, m] = (eventTime || '00:00').split(':').map(Number);
                      return new Date(2000, 0, 1, h || 0, m || 0);
                    })() : new Date()}
                    mode="time"
                    display="spinner"
                    onChange={onTimeChange}
                  />
                  <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerDone}>
                    <Text style={styles.pickerDoneText}>{t('agentCalendarTimeSelectBtn')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('agentCalendarReminder')}</Text>
              <TouchableOpacity style={styles.timeSelectRow} onPress={() => { Keyboard.dismiss(); setShowReminderPicker(true); }} activeOpacity={0.7}>
                <Text style={styles.timeSelectText}>
                  {reminderMinutes !== null
                    ? t(REMINDER_OPTIONS.find(o => o.value === reminderMinutes)?.key || 'agentCalendarReminderAtEvent')
                    : t('agentCalendarReminderWhen')}
                </Text>
              </TouchableOpacity>
              {showReminderPicker && (
                <View style={styles.pickerWrap}>
                  <ScrollView style={styles.reminderPickerScroll} showsVerticalScrollIndicator>
                    {REMINDER_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.reminderOption, reminderMinutes === opt.value && styles.reminderOptionSelected]}
                        onPress={() => setReminderMinutes(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.reminderOptionText, reminderMinutes === opt.value && styles.reminderOptionTextSelected]}>
                          {t(opt.key)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity onPress={() => setShowReminderPicker(false)} style={styles.pickerDone}>
                    <Text style={styles.pickerDoneText}>{t('agentCalendarTimeSelectBtn')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('agentCalendarEventColor')}</Text>
              <View style={styles.colorRow}>
                {CALENDAR_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('agentCalendarEventComments')}</Text>
              <TextInput
                style={[styles.input, styles.commentsInput]}
                value={comments}
                onChangeText={setComments}
                placeholder={t('agentCalendarEventCommentsPlaceholder')}
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                editable={!showTimePicker && !showReminderPicker}
                showSoftInputOnFocus={!showTimePicker && !showReminderPicker}
              />
            </ScrollView>

            {!showTimePicker && !showReminderPicker && (
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  keyboardWrap: {
    width: '100%',
    maxHeight: '90%',
  },
  box: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  trashBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashIcon: {
    width: 22,
    height: 22,
    tintColor: '#EB5757',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeIcon: {
    fontSize: 22,
    color: '#6B6B6B',
  },
  dateHeaderRow: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  dateHeaderRed: {
    color: '#E53935',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F2EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C2C2C',
    borderWidth: 1,
    borderColor: '#E0D8CC',
    marginBottom: 16,
  },
  commentsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  timeSelectRow: {
    marginBottom: 16,
  },
  timeSelectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D81B60',
  },
  pickerWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  reminderPickerScroll: {
    maxHeight: 220,
    width: '100%',
  },
  reminderOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  reminderOptionSelected: {
    backgroundColor: 'rgba(216, 27, 96, 0.08)',
  },
  reminderOptionText: {
    fontSize: 16,
    color: '#2C2C2C',
  },
  reminderOptionTextSelected: {
    fontWeight: '700',
    color: '#D81B60',
  },
  pickerDone: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#2C2C2C',
  },
  saveBtn: {
    backgroundColor: '#2E7D32',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
