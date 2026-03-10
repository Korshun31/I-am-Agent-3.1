/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',
        primaryLight: '#4CAF50',
        primaryBg: 'rgba(46,125,50,0.08)',
        warmBg: '#F5F2EB',
      },
    },
  },
  plugins: [],
}
