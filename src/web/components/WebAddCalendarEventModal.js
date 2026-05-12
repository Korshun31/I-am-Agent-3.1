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
  { value: 10080, key: 'agentCalendarReminder1w' },
  { value: 43200, key: 'agentCalendarReminder1mo' },
];

const CALENDAR_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#4DB6AC', '#64B5F6',
];

function formatDateYMD(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export default function WebAddCalendarEventModal({ visible, onClose, onSaved, editEvent, initialDate }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [eventTime, setEventTime] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState([]);
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [comments, setComments] = useState('');
  const [repeatType, setRepeatType] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Добавляем локальное состояние для данных события, чтобы обновлять их без закрытия модалки
  const [currentEventData, setCurrentEventData] = useState(null);
  
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (visible) {
      const targetEvent = currentEventData || editEvent;
      if (targetEvent) {
        setTitle(targetEvent.title || '');
        setEventDate(targetEvent.eventDate ? new Date(targetEvent.eventDate) : null);
        setEventTime(targetEvent.eventTime || '');
        setReminderMinutes(Array.isArray(targetEvent.reminderMinutes) ? [...targetEvent.reminderMinutes] : []);
        setColor(targetEvent.color || CALENDAR_COLORS[0]);
        setComments(targetEvent.comments || '');
        setRepeatType(targetEvent.repeatType || null);
        setIsCompleted(!!targetEvent.isCompleted);
        if (!currentEventData) setIsEditing(false);
      } else {
        const base = initialDate ? new Date(initialDate) : new Date();
        setTitle('');
        setEventDate(base);
        setEventTime('');
        setReminderMinutes([]);
        setColor(CALENDAR_COLORS[0]);
        setComments('');
        setRepeatType(null);
        setIsCompleted(false);
        setIsEditing(true);
      }
    } else {
      // Сбрасываем локальное состояние при закрытии
      setCurrentEventData(null);
    }
  }, [visible, editEvent, initialDate, currentEventData]);

  const handleTimeInput = (text) => {
    if (!isEditing) return;
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
      const payload = {
        title: name,
        eventDate: dateYMD,
        eventTime: eventTime || null,
        color,
        comments: (comments || '').trim() || null,
        reminderMinutes,
        repeatType,
        isCompleted: isCompleted,
      };

      if (isEdit) {
        await updateCalendarEvent(editEvent.id, payload);
        // Обновляем локальное состояние, чтобы кнопка "Сохранить" исчезла сразу
        setCurrentEventData({
          ...editEvent,
          ...payload,
          isCompleted: isCompleted // мапим для соответствия структуре объекта
        });
      } else {
        await createCalendarEvent(payload);
      }
      
      onSaved?.();
      
      if (isEdit) {
        setIsEditing(false);
      } else {
        onClose();
      }
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

  const toggleReminder = (val) => {
    if (!isEditing) return;
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

  const showSaveButton = isEditing || (isEdit && isCompleted !== !!(currentEventData?.isCompleted ?? editEvent.isCompleted));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={styles.headerRow}>
            {isEdit && isEditing ? (
              <TouchableOpacity onPress={handleDelete} style={styles.trashBtn}>
                <Image source={require('../../../assets/trash-icon.png')} style={styles.trashIcon} resizeMode="contain" />
              </TouchableOpacity>
            ) : (
              <View style={styles.trashBtn} />
            )}
            <Text style={styles.title}>
              {isEdit ? (isEditing ? t('agentCalendarEditEvent') : t('agentCalendarEventTitle')) : t('agentCalendarAddEvent')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {isEdit && !isEditing && (
            <View style={styles.editIconBtnWrap}>
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                style={styles.editIconBtn}
                activeOpacity={0.7}
              >
                <Image source={require('../../../assets/pencil-icon.png')} style={styles.editIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.formContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventName')}</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputReadOnly]}
                value={title}
                onChangeText={setTitle}
                placeholder={t('agentCalendarEventNamePlaceholder')}
                placeholderTextColor="#ADB5BD"
                editable={isEditing}
              />
            </View>

            <View style={[styles.row, { zIndex: 0 }]}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarEventDate')}</Text>
                {/* Нативный HTML5 date picker на вебе — без лишних модалок */}
                <input
                  type="date"
                  value={(() => {
                    const dt = eventDate || (initialDate ? new Date(initialDate) : null);
                    if (!dt) return '';
                    const y = dt.getFullYear();
                    const m = String(dt.getMonth() + 1).padStart(2, '0');
                    const dd = String(dt.getDate()).padStart(2, '0');
                    return `${y}-${m}-${dd}`;
                  })()}
                  onChange={(e) => {
                    if (!isEditing) return;
                    const v = e.target.value;
                    if (!v) return;
                    const [yy, mm, dd] = v.split('-').map(Number);
                    setEventDate(new Date(yy, mm - 1, dd));
                  }}
                  disabled={!isEditing}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 15,
                    padding: '0 14px',
                    height: 44,
                    borderRadius: 10,
                    border: '1px solid #E9ECEF',
                    backgroundColor: isEditing ? '#F8F9FA' : '#F1F3F5',
                    color: '#212529',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarEventTime')}</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputReadOnly]}
                  value={eventTime}
                  onChangeText={handleTimeInput}
                  placeholder="HH:mm"
                  placeholderTextColor="#ADB5BD"
                  maxLength={5}
                  editable={isEditing}
                />
              </View>
            </View>

            <View style={[styles.row, { zIndex: 1000 }]}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarReminder')}</Text>
                <TouchableOpacity 
                  style={[styles.customSelect, !isEditing && styles.inputReadOnly]} 
                  onPress={() => {
                    if (isEditing) {
                      setShowReminderDropdown(!showReminderDropdown);
                      setShowRepeatDropdown(false);
                    }
                  }}
                  activeOpacity={isEditing ? 0.7 : 1}
                >
                  <Text style={styles.customSelectText} numberOfLines={1}>{getReminderLabel()}</Text>
                  {isEditing && <Text style={styles.chevron}>{showReminderDropdown ? '▲' : '▼'}</Text>}
                </TouchableOpacity>
                
                {showReminderDropdown && isEditing && (
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

              <View style={[styles.fieldGroup, { flex: 1, zIndex: 1000 }]}>
                <Text style={styles.fieldLabel}>{t('agentCalendarRepeat')}</Text>
                <TouchableOpacity 
                  style={[styles.customSelect, !isEditing && styles.inputReadOnly]} 
                  onPress={() => {
                    if (isEditing) {
                      setShowRepeatDropdown(!showRepeatDropdown);
                      setShowReminderDropdown(false);
                    }
                  }}
                  activeOpacity={isEditing ? 0.7 : 1}
                >
                  <Text style={styles.customSelectText} numberOfLines={1}>{getRepeatLabel()}</Text>
                  {isEditing && <Text style={styles.chevron}>{showRepeatDropdown ? '▲' : '▼'}</Text>}
                </TouchableOpacity>
                
                {showRepeatDropdown && isEditing && (
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
                    onPress={() => isEditing && setColor(c)}
                    activeOpacity={isEditing ? 0.7 : 1}
                  />
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventComments')}</Text>
              <TextInput
                style={[styles.input, styles.commentsInput, !isEditing && styles.inputReadOnly]}
                value={comments}
                onChangeText={setComments}
                placeholder={t('agentCalendarEventCommentsPlaceholder')}
                placeholderTextColor="#ADB5BD"
                multiline
                numberOfLines={3}
                editable={isEditing}
              />
            </View>

            {isEdit && (
              <View style={styles.completedSection}>
                <TouchableOpacity 
                  style={styles.completedRow} 
                  onPress={() => setIsCompleted(!isCompleted)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isCompleted && styles.checkboxCheckedSuccess]}>
                    {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.completedText, isCompleted && styles.completedTextActive]}>
                    {isCompleted ? 'Выполнено' : 'Отметить как выполненное'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {showSaveButton && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Сохранить</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    overflow: 'visible',
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
  trashBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trashIcon: { 
    width: 24, 
    height: 24,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#212529',
    flex: 1,
    textAlign: 'center'
  },
  closeBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  closeIcon: { fontSize: 18, color: '#ADB5BD', fontWeight: '600' },
  editIconBtnWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    ...Platform.select({ web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' } }),
  },
  editIcon: {
    width: 20,
    height: 20,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 0,
    overflow: 'visible',
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
    paddingVertical: 0,
    fontSize: 15,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 44,
    boxSizing: 'border-box',
  },
  inputReadOnly: {
    backgroundColor: '#F1F3F5',
    borderColor: 'transparent',
    color: '#495057',
  },
  row: { flexDirection: 'row', position: 'relative', gap: 12 },
  customSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 44,
    boxSizing: 'border-box',
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
  checkboxCheckedSuccess: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
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
  
  completedSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '600',
  },
  completedTextActive: {
    color: '#2E7D32',
  },

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
    paddingHorizontal: 24,
    paddingBottom: 24,
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
