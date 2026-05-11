import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  backdrop: 'rgba(0,0,0,0.6)',
  boxBg: '#FFFFFF',
  title: '#2C2C2C',
  accent: '#5DB8D4',
  border: '#E0DAD2',
  label: '#8A8A8A',
};

/**
 * Modal for PDF: view (HTML in WebView) or send.
 * "View" shows the document as HTML — no PDF rendering, works on iOS.
 */
export default function PdfPreviewModal({ visible, pdfUri, html, onClose, onSend }) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('choice');

  useEffect(() => {
    if (!visible) setViewMode('choice');
  }, [visible]);

  const handleClose = () => {
    setViewMode('choice');
    onClose?.();
  };

  if (!visible) return null;

  if (viewMode === 'view' && html) {
    return (
      <Modal animationType="slide" onRequestClose={() => setViewMode('choice')} statusBarTranslucent>
        <View style={styles.viewFullScreen}>
          <View style={styles.viewHeader}>
            <TouchableOpacity onPress={() => setViewMode('choice')} style={styles.backBtn} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>← {t('back')}</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html }}
            style={styles.webview}
            scrollEnabled
            showsVerticalScrollIndicator
            originWhitelist={['*']}
            javaScriptEnabled={false}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.backdrop }]} />
        <Pressable style={styles.boxWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.box}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('pdfPreviewTitle')}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.contentArea}>
              <Text style={styles.placeholderText}>{t('pdfPreviewReady')}</Text>
              <Text style={styles.hintText}>{t('pdfPreviewOpenHint')}</Text>
            </View>
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnView]}
                onPress={() => setViewMode('view')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnViewText}>{t('pdfPreviewView')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSend]}
                onPress={onSend}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSendText}>{t('pdfPreviewSend')}</Text>
              </TouchableOpacity>
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
  boxWrap: {
    width: '100%',
    maxWidth: Math.min(SCREEN_WIDTH - 32, 400),
  },
  box: {
    backgroundColor: COLORS.boxBg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.title,
  },
  closeBtn: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 22,
    color: '#D32F2F',
  },
  contentArea: {
    padding: 24,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
    textAlign: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: COLORS.label,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewFullScreen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  viewHeader: {
    paddingTop: (Constants.statusBarHeight ?? 44) + 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.boxBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    fontSize: 17,
    color: COLORS.accent,
  },
  webview: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  btnView: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnViewText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  btnSend: {
    backgroundColor: COLORS.accent,
  },
  btnSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
