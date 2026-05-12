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
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  backdrop: 'rgba(0,0,0,0.6)',
  boxBg: '#FFFFFF',
  title: '#2C2C2C',
  accent: '#3D7D82',
  border: 'rgba(0,0,0,0.07)',
  label: '#6B6B6B',
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
              <Ionicons name="chevron-back" size={20} color={COLORS.accent} />
              <Text style={styles.backBtnText}>{t('back')}</Text>
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
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>{t('pdfPreviewTitle')}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color="#888" />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerSpacer: { width: 36, height: 36 },
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  webview: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  btnView: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  btnViewText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.title,
  },
  btnSend: {
    backgroundColor: 'rgba(61,125,130,0.08)',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  btnSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
