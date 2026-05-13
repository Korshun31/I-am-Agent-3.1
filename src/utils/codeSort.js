// Естественная сортировка кодов объектов (natural sort).
// Строка режется на сегменты: подряд идущие цифры → число, подряд идущие
// нецифры → строка. Сегменты сравниваются попарно: числа по величине,
// буквы по localeCompare. Цифровой сегмент всегда раньше буквенного.
// Примеры порядка: BPT001, BPT002, BPT010, BPT100, BT001.
// Внутри одного code сравниваем по code_suffix тем же способом.

function tokenize(s) {
  const str = String(s ?? '').trim();
  if (!str) return [];
  const tokens = [];
  const re = /(\d+)|([^\d]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m[1] != null) tokens.push(Number(m[1]));
    else tokens.push(m[2]);
  }
  return tokens;
}

export function compareCode(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const n = Math.max(ta.length, tb.length);
  for (let i = 0; i < n; i++) {
    const sa = ta[i];
    const sb = tb[i];
    if (sa === undefined) return -1;
    if (sb === undefined) return 1;
    const aIsNum = typeof sa === 'number';
    const bIsNum = typeof sb === 'number';
    if (aIsNum && bIsNum) {
      if (sa !== sb) return sa - sb;
    } else if (aIsNum) {
      return -1;
    } else if (bIsNum) {
      return 1;
    } else {
      const c = sa.localeCompare(sb);
      if (c !== 0) return c;
    }
  }
  return 0;
}

// Сравнивает два объекта по полям code и code_suffix.
// Если основной код равен — переходит к суффиксу.
export function compareByCode(a, b) {
  const c = compareCode(a?.code, b?.code);
  if (c !== 0) return c;
  return compareCode(a?.code_suffix, b?.code_suffix);
}
