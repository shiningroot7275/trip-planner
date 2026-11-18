
/* ===== 처음 여는 사람에게 보여 줄 홍콩 여행 ===== */
const SEED_TRIP = {
  id: 'hk-2027-01', name: '홍콩 여행', start: '2027-01-21', end: '2027-01-24', tz: 8, homeTz: 9,
  center: [22.2905, 114.1640], zoom: 13, places: SEED_PLACES, schedule: [],
  flights: [
    { id: 'f-out', label: '가는 편', from: { code: 'ICN', name: '인천', tz: 9 }, to: { code: 'HKG', name: '홍콩', tz: 8 }, depDate: '2027-01-21' },
    { id: 'f-in', label: '오는 편', from: { code: 'HKG', name: '홍콩', tz: 8 }, to: { code: 'ICN', name: '인천', tz: 9 }, depDate: '2027-01-24' },
  ],
  checklist: ['여권 (유효기간 확인)', '항공권 e-티켓', '숙소 예약 확인서', '옥토퍼스 카드 (교통카드)', '홍콩달러 현금, 해외결제 카드',
    '멀티어댑터 (홍콩은 영국식 G형)', '데이터 로밍 또는 eSIM', '여행자 보험', '보조배터리'].map((text, i) => ({ id: 'c' + i, text, done: false })),
};

const LS_KEY = 'tripPlanner.v1', RT_KEY = 'tripPlanner.routes.v1';
let S = (function load() {
  const raw = lsGet(LS_KEY);
  if (raw && raw.trips && typeof raw.trips === 'object') {
    const trips = {};
    for (const k of Object.keys(raw.trips)) { try { const t = normTrip(raw.trips[k]); trips[t.id] = t; } catch (e) { /* 깨진 여행은 건너뛴다 */ } }
    if (Object.keys(trips).length) return { activeId: trips[raw.activeId] ? raw.activeId : Object.keys(trips)[0], trips, ui: raw.ui && typeof raw.ui === 'object' ? raw.ui : {} };
  }
  const t = normTrip(SEED_TRIP);
  return { activeId: t.id, trips: { [t.id]: t }, ui: {} };
})();
const T = () => S.trips[S.activeId];
const UI = { tab: S.ui.tab || 'map', filter: 'all', planDay: null, planAll: false, mapDay: null, sheet: null, pick: null, me: null, trayOpen: S.ui.trayOpen !== false, ttInit: false };
let saveWarned = false;
function save() {
  S.ui = { tab: UI.tab, trayOpen: UI.trayOpen, theme: S.ui.theme || 'auto' };
  if (!lsSet(LS_KEY, S) && !saveWarned) { saveWarned = true; toast('이 브라우저에 저장하지 못했습니다. 공유 링크나 백업 파일로 보관해 주세요.'); }
}
function commit() { T().updatedAt = Date.now(); save(); renderAll(); }
const snapshot = () => JSON.stringify(T());
function restore(snap) { const t = normTrip(JSON.parse(snap)); S.trips[t.id] = t; S.activeId = t.id; save(); renderAll(); renderFlights(); }

