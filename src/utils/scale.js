import { Dimensions } from 'react-native';

const REFERENCE_WIDTH = 440;
const MIN_SCALE = 0.85;

const width = Dimensions.get('window').width;

export const SCALE = Math.max(MIN_SCALE, Math.min(1, width / REFERENCE_WIDTH));

export function sz(n) {
  return Math.round(n * SCALE);
}
