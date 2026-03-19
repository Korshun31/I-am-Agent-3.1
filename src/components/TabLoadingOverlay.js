import React from 'react';
import { Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from './Logo';

// Принимает Animated.Value — opacity контролируется снаружи через .setValue()
export default function TabLoadingOverlay({ opacity }) {
  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <ActivityIndicator size="large" color={COLORS.teal} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