/* ===== 여행 날짜·시각 ===== */
function tripDays(t = T()) { const a = dayNum(t.start), b = dayNum(t.end), out = []; for (let i = a; i <= b && out.length < 60; i++) out.push(fromDayNum(i)); return out; }
function tripNow(t = T()) { const d = new Date(Date.now() + t.tz * 3600000); return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
function placeById(id) {
  if (id === '__me') return UI.me ? { id: '__me', name: '내 위치', cat: 'etc', lat: UI.me.lat, lng: UI.me.lng, me: true } : null;
  return T().places.find(p => p.id === id) || null;
}
const airportPlace = code => code ? T().places.find(p => p.code && p.code === code.toUpperCase()) || null : null;

/* 항공편: 각 공항의 현지 시각을 세계 표준시(분)로 바꾼다 */
function flightSpan(f) {
  if (!f.depDate || !f.depTime) return null;
  const base = d => parseDate(d) / 60000;
  const dep = base(f.depDate) + toMin(f.depTime) - f.from.tz * 60;
  let arr = null, nextDay = 0;
  if (f.arrTime) {
    arr = base(f.arrDate || f.depDate) + toMin(f.arrTime) - f.to.tz * 60;
    if (!f.arrDate) while (arr <= dep && nextDay < 2) { arr += 1440; nextDay++; }
  }
  return { dep, arr, dur: arr == null ? null : arr - dep, nextDay };
}
function flightSegment(f, date) {
  const sp = flightSpan(f); if (!sp) return null;
  const off = T().tz * 60, d0 = dayNum(date) * 1440;
  const L1 = sp.dep + off, L2 = (sp.arr ?? sp.dep + 60) + off;
  const s = Math.max(L1, d0), e = Math.min(L2, d0 + 1440);
  if (e <= s) return null;
  return { kind: 'flight', id: 'f-' + f.id, f, start: s - d0, end: e - d0, startsHere: L1 >= d0, endsHere: L2 <= d0 + 1440, noArr: sp.arr == null, before: airportPlace(f.from.code), after: airportPlace(f.to.code), place: null };
}
function dayItems(date) {
  const t = T();
  const items = t.schedule.filter(s => s.date === date).map(s => { const p = placeById(s.placeId); return { kind: 'sched', id: s.id, s, place: p, before: p, after: p, start: toMin(s.start), end: toMin(s.end) }; });
  for (const f of t.flights) { const seg = flightSegment(f, date); if (seg) items.push(seg); }
  return items.sort((a, b) => a.start - b.start || a.end - b.end);
}
const itemName = it => it.kind === 'flight' ? ([it.f.airline, it.f.no].filter(Boolean).join(' ') || it.f.label || '항공편') : (it.place ? it.place.name : '');

/* ===== 이동시간 ===== */
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const OSRM = { foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/', car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/' };
const RT = lsGet(RT_KEY) || {};
const rtFailed = {};
const rtPending = new Set();
let rtQueue = [], rtBusy = false;
const rkey = (a, b, mode) => `${mode}:${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
function requestRoute(a, b, mode, urgent) {
  const k = rkey(a, b, mode);
  if (RT[k] || rtFailed[k] || navigator.onLine === false) return;
  if (rtPending.has(k)) { if (urgent) { const i = rtQueue.findIndex(j => j.k === k); if (i > 0) rtQueue.unshift(rtQueue.splice(i, 1)[0]); } return; }
  rtPending.add(k);
  const job = { k, a: { lat: a.lat, lng: a.lng }, b: { lat: b.lat, lng: b.lng }, mode };
  urgent ? rtQueue.unshift(job) : rtQueue.push(job);
  pumpRoutes();
}
function ensureRoutes(a, b, urgent) { if (!a || !b || dist(a, b) < 40) return; requestRoute(a, b, 'foot', urgent); requestRoute(a, b, 'car', urgent); }
/* 공개 경로 서버 이용 규칙에 맞춰 한 번에 하나씩, 1초 넘게 간격을 두고 보낸다 */
async function pumpRoutes() {
  if (rtBusy) return;
  const job = rtQueue.shift(); if (!job) return;
  rtBusy = true;
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`${OSRM[job.mode]}${job.a.lng},${job.a.lat};${job.b.lng},${job.b.lat}?overview=simplified&geometries=geojson`, { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await r.json();
    if (j.code === 'Ok' && j.routes && j.routes[0]) {
      const x = j.routes[0];
      RT[job.k] = { d: x.distance, t: x.duration, g: x.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)]), at: Date.now() };
    } else RT[job.k] = { err: j.code || 'NoRoute', at: Date.now() };
    const keys = Object.keys(RT); if (keys.length > 250) keys.sort((x, y) => RT[x].at - RT[y].at).slice(0, keys.length - 250).forEach(k => delete RT[k]);
    lsSet(RT_KEY, RT);
  } catch (e) { rtFailed[job.k] = Date.now(); }
  rtPending.delete(job.k); rtBusy = false;
  onRoutesUpdated();
  setTimeout(pumpRoutes, 1100);
}
/* 도보·차량은 경로 서버 값, 없으면 직선거리로 낸 추정치. 대중교통은 늘 추정치 */
function travel(a, b) {
  const sk = dist(a, b) / 1000, res = { straightKm: sk };
  for (const mode of ['foot', 'car']) {
    const k = rkey(a, b, mode), c = RT[k];
    if (c && !c.err) res[mode] = { min: c.t / 60, km: c.d / 1000, src: 'osrm', geom: c.g };
    else {
      const km = sk * (mode === 'foot' ? 1.3 : 1.4);
      res[mode] = { min: mode === 'foot' ? km / 4.8 * 60 : km / 25 * 60 + 3, km, src: 'est', loading: !c && !rtFailed[k] && rtPending.has(k), noRoute: !!(c && c.err) };
    }
  }
  /* 배·보행로로 질러가는 도보 경로가 차량 경로보다 짧을 수 있어 둘 중 짧은 거리를 쓴다 */
  const dk = Math.min(res.car.km, res.foot.noRoute ? Infinity : res.foot.km), v = Math.min(40, 18 + dk);
  res.transit = { min: 10 + dk / v * 60, km: dk, src: 'est' };
  return res;
}
function recMode(tr) { return tr.foot.min <= 15 && !tr.foot.noRoute ? { mode: 'foot', min: tr.foot.min, est: tr.foot.src !== 'osrm' } : { mode: 'transit', min: tr.transit.min, est: true }; }
const modeLabel = rm => rm.mode === 'foot' ? `도보 ${rm.est ? '약 ' : ''}${fmtDur(ceilMin(rm.min))}${rm.est ? '(추정)' : ''}` : `대중교통 약 ${fmtDur(ceilMin(rm.min))}(추정)`;
let rtRenderTimer;
function onRoutesUpdated() {
  clearTimeout(rtRenderTimer);
  rtRenderTimer = setTimeout(() => {
    if (UI.sheet && UI.sheet.type === 'route') refreshSheet(false);
    if (DND.active) DND.dirty = true; else renderPlan();
    if (!$('#modal').hidden && typeof refreshSchedCheck === 'function') refreshSchedCheck();
  }, 200);
}
