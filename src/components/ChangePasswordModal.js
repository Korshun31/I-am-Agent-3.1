import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { updatePassword } from '../services/authService';

const COLORS = {
  title: '#2C2C2C',
  inputBg: '#F7F7F9',
  accent: '#3D7D82',
  label: '#6B6B6B',
};

/**
 * Модальное окно смены пароля. Открывается из Settings.
 */
export default function ChangePasswordModal({ visible, onClose }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [visible]);

  const handleSave = async () => {
    Keyboard.dismiss();
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('enterAllPasswordFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('success'), t('passwordChanged'));
      onClose?.();
    } catch (e) {
      setError(e?.message || t('passwordChangeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={handleCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('changePassword')}</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.formWrap}>
              <Text style={styles.fieldLabel}>{t('currentPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor="#888"
                value={currentPassword}
                onChangeText={(v) => { setCurrentPassword(v); setError(''); }}
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>{t('newPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor="#888"
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setError(''); }}
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>{t('confirmNewPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                secureTextEntry
                autoCapitalize="none"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.buttonsRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 360,
  },
  box: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.title,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formWrap: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.label,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    minHeight: 46,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C62828',
    backgroundColor: 'rgba(198,40,40,0.06)',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(61,125,130,0.08)',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
