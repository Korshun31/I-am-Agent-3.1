import { Dimensions } from 'react-native';

const REFERENCE_WIDTH = 440;
const MIN_SCALE = 0.85;

const width = Dimensions.get('window').width;

export const SCALE = Math.max(MIN_SCALE, Math.min(1, width / REFERENCE_WIDTH));

export function sz(n) {
  return Math.round(n * SCALE);
}

export const FONT = {
  title: 22,
  body: 16,
  label: 14,
  caption: 12,
};

export const WEIGHT = {
  bold: '700',
  semibold: '600',
  regular: '400',
};
