import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function PhotoGalleryModal({ visible, photos, initialIndex, onClose, onDeletePhoto, t }) {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setSaveMenuOpen(false);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const savePhotosToGallery = async (uris) => {
    setSaving(true);
    setSaveMenuOpen(false);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow access to save photos');
        setSaving(false);
        return;
      }
      let saved = 0;
      for (const uri of uris) {
        try {
          let localUri = uri;
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `photo_${Date.now()}_${saved}.${ext}`;
            const download = await FileSystem.downloadAsync(uri, FileSystem.cacheDirectory + fileName);
            localUri = download.uri;
          }
          await MediaLibrary.saveToLibraryAsync(localUri);
          saved++;
        } catch {}
      }
      Alert.alert('✓', saved === 1 ? 'Photo saved' : `${saved} photos saved`);
    } catch {
      Alert.alert('Error', 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={galleryStyles.backdrop}>
        <StatusBar barStyle="light-content" />

        <TouchableOpacity style={galleryStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={galleryStyles.closeText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={galleryStyles.saveBtn}
          onPress={() => setSaveMenuOpen(!saveMenuOpen)}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={galleryStyles.saveBtnIcon}>↓</Text>
          )}
        </TouchableOpacity>

        {onDeletePhoto ? (
          <TouchableOpacity
            style={galleryStyles.deleteBtn}
            onPress={() => {
              if (photos.length === 0) return;
              Alert.alert(
                photos.length === 1 ? (t?.('pdDeletePhoto') || 'Delete photo?') : (t?.('pdDeleteThisPhoto') || 'Delete this photo?'),
                '',
                [
                  { text: t?.('cancel') || 'Cancel', style: 'cancel' },
                  {
                    text: t?.('delete') || 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      const deletedUrl = photos[currentIndex];
                      const next = photos.filter((_, i) => i !== currentIndex);
                      onDeletePhoto?.(next, deletedUrl);
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <RNImage source={require('../../assets/trash-icon.png')} style={galleryStyles.deleteBtnIcon} resizeMode="contain" />
          </TouchableOpacity>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `gallery-${i}`}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <View style={galleryStyles.page}>
              <ScrollView
                style={galleryStyles.zoomScroll}
                contentContainerStyle={galleryStyles.zoomContent}
                maximumZoomScale={3}
                minimumZoomScale={1}
                bouncesZoom
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                pinchGestureEnabled
              >
                <Image source={{ uri: item }} style={galleryStyles.fullImage} contentFit="contain" cachePolicy="disk" />
              </ScrollView>
            </View>
          )}
        />

        <Text style={galleryStyles.counter}>{currentIndex + 1} / {photos.length}</Text>

        {saveMenuOpen && (
          <View style={galleryStyles.saveMenu}>
            <TouchableOpacity
              style={galleryStyles.saveMenuItem}
              onPress={() => savePhotosToGallery([photos[currentIndex]])}
              activeOpacity={0.7}
            >
              <Text style={galleryStyles.saveMenuIcon}>📷</Text>
              <Text style={galleryStyles.saveMenuText}>Save this photo</Text>
            </TouchableOpacity>
            {photos.length > 1 && (
              <TouchableOpacity
                style={[galleryStyles.saveMenuItem, { borderBottomWidth: 0 }]}
                onPress={() => savePhotosToGallery(photos)}
                activeOpacity={0.7}
              >
                <Text style={galleryStyles.saveMenuIcon}>📦</Text>
                <Text style={galleryStyles.saveMenuText}>Save all ({photos.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const galleryStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 20, color: '#FFF', fontWeight: '600' },
  saveBtn: {
    position: 'absolute', bottom: 60, left: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnIcon: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  deleteBtn: {
    position: 'absolute', bottom: 60, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnIcon: { width: 20, height: 20, tintColor: '#FFF' },
  page: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  zoomScroll: { width: SCREEN_W, height: SCREEN_H },
  zoomContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_W - 20, height: SCREEN_H * 0.7 },
  counter: {
    position: 'absolute', bottom: 50, alignSelf: 'center',
    color: '#FFF', fontSize: 16, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  saveMenu: {
    position: 'absolute', bottom: 110, left: 20, zIndex: 20,
    backgroundColor: 'rgba(40,40,40,0.95)', borderRadius: 14,
    minWidth: 200, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  saveMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  saveMenuIcon: { fontSize: 18, marginRight: 12 },
  saveMenuText: { fontSize: 15, color: '#FFF', fontWeight: '500' },
});
