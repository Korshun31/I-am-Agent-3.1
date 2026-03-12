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
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../context/LanguageContext';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/calendarEventsService';
import { requestReminderPermissions, scheduleReminder, cancelReminders } from '../services/calendarRemindersService';
import { getCurrentUser } from '../services/authService';

const REPEAT_OPTIONS = [
  { value: null, key: 'agentCalendarRepeatNone' },
  { value: 'daily', key: 'agentCalendarRepeatDaily' },
  { value: 'weekly', key: 'agentCalendarRepeatWeekly' },
  { value: 'monthly', key: 'agentCalendarRepeatMonthly' },
  { value: 'yearly', key: 'agentCalendarRepeatYearly' },
];

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
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState([]);
  const [repeatType, setRepeatType] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (showTimePicker || showReminderModal || showRepeatModal) Keyboard.dismiss();
  }, [showTimePicker, showReminderModal, showRepeatModal]);

  useEffect(() => {
    if (visible) {
      if (editEvent) {
        setTitle(editEvent.title || '');
        setEventDate(editEvent.eventDate ? new Date(editEvent.eventDate) : null);
        setEventTime(editEvent.eventTime || null);
        setColor(editEvent.color || CALENDAR_COLORS[0]);
        setComments(editEvent.comments || '');
        setReminderMinutes(Array.isArray(editEvent.reminderMinutes) ? [...editEvent.reminderMinutes] : (editEvent.reminderMinutes != null ? [editEvent.reminderMinutes] : []));
        setRepeatType(editEvent.repeatType || null);
      } else {
        const base = initialDate ? new Date(initialDate) : new Date();
        setTitle('');
        setEventDate(base);
        setEventTime(null);
        setColor(CALENDAR_COLORS[0]);
        setComments('');
        setReminderMinutes([]);
        setRepeatType(null);
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
      const prevReminders = Array.isArray(editEvent?.reminderMinutes) ? editEvent.reminderMinutes : (editEvent?.reminderMinutes != null ? [editEvent.reminderMinutes] : []);
      if (isEdit) {
        await cancelReminders(editEvent.id, prevReminders);
        await updateCalendarEvent(editEvent.id, {
          title: name,
          eventDate: dateYMD,
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes,
          repeatType,
        });
        if (reminderMinutes.length > 0) {
          const profile = await getCurrentUser();
          const settings = profile?.notificationSettings || {};
          const granted = await requestReminderPermissions();
          if (granted) {
            for (const m of reminderMinutes) {
              await scheduleReminder(editEvent.id, dateYMD, timeStr, m, name, settings);
            }
          }
        }
      } else {
        const created = await createCalendarEvent({
          title: name,
          eventDate: dateYMD,
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes,
          repeatType,
        });
        if (created?.id && reminderMinutes.length > 0) {
          const profile = await getCurrentUser();
          const settings = profile?.notificationSettings || {};
          const granted = await requestReminderPermissions();
          if (granted) {
            for (const m of reminderMinutes) {
              await scheduleReminder(created.id, dateYMD, timeStr, m, name, settings);
            }
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
            const prevRem = Array.isArray(editEvent.reminderMinutes) ? editEvent.reminderMinutes : (editEvent.reminderMinutes != null ? [editEvent.reminderMinutes] : []);
            await cancelReminders(editEvent.id, prevRem);
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
                editable={!showTimePicker && !showReminderModal && !showRepeatModal}
                showSoftInputOnFocus={!showTimePicker && !showReminderModal && !showRepeatModal}
              />

              <Text style={styles.fieldLabel}>{t('agentCalendarEventTime')}</Text>
              <TouchableOpacity
                style={styles.timeSelectRow}
                onPress={() => {
                  Keyboard.dismiss();
                  if (!eventTime) {
                    const now = new Date();
                    setEventTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                  }
                  setShowTimePicker(true);
                }}
                activeOpacity={0.7}
              >
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
              <TouchableOpacity style={styles.timeSelectRow} onPress={() => { Keyboard.dismiss(); setShowReminderModal(true); }} activeOpacity={0.7}>
                <Text style={styles.timeSelectText}>
                  {reminderMinutes.length > 0
                    ? reminderMinutes.map((m) => t(REMINDER_OPTIONS.find(o => o.value === m)?.key || 'agentCalendarReminderAtEvent')).join(', ')
                    : t('agentCalendarReminderWhen')}
                </Text>
              </TouchableOpacity>

              {showReminderModal && (
                <Modal transparent animationType="fade" visible statusBarTranslucent>
                  <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowReminderModal(false)}>
                    {Platform.OS === 'web' ? (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                    ) : (
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    )}
                    <Pressable style={styles.reminderModalBoxWrap} onPress={(e) => e.stopPropagation()}>
                      <View style={styles.reminderModalBox}>
                        <View style={styles.reminderModalHeader}>
                          <Text style={styles.reminderModalTitle}>{t('agentCalendarReminderWhen')}</Text>
                          <TouchableOpacity onPress={() => setShowReminderModal(false)} style={styles.reminderModalClose}>
                            <Text style={styles.reminderModalCloseText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.reminderModalScroll} showsVerticalScrollIndicator>
                          {REMINDER_OPTIONS.map((opt) => {
                            const isSelected = reminderMinutes.includes(opt.value);
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[styles.reminderModalOption, isSelected && styles.reminderModalOptionSelected]}
                                onPress={() => {
                                  setReminderMinutes((prev) =>
                                    isSelected ? prev.filter((v) => v !== opt.value) : [...prev, opt.value].sort((a, b) => a - b)
                                  );
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.reminderCheckbox, isSelected && styles.reminderCheckboxChecked]}>
                                  {isSelected ? <Text style={styles.reminderCheckmark}>✓</Text> : null}
                                </View>
                                <Text style={[styles.reminderModalOptionText, isSelected && styles.reminderModalOptionTextSelected]}>
                                  {t(opt.key)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowReminderModal(false)} style={styles.reminderModalDone}>
                          <Text style={styles.reminderModalDoneText}>{t('agentCalendarTimeSelectBtn')}</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              )}

              <Text style={styles.fieldLabel}>{t('agentCalendarRepeat')}</Text>
              <TouchableOpacity style={styles.timeSelectRow} onPress={() => { Keyboard.dismiss(); setShowRepeatModal(true); }} activeOpacity={0.7}>
                <Text style={styles.timeSelectText}>
                  {repeatType ? t(REPEAT_OPTIONS.find(o => o.value === repeatType)?.key || 'agentCalendarRepeatSelect') : t('agentCalendarRepeatSelect')}
                </Text>
              </TouchableOpacity>

              {showRepeatModal && (
                <Modal transparent animationType="fade" visible statusBarTranslucent>
                  <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRepeatModal(false)}>
                    {Platform.OS === 'web' ? (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                    ) : (
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    )}
                    <Pressable style={styles.reminderModalBoxWrap} onPress={(e) => e.stopPropagation()}>
                      <View style={styles.reminderModalBox}>
                        <View style={styles.reminderModalHeader}>
                          <Text style={styles.reminderModalTitle}>{t('agentCalendarRepeatSelect')}</Text>
                          <TouchableOpacity onPress={() => setShowRepeatModal(false)} style={styles.reminderModalClose}>
                            <Text style={styles.reminderModalCloseText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.reminderModalScroll} showsVerticalScrollIndicator>
                          {REPEAT_OPTIONS.map((opt) => {
                            const isSelected = repeatType === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value ?? 'none'}
                                style={[styles.reminderModalOption, isSelected && styles.reminderModalOptionSelected]}
                                onPress={() => {
                                  setRepeatType(opt.value);
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.reminderCheckbox, isSelected && styles.reminderCheckboxChecked]}>
                                  {isSelected ? <Text style={styles.reminderCheckmark}>✓</Text> : null}
                                </View>
                                <Text style={[styles.reminderModalOptionText, isSelected && styles.reminderModalOptionTextSelected]}>
                                  {t(opt.key)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowRepeatModal(false)} style={styles.reminderModalDone}>
                          <Text style={styles.reminderModalDoneText}>{t('agentCalendarTimeSelectBtn')}</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
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
                editable={!showTimePicker && !showReminderModal && !showRepeatModal}
                showSoftInputOnFocus={!showTimePicker && !showReminderModal && !showRepeatModal}
              />
            </ScrollView>

            {!showTimePicker && !showReminderModal && !showRepeatModal && (
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
  reminderModalBoxWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reminderModalBox: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  reminderModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  reminderModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  reminderModalClose: {
    padding: 8,
  },
  reminderModalCloseText: {
    fontSize: 22,
    color: '#6B6B6B',
  },
  reminderModalScroll: {
    maxHeight: 320,
  },
  reminderModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  reminderModalOptionSelected: {
    backgroundColor: 'rgba(216, 27, 96, 0.08)',
  },
  reminderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6B6B6B',
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCheckboxChecked: {
    backgroundColor: '#5B8DEE',
    borderColor: '#3A6FCC',
  },
  reminderCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  reminderModalOptionText: {
    fontSize: 16,
    color: '#2C2C2C',
  },
  reminderModalOptionTextSelected: {
    fontWeight: '700',
    color: '#D81B60',
  },
  reminderModalDone: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  reminderModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
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
