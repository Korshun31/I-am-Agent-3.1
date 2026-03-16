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
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../services/calendarEventsService';

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

export default function WebAddCalendarEventModal({ visible, onClose, onSaved, editEvent, initialDate }) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [eventTime, setEventTime] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState([]);
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [comments, setComments] = useState('');
  const [repeatType, setRepeatType] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (visible) {
      if (editEvent) {
        setTitle(editEvent.title || '');
        setEventDate(editEvent.eventDate ? new Date(editEvent.eventDate) : null);
        setEventTime(editEvent.eventTime || '');
        setReminderMinutes(Array.isArray(editEvent.reminderMinutes) ? [...editEvent.reminderMinutes] : []);
        setColor(editEvent.color || CALENDAR_COLORS[0]);
        setComments(editEvent.comments || '');
        setRepeatType(editEvent.repeatType || null);
      } else {
        const base = initialDate ? new Date(initialDate) : new Date();
        setTitle('');
        setEventDate(base);
        setEventTime('');
        setReminderMinutes([]);
        setColor(CALENDAR_COLORS[0]);
        setComments('');
        setRepeatType(null);
      }
    }
  }, [visible, editEvent, initialDate]);

  const handleTimeInput = (text) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
    let formatted = cleaned;
    if (cleaned.length >= 3) {
      formatted = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }
    setEventTime(formatted);
  };

  const handleSave = async () => {
    const name = (title || '').trim();
    if (!name) {
      alert(t('agentCalendarEventNameRequired'));
      return;
    }
    const dateToUse = eventDate || new Date();
    const dateYMD = formatDateYMD(dateToUse);
    setSaving(true);
    try {
      if (isEdit) {
        await updateCalendarEvent(editEvent.id, {
          title: name,
          eventDate: dateYMD,
          eventTime: eventTime || null,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes,
          repeatType,
        });
      } else {
        await createCalendarEvent({
          title: name,
          eventDate: dateYMD,
          eventTime: eventTime || null,
          color,
          comments: (comments || '').trim() || null,
          reminderMinutes,
          repeatType,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (window.confirm(t('agentCalendarDeleteEventConfirm'))) {
      setSaving(true);
      try {
        await deleteCalendarEvent(editEvent.id);
        onSaved?.();
        onClose();
      } catch (e) {
        alert(e.message);
      } finally {
        setSaving(false);
      }
    }
  };

  if (!visible) return null;

  const d = eventDate || (initialDate ? new Date(initialDate) : new Date());
  const day = d.getDate();
  const month = (MONTH_NAMES[language] || MONTH_NAMES.en)[d.getMonth()];
  const year = d.getFullYear();

  const toggleReminder = (val) => {
    setReminderMinutes(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a,b) => a-b)
    );
  };

  const getReminderLabel = () => {
    if (reminderMinutes.length === 0) return t('agentCalendarReminderWhen');
    if (reminderMinutes.length === 1) return t(REMINDER_OPTIONS.find(o => o.value === reminderMinutes[0])?.key);
    return `${t('selected')}: ${reminderMinutes.length}`;
  };

  const getRepeatLabel = () => {
    const opt = REPEAT_OPTIONS.find(o => o.value === repeatType);
    return opt ? t(opt.key) : t('agentCalendarRepeatNone');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={styles.headerRow}>
            {isEdit ? (
              <TouchableOpacity onPress={handleDelete} style={styles.trashBtn}>
                <Image source={require('../../../assets/trash-icon.png')} style={styles.trashIcon} resizeMode="contain" />
              </TouchableOpacity>
            ) : (
              <View style={styles.trashBtn} />
            )}
            <Text style={styles.title}>{isEdit ? t('agentCalendarEditEvent') : t('agentCalendarAddEvent')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateHeaderRow}>
            <Text style={styles.dateHeaderText}>
              <Text style={styles.dateHeaderRed}>{day}</Text> {month} {year}
            </Text>
          </View>

          {/* 
            ОСНОВНОЕ ИЗМЕНЕНИЕ: 
            Мы убираем ScrollView вокруг выпадающих списков, 
            чтобы они могли выходить за пределы контейнера через z-index.
          */}
          <View style={styles.formContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventName')}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('agentCalendarEventNamePlaceholder')}
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventTime')}</Text>
              <TextInput
                style={styles.input}
                value={eventTime}
                onChangeText={handleTimeInput}
                placeholder="HH:mm"
                placeholderTextColor="#ADB5BD"
                maxLength={5}
              />
            </View>

            <View style={[styles.row, { zIndex: 1000 }]}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarReminder')}</Text>
                <TouchableOpacity 
                  style={styles.customSelect} 
                  onPress={() => {
                    setShowReminderDropdown(!showReminderDropdown);
                    setShowRepeatDropdown(false);
                  }}
                >
                  <Text style={styles.customSelectText} numberOfLines={1}>{getReminderLabel()}</Text>
                  <Text style={styles.chevron}>{showReminderDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                
                {showReminderDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      {REMINDER_OPTIONS.map(opt => {
                        const isSelected = reminderMinutes.includes(opt.value);
                        return (
                          <TouchableOpacity 
                            key={opt.value} 
                            style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                            onPress={() => toggleReminder(opt.value)}
                          >
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                              {isSelected && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                              {t(opt.key)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ width: 20 }} />

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarRepeat')}</Text>
                <TouchableOpacity 
                  style={styles.customSelect} 
                  onPress={() => {
                    setShowRepeatDropdown(!showRepeatDropdown);
                    setShowReminderDropdown(false);
                  }}
                >
                  <Text style={styles.customSelectText} numberOfLines={1}>{getRepeatLabel()}</Text>
                  <Text style={styles.chevron}>{showRepeatDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                
                {showRepeatDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      {REPEAT_OPTIONS.map(opt => {
                        const isSelected = repeatType === opt.value;
                        return (
                          <TouchableOpacity 
                            key={opt.value ?? 'none'} 
                            style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                            onPress={() => {
                              setRepeatType(opt.value);
                              setShowRepeatDropdown(false);
                            }}
                          >
                            <View style={[styles.radio, isSelected && styles.radioChecked]}>
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                              {t(opt.key)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventComments')}</Text>
              <TextInput
                style={[styles.input, styles.commentsInput]}
                value={comments}
                onChangeText={setComments}
                placeholder={t('agentCalendarEventCommentsPlaceholder')}
                placeholderTextColor="#ADB5BD"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.footer}>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
  },
  box: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'visible', // КРИТИЧНО: разрешаем выход за границы
    ...Platform.select({
      web: {
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      }
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  trashBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  trashIcon: { width: 20, height: 20, tintColor: '#FF4D4F' },
  title: { fontSize: 20, fontWeight: '700', color: '#212529' },
  closeBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  closeIcon: { fontSize: 18, color: '#ADB5BD', fontWeight: '600' },
  dateHeaderRow: { 
    paddingVertical: 16, 
    alignItems: 'center', 
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  dateHeaderText: { fontSize: 18, fontWeight: '700', color: '#495057' },
  dateHeaderRed: { color: '#D81B60' },
  formContent: {
    padding: 24,
    overflow: 'visible', // КРИТИЧНО: разрешаем выход за границы
  },
  fieldGroup: { marginBottom: 16, position: 'relative' },
  fieldLabel: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#ADB5BD', 
    marginBottom: 6, 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  row: { flexDirection: 'row', position: 'relative' },
  customSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  customSelectText: { fontSize: 15, color: '#212529' },
  chevron: { fontSize: 10, color: '#ADB5BD' },
  dropdownList: {
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    zIndex: 9999,
    ...Platform.select({ web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } }),
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    gap: 10,
  },
  dropdownOptionSelected: { backgroundColor: 'rgba(216, 27, 96, 0.05)' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ADB5BD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D81B60',
    borderColor: '#D81B60',
  },
  checkmark: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ADB5BD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: {
    borderColor: '#D81B60',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D81B60',
  },
  dropdownOptionText: { fontSize: 14, color: '#495057' },
  dropdownOptionTextSelected: { color: '#212529', fontWeight: '700' },
  
  commentsInput: { minHeight: 80, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    borderWidth: 3, 
    borderColor: 'transparent' 
  },
  colorDotSelected: { 
    borderColor: '#212529',
    transform: [{ scale: 1.05 }]
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  saveBtn: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
