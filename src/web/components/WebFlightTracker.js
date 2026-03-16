import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';

export default function WebFlightTracker() {
  const [flightNumber, setFlightNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [error, setError] = useState(null);

  const trackFlight = async () => {
    if (!flightNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (flightNumber.toUpperCase().includes('SU274')) {
        setFlightData({
          number: 'SU274',
          airline: 'Aeroflot',
          status: 'In Flight',
          statusColor: '#0088CC',
          departure: { airport: 'SVO', city: 'Moscow', time: '19:20', date: '06 Mar' },
          arrival: { airport: 'HKT', city: 'Phuket', time: '08:30', date: '07 Mar', estimated: '08:45' },
          aircraft: 'Boeing 777-300ER'
        });
      } else {
        setError('Рейс не найден. Проверьте номер (например, SU274)');
      }
    } catch (e) {
      setError('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const CartoonCloud = ({ style }) => (
    <View style={[styles.cloudContainer, style]}>
      <View style={styles.cloudMain} />
      <View style={styles.cloudBubbleLeft} />
      <View style={styles.cloudBubbleRight} />
      <View style={styles.cloudBubbleTop} />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.skyBackground}>
        <CartoonCloud style={{ top: 15, left: 20, transform: [{ scale: 0.6 }] }} />
        <CartoonCloud style={{ top: 35, right: 30, transform: [{ scale: 0.8 }] }} />
        <CartoonCloud style={{ top: 10, right: 110, transform: [{ scale: 0.5 }] }} />
        <CartoonCloud style={{ top: 60, left: 80, transform: [{ scale: 0.7 }] }} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Flight Tracker</Text>
        
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Номер рейса (SU274)"
            value={flightNumber}
            onChangeText={setFlightNumber}
            placeholderTextColor="#ADB5BD"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={trackFlight} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.searchBtnText}>Найти</Text>}
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {flightData && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.airlineText}>{flightData.airline}</Text>
                <Text style={styles.flightNumText}>{flightData.number}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: flightData.statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: flightData.statusColor }]}>{flightData.status}</Text>
              </View>
            </View>

            <View style={styles.routeRow}>
              <View style={styles.airportBlock}>
                <Text style={styles.airportCode}>{flightData.departure.airport}</Text>
                <Text style={styles.cityText}>{flightData.departure.city}</Text>
                <Text style={styles.timeText}>{flightData.departure.time}</Text>
              </View>
              
              <View style={styles.planeLine}>
                <View style={styles.line} />
                <Text style={styles.planeIcon}>✈</Text>
                <View style={styles.line} />
              </View>

              <View style={[styles.airportBlock, { alignItems: 'flex-end' }]}>
                <Text style={styles.airportCode}>{flightData.arrival.airport}</Text>
                <Text style={styles.cityText}>{flightData.arrival.city}</Text>
                <Text style={styles.timeText}>{flightData.arrival.time}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.aircraftText}>{flightData.aircraft}</Text>
              {flightData.arrival.estimated && (
                <Text style={styles.etaText}>Ожидается: <Text style={{fontWeight: '700'}}>{flightData.arrival.estimated}</Text></Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }),
    marginBottom: 20,
    position: 'relative',
    minHeight: 140,
  },
  skyBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // Теперь закрашено полностью до самого низа
    backgroundColor: '#E3F2FD',
    zIndex: 0,
  },
  content: {
    padding: 24,
    zIndex: 1,
  },
  cloudContainer: {
    position: 'absolute',
    width: 60,
    height: 30,
  },
  cloudMain: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  cloudBubbleLeft: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    width: 25,
    height: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  cloudBubbleRight: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  cloudBubbleTop: {
    position: 'absolute',
    top: 0,
    left: 15,
    width: 25,
    height: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 20 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212529',
  },
  searchBtn: {
    backgroundColor: '#212529',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  errorText: { color: '#D81B60', fontSize: 12, marginTop: 5, backgroundColor: 'rgba(255,255,255,0.7)', padding: 5, borderRadius: 5 },
  
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  airlineText: { fontSize: 11, color: '#868E96', fontWeight: '600', textTransform: 'uppercase' },
  flightNumText: { fontSize: 18, fontWeight: '800', color: '#212529' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  airportBlock: { flex: 1 },
  airportCode: { fontSize: 20, fontWeight: '800', color: '#212529' },
  cityText: { fontSize: 11, color: '#868E96', marginBottom: 2 },
  timeText: { fontSize: 13, fontWeight: '700', color: '#212529' },
  
  planeLine: { flex: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#ADB5BD' },
  planeIcon: { fontSize: 14, color: '#868E96', marginHorizontal: 8 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E9ECEF', paddingTop: 12 },
  aircraftText: { fontSize: 10, color: '#ADB5BD', fontWeight: '500' },
  etaText: { fontSize: 11, color: '#2E7D32' },
});
