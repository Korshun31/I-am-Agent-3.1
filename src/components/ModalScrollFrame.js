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
// Здесь всё сделано один раз правильно: карточка фиксирует 90% высоты,
// ScrollView растягивается на остаток между header и footer (flex:1 + minHeight:0),
// footer всегда виден.
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
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.backdropWeb]} />
        ) : (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          <Pressable
            style={[styles.boxWrap, boxWrapStyle]}
            onPress={(e) => { e.stopPropagation(); Keyboard.dismiss(); }}
          >
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
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
});

export default ModalScrollFrame;

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
  keyboardWrap: {
    flex: 1,
    width: '100%',
    maxHeight: '90%',
    maxWidth: 400,
  },
  boxWrap: {
    flex: 1,
    width: '100%',
    maxHeight: '90%',
  },
  box: {
    flex: 1,
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
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
