import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import Constants from 'expo-constants';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/th';
import { useLanguage } from '../context/LanguageContext';
import { getProperties } from '../services/propertiesService';
import { getBookings } from '../services/bookingsService';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

function capitalize(s) {
  if (!s || s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
};

const HOUSE_LIKE_TYPES = new Set(['house', 'resort_house', 'condo_apartment']);

export default function StatisticsScreen({ onBack }) {
  const { t, language } = useLanguage();
  const [propertyStats, setPropertyStats] = useState({
    standaloneHouses: 0,
    resortCount: 0,
    resortHouses: 0,
    condoCount: 0,
    condoApartments: 0,
    total: 0,
  });
  const [bookingStats, setBookingStats] = useState({ prevMonth: 0, currMonth: 0 });
  const [checkInStats, setCheckInStats] = useState({ prevMonth: 0, currMonth: 0 });

  const loadPropertyStats = async () => {
    try {
      const all = await getProperties();
      const getParent = (id) => all.find((p) => p.id === id);
      const standaloneHouses = all.filter((p) => HOUSE_LIKE_TYPES.has(p.type) && !p.resort_id).length;
      const resortCount = all.filter((p) => p.type === 'resort' && !p.resort_id).length;
      const resortHouses = all.filter((p) => HOUSE_LIKE_TYPES.has(p.type) && p.resort_id && getParent(p.resort_id)?.type === 'resort').length;
      const condoCount = all.filter((p) => p.type === 'condo' && !p.resort_id).length;
      const condoApartments = all.filter((p) => HOUSE_LIKE_TYPES.has(p.type) && p.resort_id && getParent(p.resort_id)?.type === 'condo').length;
      setPropertyStats({
        standaloneHouses,
        resortCount,
        resortHouses,
        condoCount,
        condoApartments,
        total: standaloneHouses + resortHouses + condoApartments,
      });
    } catch {}
  };

  const loadBookingStats = async () => {
    try {
      const all = await getBookings();
      const now = dayjs();
      const prevMonthStart = now.subtract(1, 'month').startOf('month');
      const prevMonthEnd = now.subtract(1, 'month').endOf('month');
      const currMonthStart = now.startOf('month');
      const currMonthEnd = now.endOf('month');
      let prevCount = 0;
      let currCount = 0;
      let checkInPrev = 0;
      let checkInCurr = 0;
      all.forEach((b) => {
        if (b.notMyCustomer) return;
        const createdStr = typeof b.createdAt === 'string' && b.createdAt.length >= 10 ? b.createdAt.substring(0, 10) : b.createdAt;
        const checkInStr = typeof b.checkIn === 'string' && b.checkIn.length >= 10 ? b.checkIn.substring(0, 10) : b.checkIn;
        const createdDate = (createdStr ? dayjs(createdStr) : null) || (checkInStr ? dayjs(checkInStr) : null);
        if (createdDate && createdDate.isValid()) {
          if (!createdDate.isBefore(prevMonthStart) && !createdDate.isAfter(prevMonthEnd)) prevCount++;
          if (!createdDate.isBefore(currMonthStart) && !createdDate.isAfter(currMonthEnd)) currCount++;
        }
        const checkInDate = checkInStr ? dayjs(checkInStr) : null;
        if (checkInDate && checkInDate.isValid()) {
          if (!checkInDate.isBefore(prevMonthStart) && !checkInDate.isAfter(prevMonthEnd)) checkInPrev++;
          if (!checkInDate.isBefore(currMonthStart) && !checkInDate.isAfter(currMonthEnd)) checkInCurr++;
        }
      });
      setBookingStats({ prevMonth: prevCount, currMonth: currCount });
      setCheckInStats({ prevMonth: checkInPrev, currMonth: checkInCurr });
    } catch {}
  };

  useEffect(() => {
    loadPropertyStats();
    loadBookingStats();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('statistics')}</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('statsMyProperties')}</Text>
        <View style={styles.statsBlock}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-property-house-stats.png')} style={styles.statsIconLarge} resizeMode="contain" />
              <Text style={styles.statsLabel}>{t('statsStandaloneHouses')}</Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueGreen, styles.statsValueCentered]}>{propertyStats.standaloneHouses}</Text>
              </View>
            </View>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-property-resort-stats.png')} style={styles.statsIconLarge} resizeMode="contain" />
              <Text style={styles.statsLabel}>{t('statsResortsHouses')}</Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueWrap, styles.statsValueCentered]}><Text style={styles.statsValueGreen}>{propertyStats.resortCount}</Text><Text style={styles.statsValueSlash}> / </Text><Text style={styles.statsValueGreen}>{propertyStats.resortHouses}</Text></Text>
              </View>
            </View>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-property-condo-stats.png')} style={styles.statsIcon} resizeMode="contain" />
              <Text style={styles.statsLabel}>{t('statsCondosApts')}</Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueWrap, styles.statsValueCentered]}><Text style={styles.statsValueGreen}>{propertyStats.condoCount}</Text><Text style={styles.statsValueSlash}> / </Text><Text style={styles.statsValueGreen}>{propertyStats.condoApartments}</Text></Text>
              </View>
            </View>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-sum.png')} style={styles.statsIconSum} resizeMode="contain" />
              <Text style={styles.statsLabel}>{t('statsTotalObjects')}</Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueGreen, styles.statsValueCentered]}>{propertyStats.total}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>{t('statsMyBookings')}</Text>
          <View style={styles.statsBlock}>
            <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-booking.png')} style={styles.statsIconLarge} resizeMode="contain" />
              <Text style={styles.statsLabel}>
                {t('statsBookings')}{' '}
                <Text style={styles.statsMonthsLabel}>
                  {capitalize(dayjs().subtract(1, 'month').locale(language).format('MMMM'))} / {capitalize(dayjs().locale(language).format('MMMM'))}
                </Text>
              </Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueWrap, styles.statsValueCentered]}>
                  <Text style={styles.statsValueGreen}>{bookingStats.prevMonth}</Text>
                  <Text style={styles.statsValueSlash}> / </Text>
                  <Text style={styles.statsValueGreen}>{bookingStats.currMonth}</Text>
                </Text>
              </View>
            </View>
            <View style={styles.statsItem}>
              <Image source={require('../../assets/icon-checkin.png')} style={styles.statsIconLarge} resizeMode="contain" />
              <Text style={styles.statsLabel}>
                {t('statsCheckIns')}{' '}
                <Text style={styles.statsMonthsLabel}>
                  {capitalize(dayjs().subtract(1, 'month').locale(language).format('MMMM'))} / {capitalize(dayjs().locale(language).format('MMMM'))}
                </Text>
              </Text>
              <View style={styles.statsValueFrame}>
                <Text style={[styles.statsValueWrap, styles.statsValueCentered]}>
                  <Text style={styles.statsValueGreen}>{checkInStats.prevMonth}</Text>
                  <Text style={styles.statsValueSlash}> / </Text>
                  <Text style={styles.statsValueGreen}>{checkInStats.currMonth}</Text>
                </Text>
              </View>
            </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 24,
    color: COLORS.backArrow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 52,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 88,
  },
  sectionWrap: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: 8,
  },
  statsBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'column',
    gap: 12,
  },
  statsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.title,
  },
  statsMonthsLabel: {
    fontWeight: '700',
    color: '#DC3670',
  },
  statsValueFrame: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsValueCentered: {
    textAlign: 'center',
  },
  statsIcon: {
    width: 28,
    height: 28,
  },
  statsIconLarge: {
    width: 31,
    height: 31,
  },
  statsIconSum: {
    width: 24,
    height: 24,
  },
  statsValueSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.title,
  },
  statsValueGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  statsValueWrap: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
  },
  statsValueSlash: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.title,
  },
});
