import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Logo, { COLORS } from '../components/Logo';

const DOT_COLORS = [COLORS.redOrange, COLORS.yellowOrange, COLORS.green];

const JUMP_DURATION = 380;
const PAUSE_BETWEEN_JUMP = 80;
// Один круг: три прыжка по очереди → пауза. Длительность цикла:
const FULL_CYCLE = JUMP_DURATION * 3 + PAUSE_BETWEEN_JUMP * 2;

function JumpingDot({ color, index }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const delay = index * (JUMP_DURATION + PAUSE_BETWEEN_JUMP);

  useEffect(() => {
    const jump = () => {
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -14,
          duration: JUMP_DURATION / 2,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: JUMP_DURATION / 2,
          useNativeDriver: true,
        }),
      ]).start();
    };

    let interval;
    const timeout = setTimeout(() => {
      jump();
      interval = setInterval(jump, FULL_CYCLE);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [index, translateY]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color, transform: [{ translateY }] },
      ]}
    />
  );
}

export default function Preloader({ progress }) {
  const showProgress = typeof progress === 'number';
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Logo />
      </View>
      <Text style={styles.title}>I am Agent</Text>
      <Text style={styles.tagline}>Your smart organizer for real estate</Text>
      <View style={styles.dotsRow}>
        {DOT_COLORS.map((color, i) => (
          <JumpingDot key={i} color={color} index={i} />
        ))}
      </View>
      {showProgress ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      ) : (
        <Text style={styles.loadingText}>{'Loading...'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: COLORS.title,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.subtitle,
  },
  progressWrap: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.green,
  },
});
