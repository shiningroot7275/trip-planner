'use strict';
/* 빌드할 때 12_build.sh가 날짜·시각(YYYYMMDDHHMM)으로 바꿔 넣는다. 새 버전 확인에 쓴다 */
const APP_BUILD = '__BUILD__';
/* ===== 공용 도구 ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const num = (v, min, max, def) => (v === null || v === '' || v === undefined || !Number.isFinite(+v) || +v < min || +v > max) ? def : +v;
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHM = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v);
const toMin = s => { if (!isHM(s)) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const fmtHM = m => { m = Math.round(m); if (m >= 1440) return '24:00'; m = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const ceilMin = x => Math.max(1, Math.ceil(x));
function fmtDur(min) { const m = Math.round(min); if (m <= 0) return '0분'; if (m < 60) return `${m}분`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}시간 ${r}분` : `${h}시간`; }
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };
const isWide = () => window.matchMedia('(min-width: 960px)').matches;
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ===== 날짜 ===== */
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
function parseDate(d) { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); }
const dayNum = d => Math.round(parseDate(d) / 86400000);
function fromDayNum(n) { const t = new Date(n * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
const weekday = d => new Date(parseDate(d)).getUTCDay();
const md = d => { const [, m, dd] = d.split('-').map(Number); return `${m}/${dd}`; };
const dayLabel = d => `${md(d)}(${WD[weekday(d)]})`;
function localToday() { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; }
function fmtLongDate(d, noYear) { const [y, m, dd] = d.split('-').map(Number); return `${noYear ? '' : y + '년 '}${m}월 ${dd}일(${WD[weekday(d)]})`; }
function fmtStamp(ms) { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function tzLabel(v) { const a = Math.abs(v), h = Math.floor(a), m = Math.round((a - h) * 60); return `UTC${v < 0 ? '−' : '+'}${h}${m ? ':' + pad(m) : ''}`; }
function fmtHours(h) { const a = Math.abs(h), hh = Math.floor(a), mm = Math.round((a - hh) * 60); return hh && mm ? `${hh}시간 ${mm}분` : hh ? `${hh}시간` : `${mm}분`; }

/* ===== 그림 기호 ===== */
const ICONS = {
  sight: '<path d="M3.5 8.5h3.2l1.8-2.6h7l1.8 2.6h3.2v10.6h-17z"/><circle cx="12" cy="13.6" r="3.4"/>',
  food: '<path d="M7 3v7.5M4.5 3v4.8a2.5 2.5 0 0 0 5 0V3M7 10.5V21M16.5 21V3c-2.2.8-3.5 3.6-3.5 7.2V13h3.5"/>',
  cafe: '<path d="M4.5 9.5h12v4.2a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 11h1.6a2.4 2.4 0 0 1 0 4.8h-1.9M8.5 3.5v3M12.5 3.5v3"/>',
  bar: '<path d="M4.5 4.5h15L12 13z"/><path d="M12 13v7M8 20.5h8M7.2 7.7h9.6"/>',
  shop: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/>',
  hotel: '<path d="M3 19V6M3 15h18v4M21 15v-3.5A2.5 2.5 0 0 0 18.5 9H11v6"/><circle cx="7" cy="11.2" r="1.9"/>',
  transport: '<rect x="6" y="3" width="12" height="13.5" rx="3"/><path d="M6 10h12M9 13.3h.01M15 13.3h.01M8.5 16.5 6.5 21M15.5 16.5l2 4.5"/>',
  etc: '<circle cx="12" cy="12" r="3.5"/>',
  plane: '<path class="f" d="M21 15.5v-1.8l-7.6-4.8V4.2a1.4 1.4 0 0 0-2.8 0v4.7L3 13.7v1.8l7.6-2.3v4.5l-1.9 1.4V21l3.3-.9 3.3.9v-1.8l-1.9-1.4v-4.5z"/>',
  walk: '<circle cx="13.5" cy="4.2" r="1.9"/><path d="M10.5 21l1.8-5.6 2.7 2.6V21M8.3 12.2l1.4-4.3 3.6.8 2 2.9 2.6.6M9.7 7.9 6.5 10v3.2M12.3 15.4l.9-4.4"/>',
  transit: '<rect x="5.5" y="3" width="13" height="14" rx="3.2"/><path d="M5.5 10.5h13M9 14h.01M15 14h.01M8.6 17l-2.1 4M15.4 17l2.1 4"/>',
  car: '<path d="M5 16.5v-4.8L7 7h10l2 4.7v4.8M3.5 16.5h17v2.5h-17zM6.5 19v2M17.5 19v2M7.5 13.6h.01M16.5 13.6h.01"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  swap: '<path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  share: '<path d="M12 3v12M12 3 8 7M12 3l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  list: '<path d="M4 6.5h2M4 12h2M4 17.5h2M9 6.5h11M9 12h11M9 17.5h11"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.3h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11M12 15l-4-4M12 15l4-4M5 19h14"/>',
  upload: '<path d="M12 15V4M12 4 8 8M12 4l4 4M5 19h14"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ===== 분류 ===== */
const CATS = {
  sight: { label: '명소', color: '#178a6d', icon: 'sight', dur: 90 },
  food: { label: '식당', color: '#d4602a', icon: 'food', dur: 60 },
  cafe: { label: '카페·디저트', color: '#9a6a3e', icon: 'cafe', dur: 45 },
  bar: { label: '바', color: '#7d45a8', icon: 'bar', dur: 90 },
  shop: { label: '쇼핑', color: '#c03a7b', icon: 'shop', dur: 60 },
  hotel: { label: '숙소', color: '#5258c8', icon: 'hotel', dur: 30 },
  transport: { label: '교통', color: '#2c70ad', icon: 'transport', dur: 30 },
  etc: { label: '기타', color: '#68756f', icon: 'etc', dur: 60 },
};
const cat = p => CATS[p && p.cat] || CATS.etc;

/* ===== 자료 정리 (저장본·공유 링크·백업 파일 모두 이 함수를 거친다) ===== */
function normHours(h) {
  if (!Array.isArray(h) || h.length !== 7) return null;
  return h.map(d => Array.isArray(d) ? d.filter(r => Array.isArray(r) && isHM(r[0]) && isHM(r[1])).map(r => [r[0], r[1]]) : null);
}
function normPlace(p) {
  if (!p || typeof p !== 'object') return null;
  const lat = +p.lat, lng = +p.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const c = CATS[p.cat] ? p.cat : 'etc';
  return {
    id: str(p.id, 40) || uid(), name: str(p.name, 80) || '이름 없는 장소', nameLocal: str(p.nameLocal, 120), cat: c,
    code: str(p.code, 4).toUpperCase(), lat, lng, addr: str(p.addr, 200), hours: normHours(p.hours),
    exc: (Array.isArray(p.exc) ? p.exc : []).filter(e => e && isDate(e.date)).map(e => ({ date: e.date, hours: Array.isArray(e.hours) ? e.hours.filter(r => Array.isArray(r) && isHM(r[0]) && isHM(r[1])) : [], note: str(e.note, 200) })),
    hoursNote: str(p.hoursNote, 600), verify: ['official', 'other'].includes(p.verify) ? p.verify : 'none',
    source: str(p.source, 300), checked: isDate(p.checked) ? p.checked : '', fee: str(p.fee, 300), url: str(p.url, 300),
    memo: str(p.memo, 1000), dur: num(p.dur, 15, 720, CATS[c].dur), sample: !!p.sample,
  };
}
function normFlight(f) {
  if (!f || typeof f !== 'object') return null;
  const ep = e => ({ code: str(e && e.code, 4).toUpperCase(), name: str(e && e.name, 40), tz: num(e && e.tz, -12, 14, 9), term: str(e && e.term, 20) });
  return {
    id: str(f.id, 40) || uid(), label: str(f.label, 20), airline: str(f.airline, 40), no: str(f.no, 12),
    from: ep(f.from), to: ep(f.to), depDate: isDate(f.depDate) ? f.depDate : '', depTime: isHM(f.depTime) ? f.depTime : '',
    arrDate: isDate(f.arrDate) ? f.arrDate : '', arrTime: isHM(f.arrTime) ? f.arrTime : '', memo: str(f.memo, 300),
  };
}
function normTrip(t) {
  if (!t || typeof t !== 'object') throw new Error('bad trip');
  const o = {};
  o.id = str(t.id, 40) || uid();
  o.name = str(t.name, 60) || '새 여행';
  o.start = isDate(t.start) ? t.start : localToday();
  o.end = isDate(t.end) && dayNum(t.end) >= dayNum(o.start) ? t.end : o.start;
  if (dayNum(o.end) - dayNum(o.start) > 59) o.end = fromDayNum(dayNum(o.start) + 59);
  o.tz = num(t.tz, -12, 14, 9);
  o.homeTz = num(t.homeTz, -12, 14, 9);
  o.center = Array.isArray(t.center) && t.center.length === 2 ? [num(t.center[0], -90, 90, 37.5665), num(t.center[1], -180, 180, 126.978)] : [37.5665, 126.978];
  o.zoom = num(t.zoom, 2, 19, 12);
  o.places = (Array.isArray(t.places) ? t.places : []).map(normPlace).filter(Boolean);
  const ids = new Set(o.places.map(p => p.id));
  o.schedule = (Array.isArray(t.schedule) ? t.schedule : []).map(s => (s && ids.has(s.placeId) && isDate(s.date) && isHM(s.start) && isHM(s.end))
    ? { id: str(s.id, 40) || uid(), placeId: s.placeId, date: s.date, start: s.start, end: s.end, memo: str(s.memo, 500), sample: !!s.sample } : null).filter(Boolean);
  o.flights = (Array.isArray(t.flights) ? t.flights : []).map(normFlight).filter(Boolean);
  o.checklist = (Array.isArray(t.checklist) ? t.checklist : []).map(c => c ? { id: str(c.id, 40) || uid(), text: str(c.text, 100), done: !!c.done } : null).filter(Boolean);
  o.seedVer = Math.floor(num(t.seedVer, 1, 99, 1)); /* 이 여행에 넣어 준 예시 장소 묶음의 차례 (05_state.js의 addNewSeedPlaces) */
  o.updatedAt = Number(t.updatedAt) || 0;
  return o;
}

/* ===== 운영시간 ===== */
function hoursText(v) {
  if (v == null) return '';
  if (!v.length) return '휴무';
  if (v.length === 1 && v[0][0] === '00:00' && v[0][1] === '24:00') return '24시간';
  return v.map(([o, c]) => `${o}-${c}`).join(', ');
}
function fmtRanges(v) {
  if (v == null) return '';
  if (!v.length) return '휴무';
  if (v.length === 1 && v[0][0] === '00:00' && v[0][1] === '24:00') return '24시간';
  return v.map(([o, c]) => `${o}–${c}`).join(', ');
}
function parseHoursText(txt) {
  txt = (txt || '').trim();
  if (!txt) return { ok: true, v: null };
  if (/^(휴무|휴일|closed|off|-)$/i.test(txt)) return { ok: true, v: [] };
  if (/^(24시간|24h|24\/7)$/i.test(txt)) return { ok: true, v: [['00:00', '24:00']] };
  const out = [];
  for (const part of txt.split(/[,，]/)) {
    const m = part.trim().match(/^(\d{1,2}):?(\d{2})\s*[-~–—]\s*(\d{1,2}):?(\d{2})$/);
    if (!m) return { ok: false };
    const o = `${pad(+m[1])}:${m[2]}`, c = `${pad(+m[3])}:${m[4]}`;
    if (!isHM(o) || !isHM(c)) return { ok: false };
    out.push([o, c]);
  }
  return { ok: true, v: out };
}
/* 시작·끝을 분으로 바꾸고, 자정을 넘기는 구간은 끝에 24시간을 더하고, 붙어 있는 구간은 하나로 합친다 */
function rangesMin(v) {
  const r = v.map(([o, c]) => { const a = toMin(o); let b = toMin(c); if (b <= a) b += 1440; return [a, b]; }).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const x of r) { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push([x[0], x[1]]); }
  return out;
}
function hoursOn(p, date) {
  const e = (p.exc || []).find(x => x.date === date);
  if (e) return { v: e.hours, note: e.note, exc: true };
  return { v: p.hours ? p.hours[weekday(date)] : null, exc: false };
}
function hoursCheck(p, date, s, e) {
  if (!p) return { state: 'unknown' };
  const today = hoursOn(p, date);
  if (today.v == null) return { state: 'unknown' };
  const ranges = rangesMin(today.v);
  const prev = hoursOn(p, fromDayNum(dayNum(date) - 1)).v;
  if (prev) rangesMin(prev).forEach(([, b]) => { if (b > 1440) ranges.unshift([0, b - 1440]); });
  const text = fmtRanges(today.v) + (today.exc ? ` (${today.note || '특별 운영'})` : '');
  if (!today.v.length && !ranges.length) return { state: 'closed', text };
  const merged = rangesMin(ranges.map(([a, b]) => [fmtHM(a), fmtHM(Math.min(b, 1440))]));
  const ok = merged.some(([a, b]) => s >= a && e <= b) || ranges.some(([a, b]) => s >= a && e <= b);
  return { state: ok ? 'open' : 'outside', text };
}
