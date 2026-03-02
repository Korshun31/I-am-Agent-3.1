import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Единый формат всплывающих окон в приложении.
 * При открытии фон размывается (blur), чтобы концентрация была на окне.
 * Отличаться будут только заголовок и контент (передаются через title и children).
 */
export default function AppPopup({ visible, onClose, title, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.boxContent}>
              <Text style={styles.title}>{title}</Text>
              {children}
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
    padding: 24,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  boxWrap: {
    width: '100%',
    maxWidth: 340,
  },
  box: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    // Матовое стекло: полупрозрачный белый — сквозь окно виден размытый фон, текст читается
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  boxContent: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C73E3E',
    marginBottom: 16,
    textAlign: 'center',
  },
});

/** Стили для типового контента попапа (сообщение + кнопки). Можно использовать в экранах. */
export const popupStyles = StyleSheet.create({
  message: {
    fontSize: 16,
    color: '#2C2C2C',
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#E8B8C8',
    borderWidth: 1,
    borderColor: '#C73E3E',
  },
  buttonSecondary: {
    backgroundColor: '#E8EEF4',
    borderWidth: 1,
    borderColor: '#A8D0E6',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  buttonTextPrimary: {
    color: '#C73E3E',
  },
});
