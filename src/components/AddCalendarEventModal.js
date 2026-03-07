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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../context/LanguageContext';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/calendarEventsService';

const CALENDAR_COLORS = [
  '#E57373', '#FF8A65', '#FFB74D', '#FFD54F',
  '#81C784', '#4DB6AC', '#64B5F6',
];

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
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [eventTime, setEventTime] = useState(null);
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [comments, setComments] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [useTime, setUseTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (visible) {
      if (editEvent) {
        setTitle(editEvent.title || '');
        setEventDate(editEvent.eventDate ? new Date(editEvent.eventDate) : null);
        setEventTime(editEvent.eventTime || null);
        setColor(editEvent.color || CALENDAR_COLORS[0]);
        setComments(editEvent.comments || '');
        setUseTime(!!editEvent.eventTime);
      } else {
        const base = initialDate ? new Date(initialDate) : new Date();
        setTitle('');
        setEventDate(base);
        setEventTime(null);
        setColor(CALENDAR_COLORS[0]);
        setComments('');
        setUseTime(false);
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
    const timeStr = useTime && eventTime ? formatTimeDisplay(eventTime) : null;
    setSaving(true);
    try {
      if (isEdit) {
        await updateCalendarEvent(editEvent.id, {
          title: name,
          eventDate: formatDateYMD(dateToUse),
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
        });
      } else {
        await createCalendarEvent({
          title: name,
          eventDate: formatDateYMD(dateToUse),
          eventTime: timeStr,
          color,
          comments: (comments || '').trim() || null,
        });
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
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      setEventTime(`${h}:${m}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
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

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('agentCalendarEventName')}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('agentCalendarEventNamePlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="sentences"
              />

              <Text style={styles.fieldLabel}>{t('agentCalendarEventTime')}</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity
                  style={[styles.timeCheck, useTime && styles.timeCheckActive]}
                  onPress={() => setUseTime(!useTime)}
                >
                  <Text style={[styles.timeCheckText, useTime && styles.timeCheckTextActive]}>
                    {useTime ? t('yes') : t('no')}
                  </Text>
                </TouchableOpacity>
                {useTime && (
                  <TouchableOpacity
                    style={styles.timeField}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={[styles.timeFieldText, !eventTime && styles.timePlaceholder]}>
                      {eventTime ? formatTimeDisplay(eventTime) : t('agentCalendarSelectTime')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {useTime && showTimePicker && (
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
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerDone}>
                      <Text style={styles.pickerDoneText}>OK</Text>
                    </TouchableOpacity>
                  )}
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
              />
            </ScrollView>

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
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    padding: 16,
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  timeCheck: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F5F2EB',
    borderWidth: 1,
    borderColor: '#E0D8CC',
  },
  timeCheckActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  timeCheckText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  timeCheckTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  timeField: {
    flex: 1,
    backgroundColor: '#F5F2EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0D8CC',
  },
  timeFieldText: {
    fontSize: 16,
    color: '#2C2C2C',
  },
  timePlaceholder: {
    color: '#999',
  },
  pickerWrap: {
    marginBottom: 16,
    alignItems: 'center',
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
