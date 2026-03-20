import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, Animated,
} from 'react-native';

const SKY = '#E3F2FD';
const BLUE = '#0088CC';
const FAB_SIZE = 56;
const CARD_WIDTH = 340;
const CARD_HEIGHT = 160; // collapsed content height (grows with results)

export default function WebFlightTracker() {
  const [expanded, setExpanded] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [error, setError] = useState(null);

  const anim = useRef(new Animated.Value(0)).current; // 0=collapsed, 1=expanded
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const open = () => {
    setExpanded(true);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 160, useNativeDriver: false }),
    ]).start();
  };

  const close = () => {
    Animated.sequence([
      Animated.timing(contentOpacity, { toValue: 0, duration: 100, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 240, useNativeDriver: false }),
    ]).start(() => setExpanded(false));
  };

  const toggle = () => (expanded ? close() : open());

  const trackFlight = async () => {
    if (!flightNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 1500));
      if (flightNumber.toUpperCase().includes('SU274')) {
        setFlightData({
          number: 'SU274', airline: 'Aeroflot', status: 'In Flight', statusColor: BLUE,
          departure: { airport: 'SVO', city: 'Moscow', time: '19:20' },
          arrival: { airport: 'HKT', city: 'Phuket', time: '08:30', estimated: '08:45' },
          aircraft: 'Boeing 777-300ER',
        });
      } else {
        setError('Рейс не найден. Проверьте номер (например, SU274)');
      }
    } catch {
      setError('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const CloudShape = ({ style }) => (
    <View style={[s.cloudWrap, style]} pointerEvents="none">
      <View style={s.cloudMain} />
      <View style={s.cloudBL} />
      <View style={s.cloudBR} />
      <View style={s.cloudTop} />
    </View>
  );

  // Animated dimensions: small square → full card
  const animWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, CARD_WIDTH] });
  const animHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [FAB_SIZE, flightData ? 370 : CARD_HEIGHT] });
  const animRadius = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 20] });

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View style={[s.card, { width: animWidth, height: animHeight, borderRadius: animRadius }]}>
        {/* Небо — всегда видно */}
        <View style={s.sky} pointerEvents="none">
          <CloudShape style={{ top: 8, left: 14, transform: [{ scale: 0.55 }] }} />
          <CloudShape style={{ top: 28, right: 24, transform: [{ scale: 0.75 }] }} />
          <CloudShape style={{ top: 6, right: 90, transform: [{ scale: 0.45 }] }} />
          <CloudShape style={{ top: 50, left: 70, transform: [{ scale: 0.65 }] }} />
        </View>

        {/* Содержимое — появляется после раскрытия */}
        {expanded && (
          <Animated.View style={[s.content, { opacity: contentOpacity }]}>
            {/* Крестик */}
            <TouchableOpacity style={s.closeBtn} onPress={close}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>

            <Text style={s.title}>Flight Tracker</Text>

            <View style={s.searchRow}>
              <TextInput
                style={s.input}
                placeholder="Номер рейса (SU274)"
                value={flightNumber}
                onChangeText={setFlightNumber}
                placeholderTextColor="#ADB5BD"
                autoCapitalize="characters"
                onSubmitEditing={trackFlight}
              />
              <TouchableOpacity style={s.findBtn} onPress={trackFlight} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={s.findTxt}>Найти</Text>}
              </TouchableOpacity>
            </View>

            {error && <Text style={s.errorTxt}>{error}</Text>}

            {flightData && (
              <View style={s.result}>
                <View style={s.resultHeader}>
                  <View>
                    <Text style={s.airline}>{flightData.airline}</Text>
                    <Text style={s.flightNum}>{flightData.number}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: flightData.statusColor + '20' }]}>
                    <Text style={[s.badgeTxt, { color: flightData.statusColor }]}>{flightData.status}</Text>
                  </View>
                </View>
                <View style={s.route}>
                  <View style={s.airport}>
                    <Text style={s.iata}>{flightData.departure.airport}</Text>
                    <Text style={s.city}>{flightData.departure.city}</Text>
                    <Text style={s.time}>{flightData.departure.time}</Text>
                  </View>
                  <View style={s.routeLine}>
                    <View style={s.line} /><Text style={s.planeIco}>✈</Text><View style={s.line} />
                  </View>
                  <View style={[s.airport, { alignItems: 'flex-end' }]}>
                    <Text style={s.iata}>{flightData.arrival.airport}</Text>
                    <Text style={s.city}>{flightData.arrival.city}</Text>
                    <Text style={s.time}>{flightData.arrival.time}</Text>
                  </View>
                </View>
                <View style={s.resultFooter}>
                  <Text style={s.aircraft}>{flightData.aircraft}</Text>
                  {flightData.arrival.estimated && (
                    <Text style={s.eta}>Ожидается: <Text style={{ fontWeight: '700' }}>{flightData.arrival.estimated}</Text></Text>
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Самолётик — кнопка (всегда в правом нижнем углу карточки) */}
        <TouchableOpacity style={s.fabArea} onPress={toggle} activeOpacity={0.8}>
          <Text style={s.fabIco}>✈</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...Platform.select({
      web: { position: 'fixed', bottom: 28, right: 28, zIndex: 9999, alignItems: 'flex-end' },
    }),
    alignItems: 'flex-end',
  },
  card: {
    backgroundColor: SKY,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 6px 24px rgba(0,136,204,0.22)' } }),
    borderWidth: 1,
    borderColor: BLUE,
    position: 'relative',
  },
  sky: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: SKY,
  },
  content: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: 20,
    paddingTop: 18,
  },
  closeBtn: {
    position: 'absolute', top: 10, right: 10, zIndex: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 12, color: '#495057', fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', color: '#212529', marginBottom: 16, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: '#212529',
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  findBtn: {
    backgroundColor: '#212529', borderRadius: 10,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  findTxt: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  errorTxt: {
    color: '#D81B60', fontSize: 11,
    backgroundColor: 'rgba(255,255,255,0.7)', padding: 5, borderRadius: 5,
  },
  result: {
    marginTop: 14, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 12,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  airline: { fontSize: 10, color: '#868E96', fontWeight: '600', textTransform: 'uppercase' },
  flightNum: { fontSize: 17, fontWeight: '800', color: '#212529' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeTxt: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  airport: { flex: 1 },
  iata: { fontSize: 18, fontWeight: '800', color: '#212529' },
  city: { fontSize: 10, color: '#868E96', marginBottom: 1 },
  time: { fontSize: 12, fontWeight: '700', color: '#212529' },
  routeLine: { flex: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#ADB5BD' },
  planeIco: { fontSize: 13, color: '#868E96', marginHorizontal: 6 },
  resultFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E9ECEF', paddingTop: 10 },
  aircraft: { fontSize: 9, color: '#ADB5BD', fontWeight: '500' },
  eta: { fontSize: 10, color: '#2E7D32' },

  // Кнопка-самолётик — всегда в правом нижнем углу
  fabArea: {
    position: 'absolute', bottom: 0, right: 0,
    width: FAB_SIZE, height: FAB_SIZE,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  fabIco: { fontSize: 22, color: BLUE },

  // Облака
  cloudWrap: { position: 'absolute', width: 60, height: 30 },
  cloudMain: { position: 'absolute', bottom: 0, width: 60, height: 20, backgroundColor: '#FFFFFF', borderRadius: 15 },
  cloudBL: { position: 'absolute', bottom: 5, left: 5, width: 25, height: 25, backgroundColor: '#FFFFFF', borderRadius: 15 },
  cloudBR: { position: 'absolute', bottom: 5, right: 5, width: 30, height: 30, backgroundColor: '#FFFFFF', borderRadius: 15 },
  cloudTop: { position: 'absolute', top: 0, left: 15, width: 25, height: 25, backgroundColor: '#FFFFFF', borderRadius: 15 },
});
