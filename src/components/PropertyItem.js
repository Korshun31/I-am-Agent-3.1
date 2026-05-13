import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

// Пастельные цвета закладок — из палитры логотипа
export const TYPE_COLORS = {
  house:  '#E8B86D',
  resort: '#8BAF8E',
  condo:  '#7BAEC8',
};

export const TYPE_ICONS = {
  resort: require('../../assets/icon-property-resort.png'),
  house:  require('../../assets/icon-property-house.png'),
  condo:  require('../../assets/icon-property-condo.png'),
};

const UNIT_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

function PropertyItem({ item, expanded, onToggle, onPress, t }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

  const handleToggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);
  const handlePress  = useCallback(() => onPress(item),    [onPress,  item]);

  const cardType = item._parentType
    ? item._parentType
    : (item.type || 'house');
  const tabColor = TYPE_COLORS[cardType] || TYPE_COLORS.house;
  const displayName = item._parentName
    ? `${item._parentName} › ${item.name || item.code || ''}`.trim()
    : item.name;
  const codeDisplay = item.code_suffix
    ? (item.code ? item.code + ' ' : '') + `(${item.code_suffix})`
    : item.code;

  useEffect(() => {
    Animated.timing(arrowAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, arrowAnim]);

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.propertyCard}>
        {/* Вертикальная цветная полоска вдоль всей левой стороны карточки.
            overflow:'hidden' на propertyCard обрезает её по borderRadius карточки. */}
        <View
          style={[styles.typeStripe, { backgroundColor: tabColor }]}
        />
        <View style={styles.propertyRow}>
          <TouchableOpacity style={styles.propertyMainArea} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.propertyName} numberOfLines={1}>{displayName}</Text>
          </TouchableOpacity>
          <Text style={styles.propertyCode}>{codeDisplay}</Text>
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.5} style={styles.expandBtn}>
            <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
              <Ionicons name="chevron-down" size={16} color="#C7C7CC" />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            {Array.isArray(item.photos) && item.photos.length > 0 ? (
              <Image
                source={{ uri: item.photos_thumb?.[0] || item.photos[0] }}
                style={styles.expandedPhoto}
                cachePolicy="disk"
              />
            ) : (
              <View style={[styles.expandedPhoto, styles.expandedPhotoPlaceholder]}>
                <RNImage
                  source={require('../../assets/icon-photo.png')}
                  style={styles.expandedPhotoPlaceholderIcon}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.expandedDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propDistrict')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>{item.district || '—'}</Text>
              </View>
              {item.type === 'resort' ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('propHouses')}</Text>
                  <Text style={styles.detailColon}>:</Text>
                  <Text style={styles.detailValue}>
                    {item.houses_count != null ? `${item.houses_count}  pc` : '—'}
                  </Text>
                </View>
              ) : UNIT_TYPES.has(item.type) ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('propBedrooms')}</Text>
                  <Text style={styles.detailColon}>:</Text>
                  <Text style={styles.detailValue}>
                    {item.bedrooms != null ? item.bedrooms : '—'}
                  </Text>
                </View>
              ) : item.type === 'condo' ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('propFloors')}</Text>
                  <Text style={styles.detailColon}>:</Text>
                  <Text style={styles.detailValue}>
                    {item.floors != null ? item.floors : '—'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propBeach')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>
                  {item.beach_distance != null ? `${item.beach_distance}  m` : '—'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('propMarket')}</Text>
                <Text style={styles.detailColon}>:</Text>
                <Text style={styles.detailValue}>
                  {item.market_distance != null ? `${item.market_distance}  m` : '—'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default memo(PropertyItem);

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 10,
  },
  // Вертикальная цветная полоска — абсолютный View вдоль всей левой стороны карточки.
  // overflow:'hidden' на propertyCard обрезает углы по borderRadius карточки.
  typeStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  // Белая карточка. overflow: 'hidden' — полоска обрезается по скруглённым углам
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 14,
  },
  propertyMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    letterSpacing: -0.3,
  },
  propertyCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D7D82',       // было #D81B60 (малиновый) → teal акцент проекта
    marginRight: 10,
  },
  expandBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  expandedContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',  // тоньше разделитель на белом
    paddingTop: 10,
    gap: 12,
  },
  expandedPhoto: {
    width: 120,
    height: 80,
    borderRadius: 12,
  },
  expandedPhotoPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPhotoPlaceholderIcon: {
    width: 36,
    height: 36,
    opacity: 0.4,
  },
  expandedDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    width: 70,
  },
  detailColon: {
    fontSize: 12,
    color: '#6B6B6B',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'right',
  },
});
