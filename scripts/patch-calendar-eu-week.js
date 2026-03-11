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
      if (!s.includes('disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates;');
        s = s.replace('disabledAfterToday={disabledAfterToday}/>);', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates}/>);');
      }
      if (!s.includes('occupiedCheckInDates')) {
        s = s.replace('disabledDates = _a.disabledDates;', 'disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates, occupiedCheckOutDates = _a.occupiedCheckOutDates;');
        s = s.replace('disabledDates={disabledDates}/>', 'disabledDates={disabledDates} occupiedCheckInDates={occupiedCheckInDates} occupiedCheckOutDates={occupiedCheckOutDates}/>');
      }
      if (!s.includes('dimPastDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates', 'disabledAfterToday = _a.disabledAfterToday, dimPastDates = _a.dimPastDates, disabledDates = _a.disabledDates');
        s = s.replace('disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday}', 'disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates}');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate;');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates}/>);', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}}/>);');
      }
    } else if (f === 'CalendarList.js') {
      if (!s.includes('disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} style={style}');
        s = s.replace('[locale.today, startDate, endDate]', '[locale.today, startDate, endDate, disabledDates]');
      }
      if (!s.includes('collapsable={false}')) {
        s = s.replace('<View pointerEvents="box-none" style={[', '<View pointerEvents="box-none" collapsable={false} style={[');
      }
      if (!s.includes('occupiedCheckInDates')) {
        s = s.replace('disabledDates = _a.disabledDates, style = _a.style;', 'disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates, occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;');
        s = s.replace('disabledDates={disabledDates} style={style}', 'disabledDates={disabledDates} occupiedCheckInDates={occupiedCheckInDates} occupiedCheckOutDates={occupiedCheckOutDates} style={style}');
        s = s.replace('[locale.today, startDate, endDate, disabledDates]', '[locale.today, startDate, endDate, disabledDates, occupiedCheckInDates, occupiedCheckOutDates]');
      }
      if (!s.includes('dimPastDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates', 'disabledAfterToday = _a.disabledAfterToday, dimPastDates = _a.dimPastDates, disabledDates = _a.disabledDates');
        s = s.replace('disabledAfterToday={disabledAfterToday} disabledDates={disabledDates}', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} disabledDates={disabledDates}');
        s = s.replace('[locale.today, startDate, endDate, disabledDates, occupiedCheckInDates, occupiedCheckOutDates]', '[locale.today, startDate, endDate, disabledDates, dimPastDates, occupiedCheckInDates, occupiedCheckOutDates]');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate, style = _a.style;');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates} style={style}', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}} style={style}');
        s = s.replace('[locale.today, startDate, endDate, disabledDates, dimPastDates, occupiedCheckInDates, occupiedCheckOutDates]', '[locale.today, startDate, endDate, disabledDates, dimPastDates, occupiedCheckInDates, occupiedCheckOutDates, eventCountsByDate]');
      }
    } else if (f === 'Month.js') {
      if (!s.includes('disabledDates = _a.disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}/>);', 'disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} style={style}/>);');
      }
      if (!s.includes('prevProps.disabledDates')) {
        s = s.replace('prevProps.locale.today !== nextProps.locale.today) {\n        return false;\n    }\n    return true;\n}', 'prevProps.locale.today !== nextProps.locale.today) {\n        return false;\n    }\n    var pa = prevProps.disabledDates || [];\n    var na = nextProps.disabledDates || [];\n    if (pa.length !== na.length) return false;\n    for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;\n}');
      }
      if (!s.includes('occupiedCheckInDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates, occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;');
        s = s.replace('disabledDates={disabledDates} style={style}/>', 'disabledDates={disabledDates} occupiedCheckInDates={occupiedCheckInDates} occupiedCheckOutDates={occupiedCheckOutDates} style={style}/>');
        s = s.replace('for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;\n}', 'for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    var pci = prevProps.occupiedCheckInDates || []; var nci = nextProps.occupiedCheckInDates || []; if (pci.length !== nci.length) return false; for (var i = 0; i < pci.length; i++) { if (pci[i] !== nci[i]) return false; }\n    var pco = prevProps.occupiedCheckOutDates || []; var nco = nextProps.occupiedCheckOutDates || []; if (pco.length !== nco.length) return false; for (var i = 0; i < pco.length; i++) { if (pco[i] !== nco[i]) return false; }\n    if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    return true;\n}');
      }
      if (!s.includes('dimPastDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates', 'disabledAfterToday = _a.disabledAfterToday, dimPastDates = _a.dimPastDates, disabledDates = _a.disabledDates');
        s = s.replace('disabledAfterToday={disabledAfterToday} disabledDates={disabledDates}', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} disabledDates={disabledDates}');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate, style = _a.style;');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates} style={style}/>', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}} style={style}/>');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates} style={style}', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}} style={style}');
      }
    } else if (f === 'Week.js') {
      if (!s.includes('disabledDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates, style = _a.style;');
        s = s.replace('var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var DayComponent = day.date ? (<TouchableOpacity disabled={', 'var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isDisabled = (disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday) || isOccupied;\n            var DayComponent = day.date ? (<TouchableOpacity pointerEvents={isDisabled ? "none" : "auto"} disabled={');
        s = s.replace('(disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday)}', 'isDisabled}');
        s = s.replace('disabledAfterToday={disabledAfterToday} style={style}/>', 'disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>');
      }
      if (!s.includes('isDisabled ? (<View') && !s.includes('var dayStyle = {')) {
        s = s.replace('var DayComponent = day.date ? (<TouchableOpacity disabled={isDisabled} style={{', 'var dayStyle = { flex: 1, height: is6Weeks ? 45 : 50, alignItems: "center" };\n            var DayComponent = day.date ? (isDisabled ? (<TouchableOpacity style={dayStyle} onPress={function () {}} activeOpacity={1} key={day.date || i}>\n          <Day day={day} locale={locale} disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>\n        </TouchableOpacity>) : (<TouchableOpacity style={dayStyle} onPress={function () { return handlePress(day.date || ""); }} activeOpacity={1} key={day.date || i}>\n          <Day');
        s = s.replace(/day={day} locale={locale} disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}\/\>\n        <\/TouchableOpacity>\) \) : \(<View style=\{\{ flex: 1, height: is6Weeks \? 45 : 50 \}\}/g, 'day={day} locale={locale} disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>\n        </TouchableOpacity>)) : (<View style={{ flex: 1, height: is6Weeks ? 45 : 50 }}');
      }
      if (!s.includes('prevProps.disabledDates')) {
        s = s.replace('if (JSON.stringify(prevProps.week) === JSON.stringify(nextProps.week))\n        return true;\n    return false;', 'if (JSON.stringify(prevProps.week) !== JSON.stringify(nextProps.week))\n        return false;\n    var pa = prevProps.disabledDates || [];\n    var na = nextProps.disabledDates || [];\n    if (pa.length !== na.length) return false;\n    for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;');
      }
      if (!s.includes('occupiedCheckInDates')) {
        s = s.replace('disabledDates = _a.disabledDates, style = _a.style;', 'disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates, occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;');
        s = s.replace('var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isDisabled =', 'var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isCheckIn = occupiedCheckInDates && day.date && occupiedCheckInDates.indexOf(day.date) >= 0;\n            var isCheckOut = occupiedCheckOutDates && day.date && occupiedCheckOutDates.indexOf(day.date) >= 0;\n            var isDisabled =');
        s = s.replace('isOccupied={isOccupied} style={style}/>', 'isOccupied={isOccupied} isCheckIn={isCheckIn} isCheckOut={isCheckOut} style={style}/>');
        s = s.replace('for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    return true;\n}\nexport default memo(Week', 'for (var i = 0; i < pa.length; i++) { if (pa[i] !== na[i]) return false; }\n    var pci = prevProps.occupiedCheckInDates || []; var nci = nextProps.occupiedCheckInDates || []; if (pci.length !== nci.length) return false; for (var i = 0; i < pci.length; i++) { if (pci[i] !== nci[i]) return false; }\n    var pco = prevProps.occupiedCheckOutDates || []; var nco = nextProps.occupiedCheckOutDates || []; if (pco.length !== nco.length) return false; for (var i = 0; i < pco.length; i++) { if (pco[i] !== nco[i]) return false; }\n    if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    return true;\n}\nexport default memo(Week');
      }
      if (!s.includes('dimPastDates')) {
        s = s.replace('disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates', 'disabledDates = _a.disabledDates, dimPastDates = _a.dimPastDates, occupiedCheckInDates = _a.occupiedCheckInDates');
        s = s.replace('disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied}', 'disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied}');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate, style = _a.style;');
        s = s.replace(/<Day day=\{day\} locale=\{locale\}/g, '<Day day={day} locale={locale} eventCountsByDate={eventCountsByDate || {}}');
      }
      if (s.includes('pointerEvents="none" style={dayStyle}') || (s.includes('onStartShouldSetResponder') && s.includes('isDisabled ? (<View'))) {
        s = s.replace(/<View (?:pointerEvents="none" |onStartShouldSetResponder=\{function \(\) \{ return false; \}\} onMoveShouldSetResponder=\{function \(\) \{ return false; \}\} )?style={dayStyle} key={day\.date \|\| i}>\s*<Day/, '<TouchableOpacity style={dayStyle} onPress={function () {}} activeOpacity={1} key={day.date || i}>\n          <Day');
        const re = new RegExp('(\\s*)</View>(\\s*)\\) : \\(<TouchableOpacity style=\\{dayStyle\\} onPress=\\{function \\(\\) \\{ return handlePress');
        s = s.replace(re, '$1</TouchableOpacity>$2) : (<TouchableOpacity style={dayStyle} onPress={function () { return handlePress');
      }
      // Repair: remove orphaned block left by partial replace (broken <Day> with flex:1 etc)
      s = s.replace(/<Day\s+flex: 1,\s*height: is6Weeks \? 45 : 50,\s*alignItems: "center",?\s*\}\}\s*onPress=\{function \(\) \{ return handlePress\(day\.date \|\| ""\); \}\}\s*activeOpacity=\{1\}\s*key=\{day\.date \|\| i\}>\s*/g, '');
      // Repair: add missing ) for ternary (day.date ? (isDisabled ? A : B) : C)
      s = s.replace(/isOccupied=\{isOccupied\} style=\{style\}\/>\s*<\/TouchableOpacity>\) : \(<View style=\{\{ flex: 1, height: is6Weeks/g, 'isOccupied={isOccupied} style={style}/>\n        </TouchableOpacity>)) : (<View style={{ flex: 1, height: is6Weeks');
      // Repair: define isDisabled (and deps) when used but missing - fixes "Property 'isDisabled' doesn't exist"
      if (s.includes('isDisabled ? (<TouchableOpacity') && !s.includes('var isDisabled = ')) {
        s = s.replace('var day = week[i];\n            var dayStyle = { flex: 1, height: is6Weeks ? 45 : 50, alignItems: "center" };', 'var day = week[i];\n            var isOccupied = disabledDates && day.date && disabledDates.indexOf(day.date) >= 0;\n            var isCheckIn = occupiedCheckInDates && day.date && occupiedCheckInDates.indexOf(day.date) >= 0;\n            var isCheckOut = occupiedCheckOutDates && day.date && occupiedCheckOutDates.indexOf(day.date) >= 0;\n            var isDisabled = (disabledBeforeToday && day.isBeforeToday) || (disabledAfterToday && day.isAfterToday) || isOccupied;\n            var dayStyle = { flex: 1, height: is6Weeks ? 45 : 50, alignItems: "center" };');
      }
    } else if (f === 'Day.js') {
      if (!s.includes('isOccupied = _a.isOccupied')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, style = _a.style;', 'disabledAfterToday = _a.disabledAfterToday, isOccupied = _a.isOccupied, style = _a.style;');
        s = s.replace('(disabledAfterToday && isAfterToday)\n            ? disabledTextColor', '(disabledAfterToday && isAfterToday) ||\n            (isOccupied && isBeforeToday)\n            ? disabledTextColor');
      }
      if (!s.includes('prevProps.isOccupied')) {
        s = s.replace('if (prevProps.day.type === nextProps.day.type)\n        return true;\n    return false;', 'if (prevProps.day.type !== nextProps.day.type) return false;\n    if (prevProps.isOccupied !== nextProps.isOccupied) return false;\n    return true;');
      }
      if (s.includes('isOccupied') && !s.includes("pointerEvents={isOccupied ? 'none'")) {
        s = s.replace("type === 'end' ? <View style={[betweenStyle, { left: -1 }]}/>", "type === 'end' ? <View pointerEvents={isOccupied ? 'none' : 'auto'} style={[betweenStyle, { left: -1 }]}/>");
        s = s.replace("type === 'start' ? <View style={[betweenStyle, { right: -1 }]}/>", "type === 'start' ? <View pointerEvents={isOccupied ? 'none' : 'auto'} style={[betweenStyle, { right: -1 }]}/>");
        s = s.replace('{date ? (<View style={markStyle}>', "{date ? (<View pointerEvents={isOccupied ? 'none' : 'auto'} style={markStyle}>");
        s = s.replace('<Text style={[{ fontSize: 15 }, dayStyle,', "<Text pointerEvents={isOccupied ? 'none' : 'auto'} style={[{ fontSize: 15 }, dayStyle,");
      }
      if (!s.includes("borderColor: '#E85D4C'") && s.includes('default:\n            break;')) {
        s = s.replace("default:\n            break;", "default:\n            if (isToday) {\n                markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: todayColor, borderRadius: 4 });\n            }\n            if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n            }\n            break;");
      }
      if (!s.includes("backgroundColor: '#FFF0F0'") && s.includes("borderColor: '#E85D4C'")) {
        s = s.replace("if (isToday) {\n                markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: '#E85D4C', borderRadius: 4 });\n            }\n            break;", "if (isToday) {\n                markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: todayColor, borderRadius: 4 });\n            }\n            if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n            }\n            break;");
      }
      if (!s.includes('isCheckIn') && s.includes('isOccupied = _a.isOccupied')) {
        s = s.replace('isOccupied = _a.isOccupied, style = _a.style;', 'isOccupied = _a.isOccupied, isCheckIn = _a.isCheckIn, isCheckOut = _a.isCheckOut, style = _a.style;');
        s = s.replace('if (prevProps.isOccupied !== nextProps.isOccupied) return false;\n    return true;', 'if (prevProps.isOccupied !== nextProps.isOccupied) return false;\n    if (prevProps.isCheckIn !== nextProps.isCheckIn) return false;\n    if (prevProps.isCheckOut !== nextProps.isCheckOut) return false;\n    if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    return true;');
      }
      if (!s.includes('dimPastDates = _a.dimPastDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, isOccupied = _a.isOccupied', 'disabledAfterToday = _a.disabledAfterToday, dimPastDates = _a.dimPastDates, isOccupied = _a.isOccupied');
        s = s.replace('(disabledBeforeToday && isBeforeToday) ||', '(disabledBeforeToday && isBeforeToday) ||\n            (dimPastDates && isBeforeToday) ||');
      }
      if (!s.includes('eventCountsByDate = _a.eventCountsByDate')) {
        s = s.replace('style = _a.style;', 'style = _a.style, eventCountsByDate = _a.eventCountsByDate;');
        s = s.replace('if (prevProps.isCheckOut !== nextProps.isCheckOut) return false;', 'if (prevProps.isCheckOut !== nextProps.isCheckOut) return false;\n    if (((prevProps.eventCountsByDate || {})[prevProps.day.date] || 0) !== ((nextProps.eventCountsByDate || {})[nextProps.day.date] || 0)) return false;');
        s = s.replace('<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}>\n            {dayjs(date).date()}\n          </Text>', '<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}>{dayjs(date).date()}</Text>\n          {((eventCountsByDate || {})[date] || 0) > 0 ? (<View style={{ flexDirection: \'row\', marginTop: 1, justifyContent: \'center\', flexWrap: \'wrap\' }}>{Array.from({ length: Math.min(((eventCountsByDate || {})[date] || 0), 5) }).map(function (_, i) { return <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: \'#1d1c1d\', marginHorizontal: 0.5 }}/>; })}</View>) : null}');
      }
      if (!s.includes("borderColor: '#2E7D32'") && s.includes("backgroundColor: '#FFF0F0'")) {
        s = s.replace("if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n            }", "if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n                if (!isToday && isCheckIn) {\n                    markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: '#2E7D32' });\n                } else if (!isToday && isCheckOut) {\n                    markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: '#E85D4C' });\n                }\n            }");
      }
      if (s.includes('{locale.today}')) {
        s = s.replace(/\s*\{isToday \? \(<Text[^>]*>[\s\S]*?\{locale\.today\}[\s\S]*?<\/Text>\) : null\}/, '');
      }
    }
    fs.writeFileSync(p, s);
  });
}

patchData();
patchLocale();
patchMonth();
patchDisabledDates();
