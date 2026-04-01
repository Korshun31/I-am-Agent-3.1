import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';

export const TYPE_COLORS = {
  resort: { bg: 'rgba(168,230,163,0.7)', border: '#A8E6A3' },
  house:  { bg: '#FFF9C4', border: '#FFD54F' },
  condo:  { bg: '#BBDEFB', border: '#64B5F6' },
};

export const TYPE_ICONS = {
  resort: require('../../assets/icon-property-resort.png'),
  house:  require('../../assets/icon-property-house.png'),
  condo:  require('../../assets/icon-property-condo.png'),
};

const UNIT_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

function PropertyItem({ item, expanded, onToggle, onPress, t }) {
  const arrowAnim = useState(() => new Animated.Value(0))[0];

  // Stable handlers — depend only on stable parent callbacks + item.id
  const handleToggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);
  const handlePress  = useCallback(() => onPress(item),    [onPress,  item]);

  const cardType = item._parentType
    ? item._parentType
    : (item.type || 'house');
  const colors = TYPE_COLORS[cardType] || TYPE_COLORS.house;
  const icon = TYPE_ICONS[cardType] || TYPE_ICONS.house;
  const displayName = item._parentName ? `${item._parentName} › ${item.name || item.code || ''}`.trim() : item.name;
  const codeDisplay = item.code_suffix ? (item.code ? item.code + ' ' : '') + `(${item.code_suffix})` : item.code;

  useEffect(() => {
    Animated.timing(arrowAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, arrowAnim]);

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  });

  return (
    <View style={[styles.propertyCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.propertyRow}>
        <TouchableOpacity style={styles.propertyMainArea} onPress={handlePress} activeOpacity={0.7}>
          {typeof icon === 'string' ? (
            <Text style={styles.propertyIcon}>{icon}</Text>
          ) : (
            <Image source={icon} style={styles.propertyIconImage} resizeMode="contain" />
          )}
          <Text style={styles.propertyName} numberOfLines={1}>{displayName}</Text>
        </TouchableOpacity>
        <Text style={styles.propertyCode}>{codeDisplay}</Text>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.5} style={styles.expandBtn}>
          <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
            <Image source={require('../../assets/icon-arrow-down.png')} style={styles.expandArrowImage} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.expandedContent}>
          {Array.isArray(item.photos) && item.photos.length > 0 ? (
            <Image source={{ uri: item.photos[0] }} style={styles.expandedPhoto} />
          ) : (
            <View style={[styles.expandedPhoto, styles.expandedPhotoPlaceholder]}>
              <Image source={require('../../assets/icon-photo.png')} style={styles.expandedPhotoPlaceholderIcon} resizeMode="contain" />
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
  );
}

export default memo(PropertyItem);

const styles = StyleSheet.create({
  propertyCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  propertyMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  propertyIconImage: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  propertyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  propertyCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D81B60',
    marginRight: 10,
  },
  expandBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  expandArrowImage: {
    width: 14,
    height: 14,
    tintColor: '#888888',
  },
  expandedContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
    gap: 12,
  },
  expandedPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  expandedPhotoPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPhotoPlaceholderIcon: {
    width: 36,
    height: 36,
    opacity: 0.5,
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
    fontSize: 13,
    color: '#6B6B6B',
    width: 70,
  },
  detailColon: {
    fontSize: 13,
    color: '#6B6B6B',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'right',
  },
});
