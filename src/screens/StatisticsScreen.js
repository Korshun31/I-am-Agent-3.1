import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import dayjs from 'dayjs';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useAppData } from '../context/AppDataContext';
import { useCurrencyRates } from '../context/CurrencyRatesContext';
import { getCurrencySymbol } from '../utils/currency';
import {
  getPeriodPresets,
  computeRevenue,
  computeAgencyIncome,
  computeActiveBookingsCount,
  computeOccupancyPercent,
  computeMonthlyRevenue,
  computeMonthlyForecast,
  computeMonthlyBookingsCount,
  computeTopProperties,
  computeAgentLeaderboard,
  breakdownByPropertyForMonth,
  filterBookingsForUser,
  filterPropertiesForUser,
} from '../utils/statisticsCalc';
import StatisticsPeriodPicker from '../web/components/statistics/StatisticsPeriodPicker';
import StatisticsKpiCards from '../web/components/statistics/StatisticsKpiCards';
import StatisticsRevenueChart from '../web/components/statistics/StatisticsRevenueChart';
import StatisticsBookingsCountChart from '../web/components/statistics/StatisticsBookingsCountChart';
import StatisticsTopProperties from '../web/components/statistics/StatisticsTopProperties';
import StatisticsAgentLeaderboard from '../web/components/statistics/StatisticsAgentLeaderboard';
import StatisticsMonthBreakdownModal from '../web/components/statistics/StatisticsMonthBreakdownModal';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F2EB',
  title:      '#2C2C2C',
  backArrow:  '#5DB8D4',
  accent:     '#3D7D82',
};

