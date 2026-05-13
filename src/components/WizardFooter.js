import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import IconSaveDraft from './IconSaveDraft';

const ACCENT = '#3D7D82';
const LABEL = '#6B6B6B';
const DISABLED = '#C7C7CC';

export default function WizardFooter({
  isFirstStep = false,
  isLastStep = false,
  onBack,
  onNext,
  onSave,
  canSave = true,
  saving = false,
  uploadProgress = '',
  showSaveIcon = true,
  backLabel = '‹  Назад',
  nextLabel = 'Далее  ›',
  saveLabel = 'Сохранить',
}) {
  const saveIconVisible = showSaveIcon && !isLastStep;
  const saveDisabled = !canSave || saving;
  const primaryAction = isLastStep ? onSave : onNext;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, isFirstStep && styles.btnDisabled]}
        onPress={onBack}
        disabled={isFirstStep}
        activeOpacity={0.7}
      >
        <Text style={[styles.text, isFirstStep && styles.textDisabled]}>{backLabel}</Text>
      </TouchableOpacity>

      {saveIconVisible && (
        <TouchableOpacity
          style={[styles.iconBtn, saveDisabled && styles.btnDisabled]}
          onPress={onSave}
          activeOpacity={0.7}
          disabled={saveDisabled}
        >
          <IconSaveDraft size={26} color={saveDisabled ? DISABLED : ACCENT} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.btn, styles.btnAccent]}
        onPress={primaryAction}
        activeOpacity={0.7}
        disabled={saving}
      >
        {saving && !uploadProgress ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Text style={[styles.text, styles.textAccent]}>
            {saving && uploadProgress
              ? `📤 ${uploadProgress}`
              : isLastStep ? saveLabel : nextLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)',
  },
  btn: {
    height: 44, paddingHorizontal: 20, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnAccent: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ACCENT,
  },
  text: { fontSize: 16, fontWeight: '600', color: LABEL },
  textDisabled: { color: DISABLED },
  textAccent: { color: ACCENT },
  iconBtn: {
    height: 44, width: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
});
