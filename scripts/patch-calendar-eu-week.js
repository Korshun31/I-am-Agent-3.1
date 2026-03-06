#!/usr/bin/env node
/**
 * Apply European week (Monday first) to react-native-calendar-range-picker.
 * Run after patch-package in postinstall.
 */
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'node_modules', 'react-native-calendar-range-picker', 'dist', 'utils');
const dataPath = path.join(base, 'data.js');
const localePath = path.join(base, 'locale.js');

function patchData() {
  if (!fs.existsSync(dataPath)) return;
  let s = fs.readFileSync(dataPath, 'utf8');
  s = s.replace(
    /if \(i == calcDate\.day\(\) && calcDate\.month\(\) == targetMonth\)/,
    'if (((calcDate.day() + 6) % 7) === i && calcDate.month() == targetMonth)'
  );
  s = s.replace('if (i === 0 || i === 6) {', 'if (i === 5 || i === 6) {');
  fs.writeFileSync(dataPath, s);
}

function patchLocale() {
  if (!fs.existsSync(localePath)) return;
  let s = fs.readFileSync(localePath, 'utf8');
  s = s.replace(
    'dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]',
    'dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]'
  );
  fs.writeFileSync(localePath, s);
}

function patchMonth() {
  const monthPath = path.join(__dirname, '..', 'node_modules', 'react-native-calendar-range-picker', 'dist', 'Month.js');
  if (!fs.existsSync(monthPath)) return;
  let s = fs.readFileSync(monthPath, 'utf8');
  if (s.includes('yearFirst')) return;
  s = s.replace(
    'var year = item.year, month = item.month;',
    'var year = item.year, month = item.month;\n    var yearStr = String(year);\n    var yearFirst = yearStr.length >= 2 ? yearStr.slice(0, 2) : yearStr;\n    var yearLast = yearStr.length >= 2 ? yearStr.slice(2) : \'\';'
  );
  s = s.replace(
    /\{year\}\s*\{locale\.year\}/,
    '<Text>{yearFirst}</Text>\n          {yearLast ? <Text style={styles.yearLast}>{yearLast}</Text> : null}\n          {locale.year}'
  );
  s = s.replace(
    'monthName: {\n        fontSize: 16,\n    },',
    'monthName: {\n        fontSize: 16,\n    },\n    yearLast: {\n        fontWeight: \'700\',\n        color: \'#E85D4C\',\n    },'
  );
  fs.writeFileSync(monthPath, s);
}

patchData();
patchLocale();
patchMonth();
