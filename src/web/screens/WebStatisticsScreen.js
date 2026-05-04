import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { getBookings } from '../../services/bookingsService';
import { getProperties } from '../../services/propertiesService';
import { getActiveTeamMembers } from '../../services/companyService';
import { getCurrencySymbol } from '../../utils/currency';
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
  filterBookingsForUser,
  filterPropertiesForUser,
} from '../../utils/statisticsCalc';
import StatisticsPeriodPicker from '../components/statistics/StatisticsPeriodPicker';
import StatisticsKpiCards from '../components/statistics/StatisticsKpiCards';
import StatisticsRevenueChart from '../components/statistics/StatisticsRevenueChart';
import StatisticsTopProperties from '../components/statistics/StatisticsTopProperties';
import StatisticsAgentLeaderboard from '../components/statistics/StatisticsAgentLeaderboard';
import StatisticsBookingsCountChart from '../components/statistics/StatisticsBookingsCountChart';

const C = {
  bg:      '#F4F6F9',
  surface: '#FFFFFF',
  border:  '#E9ECEF',
  text:    '#212529',
  muted:   '#6C757D',
};

export default function WebStatisticsScreen({ user, refreshKey }) {
  const { t, currency } = useLanguage();
  const [bookings, setBookings]       = useState([]);
  const [properties, setProperties]   = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [periodId, setPeriodId]       = useState('thisMonth');

  const isAdmin = !user?.teamMembership;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const calls = [getBookings(), getProperties()];
    if (isAdmin && user?.companyId) calls.push(getActiveTeamMembers(user.companyId));
    Promise.all(calls)
      .then((res) => {
        if (cancelled) return;
        setBookings(res[0] || []);
        setProperties(res[1] || []);
        setTeamMembers(res[2] || []);
      })
      .catch(() => {
        if (cancelled) return;
        setBookings([]);
        setProperties([]);
        setTeamMembers([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, isAdmin, user?.companyId]);

  const period = useMemo(() => {
    const presets = getPeriodPresets(dayjs());
    return presets[periodId];
  }, [periodId]);

  const userBookings   = useMemo(() => filterBookingsForUser(bookings, user),   [bookings, user]);
  const userProperties = useMemo(() => filterPropertiesForUser(properties, user), [properties, user]);

  const stats = useMemo(() => ({
    revenue:          computeRevenue(userBookings, period.from, period.to),
    agencyIncome:     computeAgencyIncome(userBookings, period.from, period.to),
    activeBookings:   computeActiveBookingsCount(userBookings, dayjs()),
    occupancyPercent: computeOccupancyPercent(userBookings, userProperties, period.from, period.to),
  }), [userBookings, userProperties, period]);

  const monthlyData = useMemo(
    () => [
      ...computeMonthlyRevenue(userBookings, 12, dayjs()),
      ...computeMonthlyForecast(userBookings, 12, dayjs()),
    ],
    [userBookings]
  );

  const bookingsCountData = useMemo(
    () => computeMonthlyBookingsCount(userBookings, 12, 12, dayjs()),
    [userBookings]
  );

  const topProps = useMemo(
    () => computeTopProperties(userBookings, userProperties, period.from, period.to, 5),
    [userBookings, userProperties, period]
  );

  const agentLeaderboard = useMemo(
    () => isAdmin ? computeAgentLeaderboard(bookings, teamMembers, period.from, period.to, 5) : [],
    [isAdmin, bookings, teamMembers, period]
  );

  const sym = getCurrencySymbol(currency || 'THB');

  const labels = {
    revenue:           t('statisticsKpiRevenue'),
    agencyIncome:      t('statisticsKpiAgencyIncome'),
    activeBookings:    t('statisticsKpiActiveBookings'),
    activeBookingsSub: t('statisticsKpiActiveBookingsSub'),
    occupancy:         t('statisticsKpiOccupancy'),
    occupancySub:      t('statisticsKpiOccupancySub'),
  };

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <Text style={s.title}>{t('statistics')}</Text>
          <Text style={s.subtitle}>{t('statisticsSubtitle')}</Text>
        </View>

        <StatisticsPeriodPicker value={periodId} onChange={setPeriodId} />

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color="#3D7D82" />
          </View>
        ) : (
          <>
            <StatisticsKpiCards
              revenue={stats.revenue}
              agencyIncome={stats.agencyIncome}
              activeBookings={stats.activeBookings}
              occupancyPercent={stats.occupancyPercent}
              currencySymbol={sym}
              labels={labels}
            />
            <View style={s.twoColumns}>
              <View style={s.column}>
                <StatisticsRevenueChart
                  data={monthlyData}
                  title={t('statisticsChartRevenue12m')}
                  currencySymbol={sym}
                  labels={{ revenue: t('statisticsKpiRevenue'), income: t('statisticsKpiAgencyIncome') }}
                  scrollable
                />
              </View>
              <View style={s.column}>
                <StatisticsBookingsCountChart
                  data={bookingsCountData}
                  title={t('statisticsChartBookingsCount')}
                  labels={{
                    created:   t('statisticsChartBookingsCreated'),
                    checkedIn: t('statisticsChartBookingsCheckedIn'),
                  }}
                  scrollable
                />
              </View>
            </View>

            <View style={s.twoColumns}>
              <View style={s.column}>
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
              {isAdmin && (
                <View style={s.column}>
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
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, gap: 16 },
  header: { gap: 4 },
  title: { fontSize: 24, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 14, color: C.muted },
  loading: { paddingVertical: 40, alignItems: 'center' },
  twoColumns: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 320 },
});
