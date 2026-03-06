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

function patchDisabledDates() {
  const root = path.join(__dirname, '..', 'node_modules', 'react-native-calendar-range-picker', 'dist');
  const files = ['index.js', 'CalendarList.js', 'Month.js', 'Week.js', 'Day.js'];
  files.forEach((f) => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) return;
    let s = fs.readFileSync(p, 'utf8');
    if (f === 'index.js') {
      if (s.includes('disabledDates')) return;
      s = s.replace('disabledAfterToday = _a.disabledAfterToday;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates;');
      s = s.replace('disabledAfterToday={disabledAfterToday}/>);', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates}/>);');
    } else if (f === 'CalendarList.js') {
      if (!s.includes('disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} style={style}');
        s = s.replace('[locale.today, startDate, endDate]', '[locale.today, startDate, endDate, disabledDates]');
      }
      if (!s.includes('collapsable={false}')) {
        s = s.replace('<View pointerEvents="box-none" style={[', '<View pointerEvents="box-none" collapsable={false} style={[');
      }
    } else if (f === 'Month.js') {
      if (!s.includes('disabledDates = _a.disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}/>);', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} style={style}/>);');
      }
      if (!s.includes('prevProps.disabledDates')) {
        s = s.replace('prevProps.locale.today !== nextProps.locale.today) {\n        return false;\n    }\n    return true;\n}', 'prevProps.locale.today !== nextProps.locale.today) {\n        return false;\n    }\n    var pa = prevProps.disabledDates || [];\n    var na = nextProps.disabledDates || [];\n    if (pa.length !== na.length) return false;\n    for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;\n}');
      }
    } else if (f === 'Week.js') {
      if (!s.includes('disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var DayComponent = day.date ? (<TouchableOpacity disabled={', 'var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isDisabled = (disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday) || isOccupied;\n            var DayComponent = day.date ? (<TouchableOpacity pointerEvents={isDisabled ? "none" : "auto"} disabled={');
        s = s.replace('(disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday)}', 'isDisabled}');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}/>', 'disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>');
      }
      if (!s.includes('isDisabled ? (<View')) {
        s = s.replace('var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isDisabled = (disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday) || isOccupied;\n            var DayComponent = day.date ? (<TouchableOpacity pointerEvents={isDisabled ? "none" : "auto"} disabled={isDisabled} style={{', 'var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isDisabled = (disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday) || isOccupied;\n            var dayStyle = {');
        s = s.replace('flex: 1,\n                height: is6Weeks ? 45 : 50,\n                alignItems: "center",\n            }} onPress={function () { return handlePress(day.date || ""); }} activeOpacity={1} key={day.date || i}>\n          <Day', 'flex: 1, height: is6Weeks ? 45 : 50, alignItems: "center" };\n            var DayComponent = day.date ? (isDisabled ? (<View pointerEvents="none" style={dayStyle} key={day.date || i}>\n          <Day');
        s = s.replace('</TouchableOpacity>) : (<View pointerEvents="none"', '</View>) : (<TouchableOpacity style={dayStyle} onPress={function () { return handlePress(day.date || ""); }} activeOpacity={1} key={day.date || i}>\n          <Day day={day} locale={locale} disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>\n        </TouchableOpacity>)) : (<View pointerEvents="none"');
      }
      if (!s.includes('prevProps.disabledDates')) {
        s = s.replace('if (JSON.stringify(prevProps.week) === JSON.stringify(nextProps.week))\n        return true;\n    return false;', 'if (JSON.stringify(prevProps.week) !== JSON.stringify(nextProps.week))\n        return false;\n    var pa = prevProps.disabledDates || [];\n    var na = nextProps.disabledDates || [];\n    if (pa.length !== na.length) return false;\n    for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;');
      }
    } else if (f === 'Day.js') {
      if (!s.includes('isOccupied = _a.isOccupied')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, isOccupied = _a.isOccupied, style = _a.style;');
        s = s.replace('(disabledAfterToday && isAfterToday)\n            ? disabledTextColor', '(disabledAfterToday && isAfterToday) ||\n            isOccupied\n            ? disabledTextColor');
      }
      if (!s.includes('prevProps.isOccupied')) {
        s = s.replace('if (prevProps.day.type === nextProps.day.type)\n        return true;\n    return false;', 'if (prevProps.day.type !== nextProps.day.type) return false;\n    if (prevProps.isOccupied !== nextProps.isOccupied) return false;\n    return true;');
      }
    }
    fs.writeFileSync(p, s);
  });
}

patchData();
patchLocale();
patchMonth();
patchDisabledDates();
