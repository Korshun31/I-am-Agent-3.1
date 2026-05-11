import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../context/LanguageContext';
import Checkbox from './Checkbox';
import {
  getUploadConfig,
  startUpload,
  stopUpload,
  syncIfEnabled,
} from '../services/dataUploadService';

const COLORS = {
  boxBg: 'rgba(255,255,255,0.72)',
  title: '#2C2C2C',
  border: '#E0D8CC',
  inputBg: '#F7F7F9',
  disabled: '#CCC',
};

/**
 * Модальное окно выгрузки данных во внешнюю Supabase.
 * Settings → Выгрузить базу данных.
 */
export default function DataUploadModal({ visible, onClose }) {
  const { t } = useLanguage();
  const [url, setUrl] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(false);

  useEffect(() => {
    if (visible) {
      loadState();
    }
  }, [visible]);

  const loadState = async () => {
    setLoadingState(true);
    try {
      const config = await getUploadConfig();
      if (config?.enabled) {
        setEnabled(true);
        setUrl(config.url || '');
        setServiceRoleKey(config.serviceRoleKey ? '••••••••••••••••' : '');
      } else {
        setEnabled(false);
        setUrl('');
        setServiceRoleKey('');
        setAgreed(false);
      }
    } catch {
      setEnabled(false);
      setUrl('');
      setServiceRoleKey('');
      setAgreed(false);
    } finally {
      setLoadingState(false);
    }
  };

  const handleStart = async () => {
    const trimUrl = url.trim();
    const trimKey = serviceRoleKey.trim();
    if (!trimUrl || !trimKey) {
      Alert.alert(t('error'), t('dataUploadFillFields'));
      return;
    }
    if (!agreed) {
      Alert.alert(t('error'), t('dataUploadAgreeRequired'));
      return;
    }
    const keyToUse = trimKey === '••••••••••••••••' ? null : trimKey;
    if (!keyToUse && !enabled) {
      Alert.alert(t('error'), t('dataUploadFillFields'));
      return;
    }

    setLoading(true);
    try {
      const config = await getUploadConfig();
      const finalKey = keyToUse || (config?.serviceRoleKey);
      if (!finalKey) {
        Alert.alert(t('error'), t('dataUploadFillFields'));
        return;
      }
      await startUpload(trimUrl, finalKey);
      await syncIfEnabled();
      setEnabled(true);
      setServiceRoleKey('••••••••••••••••');
    } catch (e) {
      Alert.alert(t('error'), e?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopUpload();
      setEnabled(false);
      setUrl('');
      setServiceRoleKey('');
      setAgreed(false);
    } catch (e) {
      Alert.alert(t('error'), e?.message || 'Stop failed');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const isLocked = enabled;
  const fieldsDisabled = isLocked;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('dataUploadTitle')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingState ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color="#2E7D32" />
              </View>
            ) : (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>{t('dataUploadSupabaseUrl')}</Text>
                <TextInput
                  style={[styles.input, fieldsDisabled && styles.inputDisabled]}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://xxxxx.supabase.co"
                  placeholderTextColor="#999"
                  editable={!fieldsDisabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('dataUploadServiceRoleKey')}</Text>
                <TextInput
                  style={[styles.input, fieldsDisabled && styles.inputDisabled]}
                  value={serviceRoleKey}
                  onChangeText={setServiceRoleKey}
                  placeholder="eyJhbGc..."
                  placeholderTextColor="#999"
                  editable={!fieldsDisabled}
                  secureTextEntry={!enabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => !fieldsDisabled && setAgreed(!agreed)}
                  activeOpacity={0.8}
                  disabled={fieldsDisabled}
                >
                  <Checkbox checked={agreed} />
                  <Text style={[styles.checkboxLabel, fieldsDisabled && styles.textDisabled]}>
                    {t('dataUploadAgree')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    enabled ? styles.actionBtnStop : styles.actionBtnStart,
                    loading && styles.actionBtnDisabled,
                  ]}
                  onPress={enabled ? handleStop : handleStart}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      {enabled ? t('dataUploadStop') : t('dataUploadStart')}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
    maxWidth: 400,
    maxHeight: '90%',
  },
  box: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.boxBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerSpacer: { width: 36, height: 36 },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 20, color: '#E85D4C', fontWeight: '600' },
  loadingWrap: { padding: 40, alignItems: 'center' },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.title,
  },
  inputDisabled: {
    backgroundColor: '#E8E8E8',
    color: '#888',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.title,
    lineHeight: 20,
  },
  textDisabled: { color: '#888' },
  actionBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionBtnStart: {
    backgroundColor: '#2E7D32',
  },
  actionBtnStop: {
    backgroundColor: '#E85D4C',
  },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
