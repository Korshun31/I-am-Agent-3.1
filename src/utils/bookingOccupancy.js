import dayjs from 'dayjs';

// Общая логика расчёта занятости для booking-пикеров (веб + мобайл).
// Правило: бронь [checkIn, checkOut] значит «гость живёт ночи checkIn..checkOut-1».
// День checkOut — это утро выезда, в этот же день можно заехать новому гостю.
// (TD-119: до унификации мобайл считал checkOut тоже занятым — это было неверно.)

/**
 * Полностью занятые дни: для каждой брони — все даты от checkIn до checkOut-1
 * (без самого дня выезда). Это дни в которые ни въехать, ни выехать нельзя.
 * @param {Array<{checkIn: string, checkOut: string}>} bookedRanges
 * @returns {Set<string>} даты в формате 'YYYY-MM-DD'
 */
export function buildOccupiedSet(bookedRanges) {
  const set = new Set();
  (bookedRanges || []).forEach(({ checkIn, checkOut }) => {
    if (!checkIn || !checkOut) return;
    let d = dayjs(checkIn);
    const end = dayjs(checkOut);
    while (d.isBefore(end, 'day')) {
      set.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  });
  return set;
}

/**
 * Раскладка для пикера который требует три отдельных списка
 * (например react-native-calendar-range-picker).
 *  - disabledDates: дни середины брони (нельзя ни заехать, ни выехать)
 *  - checkInDates: дни заезда других броней (нельзя поставить чужой заезд)
 *  - checkOutDates: дни выезда других броней (нельзя поставить чужой выезд)
 * @param {Array<{checkIn: string, checkOut: string}>} bookedRanges
 */
export function buildOccupancyArrays(bookedRanges) {
  const disabled = new Set();
  const checkIns = [];
  const checkOuts = [];
  (bookedRanges || []).forEach(({ checkIn, checkOut }) => {
    if (!checkIn || !checkOut) return;
    const start = dayjs(checkIn);
    const end = dayjs(checkOut);
    checkIns.push(start.format('YYYY-MM-DD'));
    checkOuts.push(end.format('YYYY-MM-DD'));
    // Дни СТРОГО между checkIn и checkOut — полностью заняты
    let d = start.add(1, 'day');
    while (d.isBefore(end, 'day')) {
      disabled.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  });
  return {
    disabledDates: Array.from(disabled),
    checkInDates: checkIns,
    checkOutDates: checkOuts,
  };
}

/**
 * Проверка что выбранный диапазон [start, end] не пересекается с уже занятыми днями.
 * Сами границы start/end — НЕ считаются пересечением (это твой въезд/выезд).
 * @returns {boolean} true если пересечение есть
 */
export function hasOccupiedInRange(start, end, bookedRanges) {
  if (!start || !end) return false;
  const occupiedSet = buildOccupiedSet(bookedRanges);
  let d = dayjs(start).add(1, 'day');
  const endDay = dayjs(end);
  while (d.isBefore(endDay, 'day')) {
    if (occupiedSet.has(d.format('YYYY-MM-DD'))) return true;
    d = d.add(1, 'day');
  }
  return false;
}
