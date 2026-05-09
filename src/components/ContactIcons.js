import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const SW = 1.6;
const CAP = 'round';
const JN = 'round';

export function IconCall({ size = 22, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4.5 C5 3.7 5.7 3 6.5 3 H8.6 C9.3 3 9.9 3.5 10 4.2 L10.6 7.5 C10.7 8.1 10.5 8.7 10 9.1 L8.5 10.3 C9.7 12.7 11.3 14.3 13.7 15.5 L14.9 14 C15.3 13.5 15.9 13.3 16.5 13.4 L19.8 14 C20.5 14.1 21 14.7 21 15.4 V17.5 C21 18.3 20.3 19 19.5 19 C11.5 19 5 12.5 5 4.5 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
    </Svg>
  );
}

export function IconWhatsapp({ size = 22, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 20.5 L4.9 16.4 C4 15 3.5 13.3 3.5 11.5 C3.5 6.8 7.3 3 12 3 C16.7 3 20.5 6.8 20.5 11.5 C20.5 16.2 16.7 20 12 20 C10.3 20 8.7 19.5 7.4 18.6 L3.5 20.5 Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      <Path
        d="M9 8.2 C9 8.2 9.4 7.8 9.9 7.8 H10.4 C10.7 7.8 10.9 8 11 8.3 L11.5 9.6 C11.6 9.8 11.5 10.1 11.4 10.3 L10.9 10.9 C10.8 11 10.8 11.2 10.9 11.3 C11.4 12.2 12.2 13 13.1 13.5 C13.2 13.6 13.4 13.6 13.5 13.5 L14.1 13 C14.3 12.8 14.6 12.8 14.8 12.9 L16.1 13.4 C16.4 13.5 16.6 13.7 16.6 14 V14.5 C16.6 15 16.2 15.4 16.2 15.4 C15.7 15.9 14.9 16 14.4 16 C12.6 15.8 11 15 9.7 13.7 C8.4 12.4 7.6 10.8 7.4 9 C7.4 8.5 7.5 7.7 8 7.2"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
    </Svg>
  );
}

export function IconTelegram({ size = 22, color = '#888' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11.5 L20.5 4.2 C21 4 21.4 4.4 21.3 4.9 L18.5 19 C18.4 19.5 17.8 19.7 17.4 19.4 L11.5 15"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      <Path
        d="M3 11.5 L11.5 15 L10 19.5 C9.9 20 10.4 20.3 10.8 20 L13.5 17.7"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
      <Path
        d="M11.5 15 L17.5 8"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap={CAP}
        strokeLinejoin={JN}
      />
    </Svg>
  );
}
