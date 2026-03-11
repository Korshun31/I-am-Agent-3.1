#!/usr/bin/env node
/**
 * Verify that calendar patch was applied before EAS build.
 * Run: npm run verify-build
 * Exit 1 if patch is missing — prevents wasted TestFlight builds.
 */
const fs = require('fs');
const path = require('path');

const CALENDAR_DIST = path.join(__dirname, '..', 'node_modules', 'react-native-calendar-range-picker', 'dist');
const DAY_JS = path.join(CALENDAR_DIST, 'Day.js');
const INDEX_JS = path.join(CALENDAR_DIST, 'index.js');

const CHECKS = [
  {
    file: DAY_JS,
    name: 'Day.js',
    strings: ['dimPastDates', '#bababe'],
    desc: 'прошедшие даты серым (dimPastDates)',
  },
  {
    file: INDEX_JS,
    name: 'index.js',
    strings: ['dimPastDates'],
    desc: 'dimPastDates прокидывается в календарь',
  },
];

let failed = false;

console.log('Verifying calendar patch for TestFlight build...\n');

for (const check of CHECKS) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL: ${check.name} not found at ${check.file}`);
    console.error('       Run: npm install');
    failed = true;
    continue;
  }
  const content = fs.readFileSync(check.file, 'utf8');
  const missing = check.strings.filter((s) => !content.includes(s));
  if (missing.length > 0) {
    console.error(`FAIL: ${check.name} — patch not applied (${check.desc})`);
    console.error(`       Missing: ${missing.join(', ')}`);
    failed = true;
  } else {
    console.log(`OK: ${check.name}`);
  }
}

if (failed) {
  console.error('\nCalendar patch was NOT applied. TestFlight build would have wrong behavior.');
  console.error('Fix: npm install (postinstall runs patch), then npm run verify-build');
  process.exit(1);
}

console.log('\nPatch verified. Safe to run: eas build --platform ios');
process.exit(0);
