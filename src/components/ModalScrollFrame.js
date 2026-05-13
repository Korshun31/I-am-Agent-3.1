import React, { forwardRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';

// Общий каркас для мобильных модалок (header + scroll body + footer).
// Зачем: на маленьких iPhone footer-кнопки уезжают за нижний край когда
// каждая модалка задаёт высоту своим ScrollView через `Dimensions.height * X`.
// Поведение: карточка центрирована по вертикали в backdrop, высота
// подстраивается под контент (короткий шаг = короткая карточка), но не
// больше 90% экрана. При превышении 90% — внутренний ScrollView активирует
// скролл (flexShrink:1 + minHeight:0). Footer всегда виден.
// Центрирование: между KeyboardAvoidingView и Pressable стоит centerWrap
// с flex:1 + justifyContent:'center' — он "съедает" свободное место KAV
// и центрирует boxWrap, чей размер диктуется содержимым (flexShrink, без flex:1).
const ModalScrollFrame = forwardRef(function ModalScrollFrame({
  visible,
  onRequestClose,
  header = null,
  aboveScrollSlot = null,
  footer = null,
  children,
  keyboardOffset = 40,
  keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined,
  disableScroll = false,
  boxWrapStyle = null,
  boxStyle = null,
  bodyStyle = null,
  scrollStyle = null,
  scrollContentContainerStyle = null,
  scrollProps = null,
  backdropPress = null,
  extraOverlay = null,
}, scrollRef) {
  const handleBackdropPress = backdropPress || Keyboard.dismiss;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
          pointerEvents="box-none"
        >
          <View style={styles.centerWrap} pointerEvents="box-none">
            <View style={[styles.boxWrap, boxWrapStyle]}>
              <View style={[styles.box, boxStyle]}>
                {header}
                {aboveScrollSlot}
                {disableScroll ? (
                  <View style={[styles.body, bodyStyle]}>{children}</View>
                ) : (
                  <ScrollView
                    ref={scrollRef}
                    style={[styles.scroll, scrollStyle]}
                    contentContainerStyle={scrollContentContainerStyle}
                    {...(scrollProps || {})}
                  >
                    {children}
                  </ScrollView>
                )}
                {footer}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      {extraOverlay}
    </Modal>
  );
});

export default ModalScrollFrame;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdropWeb: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardWrap: {
    flex: 1,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 20,
  },
  centerWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxWrap: {
    width: '100%',
    maxHeight: '90%',
    flexShrink: 1,
  },
  box: {
    flexShrink: 1,
    minHeight: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  scroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  body: {
    flexShrink: 1,
    minHeight: 0,
  },
});
