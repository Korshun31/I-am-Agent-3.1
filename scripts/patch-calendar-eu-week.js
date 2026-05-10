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
      if (s.includes('eventCountsByDate') && !s.includes('extraData={eventCountsByDate}')) {
        s = s.replace('initialNumToRender={initialNumToRender} {...flatListProps}', 'initialNumToRender={initialNumToRender} {...flatListProps} extraData={eventCountsByDate}');
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
      if (!s.includes('dimPastDates = _a.dimPastDates')) {
        s = s.replace('disabledAfterToday = _a.disabledAfterToday, disabledDates = _a.disabledDates', 'disabledAfterToday = _a.disabledAfterToday, dimPastDates = _a.dimPastDates, disabledDates = _a.disabledDates');
      }
      if (!s.includes('dimPastDates={dimPastDates} disabledDates={disabledDates}') && s.includes('disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} occupiedCheckInDates=')) {
        s = s.replace('disabledAfterToday={disabledAfterToday} disabledDates={disabledDates} occupiedCheckInDates=', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} disabledDates={disabledDates} occupiedCheckInDates=');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate, style = _a.style;');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates} style={style}/>', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}} style={style}/>');
        s = s.replace('occupiedCheckOutDates={occupiedCheckOutDates} style={style}', 'occupiedCheckOutDates={occupiedCheckOutDates} eventCountsByDate={eventCountsByDate || {}} style={style}');
      }
      if (s.includes('eventCountsByDate') && !s.includes('prevProps.eventCountsByDate !== nextProps.eventCountsByDate')) {
        s = s.replace('if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    return true;', 'if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    if (prevProps.eventCountsByDate !== nextProps.eventCountsByDate) return false;\n    return true;');
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
      if (!s.includes('dimPastDates = _a.dimPastDates')) {
        s = s.replace('disabledDates = _a.disabledDates, occupiedCheckInDates = _a.occupiedCheckInDates', 'disabledDates = _a.disabledDates, dimPastDates = _a.dimPastDates, occupiedCheckInDates = _a.occupiedCheckInDates');
      }
      if (!s.includes('dimPastDates={dimPastDates}') && s.includes('isOccupied={isOccupied}')) {
        s = s.replace('disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} isOccupied={isOccupied}', 'disabledBeforeToday={disabledBeforeToday} disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied}');
      }
      if (s.includes('dimPastDates = _a.dimPastDates') && !s.includes('dimPastDates={dimPastDates} isOccupied')) {
        s = s.replace('disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} isCheckIn=', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied} isCheckIn=');
        s = s.replace('disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied} style={style}/>');
      }
      if (s.includes('<Day day={day}') && s.includes('disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>') && !s.includes('disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied} style={style}/>')) {
        s = s.replace('disabledAfterToday={disabledAfterToday} isOccupied={isOccupied} style={style}/>', 'disabledAfterToday={disabledAfterToday} dimPastDates={dimPastDates} isOccupied={isOccupied} style={style}/>');
      }
      if (!s.includes('eventCountsByDate')) {
        s = s.replace('occupiedCheckOutDates = _a.occupiedCheckOutDates, style = _a.style;', 'occupiedCheckOutDates = _a.occupiedCheckOutDates, eventCountsByDate = _a.eventCountsByDate, style = _a.style;');
        s = s.replace(/<Day day=\{day\} locale=\{locale\}/g, '<Day day={day} locale={locale} eventCountsByDate={eventCountsByDate || {}}');
      }
      if (s.includes('eventCountsByDate') && !s.includes('prevProps.eventCountsByDate !== nextProps.eventCountsByDate')) {
        s = s.replace('if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    return true;\n}\nexport default memo(Week', 'if (prevProps.dimPastDates !== nextProps.dimPastDates) return false;\n    if (prevProps.eventCountsByDate !== nextProps.eventCountsByDate) return false;\n    return true;\n}\nexport default memo(Week');
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
        s = s.replace('<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}>\n            {dayjs(date).date()}\n          </Text>', '<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}>{dayjs(date).date()}</Text>\n          {((eventCountsByDate || {})[date] || 0) > 0 ? (<View pointerEvents="none" style={{ position: \'absolute\', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: \'#E85D4C\', justifyContent: \'center\', alignItems: \'center\', paddingHorizontal: 3 }}><Text style={{ fontSize: 9, fontWeight: \'700\', color: \'#fff\' }}>{((eventCountsByDate || {})[date] || 0) > 9 ? \'9+\' : String((eventCountsByDate || {})[date] || 0)}</Text></View>) : null}');
        s = s.replace('{date ? (<View pointerEvents={isOccupied ? \'none\' : \'auto\'} style={markStyle}>', '{date ? (<View pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[markStyle, { position: \'relative\' }]}>');
        s = s.replace('flexDirection: \'row\', marginTop: 1, justifyContent: \'center\', flexWrap: \'wrap\' }}>{Array.from({ length: Math.min(((eventCountsByDate || {})[date] || 0), 5) }).map(function (_, i) { return <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: \'#1d1c1d\', marginHorizontal: 0.5 }}/>; })}</View>', 'pointerEvents="none" style={{ position: \'absolute\', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: \'#E85D4C\', justifyContent: \'center\', alignItems: \'center\', paddingHorizontal: 3 }}><Text style={{ fontSize: 9, fontWeight: \'700\', color: \'#fff\' }}>{((eventCountsByDate || {})[date] || 0) > 9 ? \'9+\' : String((eventCountsByDate || {})[date] || 0)}</Text></View>');
        s = s.replace('marginTop: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: \'#E85D4C\'', 'position: \'absolute\', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: \'#E85D4C\'');
      }
      if (!s.includes("borderColor: '#2E7D32'") && s.includes("backgroundColor: '#FFF0F0'")) {
        s = s.replace("if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n            }", "if (isOccupied) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: '#FFF0F0', borderRadius: 4 });\n                if (!isToday && isCheckIn) {\n                    markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: '#2E7D32' });\n                } else if (!isToday && isCheckOut) {\n                    markStyle = __assign(__assign({}, markStyle), { borderWidth: 2, borderColor: '#E85D4C' });\n                }\n            }");
      }
      if (s.includes("backgroundColor: '#E85D4C', justifyContent: 'center'") && !s.includes("isBeforeToday ? '#9E9E9E'")) {
        s = s.replace("backgroundColor: '#E85D4C', justifyContent: 'center'", "backgroundColor: (isBeforeToday ? '#9E9E9E' : '#E85D4C'), justifyContent: 'center'");
      }
      if (s.includes('dimPastDates && isBeforeToday') && s.includes('markStyle = __assign')) {
        s = s.replace('            if (dimPastDates && isBeforeToday) {\n                markStyle = __assign(__assign({}, markStyle), { backgroundColor: \'#E8E8E8\', borderRadius: 4 });\n            }\n            ', '            ');
        s = s.replace('            if (dimPastDates && isBeforeToday) {\n                markStyle = __assign(__assign({}, markStyle), { opacity: 0.75 });\n            }\n            ', '            ');
      }
      if (s.includes('dayStyle, style === null') && !s.includes('dimPastDates && isBeforeToday ? [')) {
        s = s.replace('<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}', '<Text pointerEvents={isOccupied ? \'none\' : \'auto\'} style={dimPastDates && isBeforeToday ? [{ fontSize: 15, color: (style && style.dayNameText && style.dayNameText.color) || (style === null || style === void 0 ? void 0 : style.disabledTextColor) || \'#bababe\' }] : [{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}');
        s = s.replace('style={[{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText, (dimPastDates && isBeforeToday) ? { color: (style === null || style === void 0 ? void 0 : style.disabledTextColor) || \'#bababe\' } : null]}', 'style={dimPastDates && isBeforeToday ? [{ fontSize: 15, color: (style && style.dayNameText && style.dayNameText.color) || (style === null || style === void 0 ? void 0 : style.disabledTextColor) || \'#bababe\' }] : [{ fontSize: 15 }, dayStyle, style === null || style === void 0 ? void 0 : style.dayText]}');
      }
      if (s.includes('{locale.today}')) {
        s = s.replace(/\s*\{isToday \? \(<Text[^>]*>[\s\S]*?\{locale\.today\}[\s\S]*?<\/Text>\) : null\}/, '');
      }
    }
    fs.writeFileSync(p, s);
  });
}