export default function StatisticsScreen({ onBack }) {
  const { t, currency } = useLanguage();
  const { user } = useUser();
  const {
    bookings,
    properties,
    teamMembers,
    bookingsLoading,
    propertiesLoading,
    teamMembersLoading,
    refreshBookings,
    refreshProperties,
  } = useAppData();
  const { rates } = useCurrencyRates();

  const [periodId, setPeriodId] = useState('thisMonth');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(null);

  const period = useMemo(() => {
    const presets = getPeriodPresets(dayjs());
    return presets[periodId];
  }, [periodId]);

  const userBookings   = useMemo(() => filterBookingsForUser(bookings, user),     [bookings, user]);
  const userProperties = useMemo(() => filterPropertiesForUser(properties, user), [properties, user]);

  // TD-120 фаза D: контекст конвертации валют для statisticsCalc.
  // Если курсы ещё не подгрузились — `convertAmount` молча вернёт исходные
  // числа (graceful degrade), статистика покажет неконвертированные суммы.
  const propertyCurrencyById = useMemo(() => {
    const map = new Map();
    (properties || []).forEach((p) => { if (p?.id) map.set(p.id, p.currency || null); });
    return map;
  }, [properties]);

  const fxCtx = useMemo(() => ({
    rates,
    targetCurrency: currency,
    propertyCurrencyById,
    today: dayjs().format('YYYY-MM-DD'),
  }), [rates, currency, propertyCurrencyById]);

  const stats = useMemo(() => ({
    revenue:          computeRevenue(userBookings, period.from, period.to, fxCtx),
    agencyIncome:     computeAgencyIncome(userBookings, period.from, period.to, fxCtx),
    activeBookings:   computeActiveBookingsCount(userBookings, dayjs()),
    occupancyPercent: computeOccupancyPercent(userBookings, userProperties, period.from, period.to),
  }), [userBookings, userProperties, period, fxCtx]);

  const monthlyData = useMemo(
    () => [
      ...computeMonthlyRevenue(userBookings, 12, dayjs(), fxCtx),
      ...computeMonthlyForecast(userBookings, 12, dayjs(), fxCtx),
    ],
    [userBookings, fxCtx]
  );

  const bookingsCountData = useMemo(
    () => computeMonthlyBookingsCount(userBookings, 12, 12, dayjs()),
    [userBookings]
  );

  const topProps = useMemo(
    () => computeTopProperties(userBookings, userProperties, period.from, period.to, 5, fxCtx),
    [userBookings, userProperties, period, fxCtx]
  );

  const isAdmin = !user?.teamMembership;

  const agentLeaderboard = useMemo(
    () => (isAdmin ? computeAgentLeaderboard(bookings, teamMembers, period.from, period.to, 5, fxCtx) : []),
    [isAdmin, bookings, teamMembers, period, fxCtx]
  );

  const selectedMonth = selectedMonthIdx != null ? monthlyData[selectedMonthIdx] : null;
  const breakdownRows = useMemo(
    () => (selectedMonth ? breakdownByPropertyForMonth(userBookings, userProperties, selectedMonth.key, fxCtx) : []),
    [userBookings, userProperties, selectedMonth, fxCtx]
  );

  const sym = getCurrencySymbol(currency || 'THB');
  const loading = bookingsLoading || propertiesLoading || (isAdmin && teamMembersLoading);

  const labels = {
    revenue:           t('statisticsKpiRevenue'),
    agencyIncome:      t('statisticsKpiAgencyIncome'),
    activeBookings:    t('statisticsKpiActiveBookings'),
    activeBookingsSub: t('statisticsKpiActiveBookingsSub'),
    occupancy:         t('statisticsKpiOccupancy'),
    occupancySub:      t('statisticsKpiOccupancySub'),
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshBookings(), refreshProperties()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBookings, refreshProperties]);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerScroll}
        >
          <StatisticsPeriodPicker value={periodId} onChange={setPeriodId} />
        </ScrollView>

        <View style={styles.kpiWrap}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            <StatisticsKpiCards
              revenue={stats.revenue}
              agencyIncome={stats.agencyIncome}
              activeBookings={stats.activeBookings}
              occupancyPercent={stats.occupancyPercent}
              currencySymbol={sym}
              labels={labels}
              cardFlexBasis="47%"
            />
          )}
        </View>

        {!loading && (
          <View style={styles.chartWrap}>
            <StatisticsRevenueChart
              data={monthlyData}
              title={t('statisticsChartRevenue12m')}
              currencySymbol={sym}
              labels={{ revenue: t('statisticsKpiRevenue'), income: t('statisticsKpiAgencyIncome') }}
              scrollable
              alwaysShowValues
              colWidth={80}
              barMaxWidth={32}
              fullNumbers
              showYear
              onSelectMonth={(_, idx) => setSelectedMonthIdx(idx)}
            />
          </View>
        )}

        {!loading && (
          <View style={styles.chartWrap}>
            <StatisticsBookingsCountChart
              data={bookingsCountData}
              title={t('statisticsChartBookingsCount')}
              labels={{
                created:   t('statisticsChartBookingsCreated'),
                checkedIn: t('statisticsChartBookingsCheckedIn'),
              }}
              scrollable
              alwaysShowValues
              colWidth={80}
              barMaxWidth={32}
              showYear
            />
          </View>
        )}

        {!loading && (
          <View style={styles.chartWrap}>
            <StatisticsTopProperties
              data={topProps}
              title={t('statisticsTopPropertiesTitle')}
              currencySymbol={sym}
              emptyText={t('statisticsTopPropertiesEmpty')}
              columns={{
                property:  t('statisticsTopColProperty'),
                revenue:   t('statisticsTopColRevenue'),
                occupancy: t('statisticsTopColOccupancy'),
              }}
            />
          </View>
        )}

        {!loading && isAdmin && (
          <View style={styles.chartWrap}>
            <StatisticsAgentLeaderboard
              data={agentLeaderboard}
              title={t('statisticsAgentLeaderboardTitle')}
              currencySymbol={sym}
              emptyText={t('statisticsAgentLeaderboardEmpty')}
              companyLabel={user?.companyInfo?.name || t('workAsCompany') || 'Company'}
              columns={{
                agent:    t('statisticsAgentColName'),
                bookings: t('statisticsAgentColBookings'),
                income:   t('statisticsAgentColIncome'),
              }}
            />
          </View>
        )}
      </ScrollView>

      <StatisticsMonthBreakdownModal
        mobileMode
        visible={selectedMonth != null}
        monthLabel={selectedMonth ? `${selectedMonth.label} ${selectedMonth.year}` : ''}
        rows={breakdownRows}
        currencySymbol={sym}
        columns={{
          code:    t('statisticsBreakdownColCode'),
          revenue: t('statisticsKpiRevenue'),
          source:  t('statisticsBreakdownColSource'),
          income:  t('statisticsKpiAgencyIncome'),
        }}
        totalLabel={t('statisticsBreakdownTotal')}
        emptyText={t('statisticsBreakdownEmpty')}
        canGoPrev={selectedMonthIdx != null && selectedMonthIdx > 0}
        canGoNext={selectedMonthIdx != null && selectedMonthIdx < monthlyData.length - 1}
        onPrev={() => setSelectedMonthIdx((i) => (i > 0 ? i - 1 : i))}
        onNext={() => setSelectedMonthIdx((i) => (i != null && i < monthlyData.length - 1 ? i + 1 : i))}
        onClose={() => setSelectedMonthIdx(null)}
      />
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
    paddingHorizontal: 16,
    paddingBottom: 88,
  },
  pickerScroll: {
    paddingVertical: 4,
    paddingRight: 16,
  },
  kpiWrap: {
    marginTop: 20,
  },
  chartWrap: {
    marginTop: 12,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