/**
 * Scale Agent Calendar month blocks by 10% (Month, Week, Day, CalendarList).
 * Run after patchDisabledDates.
 */
function patchCalendarScale10() {
  const root = path.join(__dirname, '..', 'node_modules', 'react-native-calendar-range-picker', 'dist');
  const files = ['Month.js', 'Week.js', 'Day.js', 'CalendarList.js'];
  files.forEach((f) => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) return;
    let s = fs.readFileSync(p, 'utf8');

    // 1) Ensure Dimensions is in the react-native import (idempotent).
    s = s.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]react-native['"];/, function (m, names) {
      if (/\bDimensions\b/.test(names)) return m;
      return 'import { ' + names.trim() + ', Dimensions } from \'react-native\';';
    });

    // 2) Insert/refresh __scale module-level (height-driven, with floor so SE doesn't go too small).
    s = s.replace(/\nvar __scale = [^\n]*\n/, '\n');
    s = s.replace(
      /(from ['"]react-native['"];)/,
      '$1\nvar __scale = Math.max(0.78, Math.min(1, (((typeof Dimensions !== \'undefined\' && Dimensions.get(\'window\').width) || 440) - 72) * 0.8 / 350));'
    );

    if (f === 'Month.js') {
      // Header "Май 2026" font
      s = s.replace(/monthName:\s*\{\s*fontSize:\s*\d+,/, 'monthName: {\n        fontSize: Math.round(16*__scale),');
      // Day-of-week labels ("Пн Вт Ср") font
      s = s.replace(/dayName:\s*\{\s*fontSize:\s*\d+,/, 'dayName: {\n        fontSize: Math.round(15*__scale),');
      // Day-of-week container height
      s = s.replace(/dayNamesContainer:\s*\{\s*height:\s*\d+,/, 'dayNamesContainer: {\n        height: Math.round(50*__scale),');
    } else if (f === 'Week.js') {
      // Row height for 6-row vs 5-row months
      s = s.replace(/is6Weeks \? \d+ : \d+/g, 'is6Weeks ? Math.round(45*__scale) : Math.round(50*__scale)');
    } else if (f === 'Day.js') {
      // Day cell (markStyle): width / height
      s = s.replace(/width:\s*\d+,\s*height:\s*\d+,/, 'width: Math.round(30*__scale),\n        height: Math.round(30*__scale),');
      // borderRadius for the day-circle (15 or already-patched 17). Followed by , or whitespace+}
      s = s.replace(/borderRadius:\s*1[57]\b/g, 'borderRadius: Math.round(15*__scale)');
      // Day number font size: matches both ", [{ fontSize: 15 }, dayStyle" (else-branch) and main "[{ fontSize: 15 }, dayStyle"
      s = s.replace(/\[\{ fontSize: \d+ \}, dayStyle/g, '[{ fontSize: Math.round(15*__scale) }, dayStyle');
      // Day number font size in dim-past branch
      s = s.replace(/\? \[\{ fontSize: \d+, color:/g, '? [{ fontSize: Math.round(15*__scale), color:');
    } else if (f === 'CalendarList.js') {
      // Total month block height (drives snap and FlatList layout)
      s = s.replace(/var LAYOUT_HEIGHT = \d+;/, 'var LAYOUT_HEIGHT = Math.round(370*__scale);');
    }
    fs.writeFileSync(p, s);
  });
}

patchData();
patchLocale();
patchMonth();
patchDisabledDates();
patchCalendarScale10();
