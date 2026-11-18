
/* ===== 지도 ===== */
let map = null, tileLayer = null, markerLayer, routeLayer, dayLayer, meLayer, watching = false, firstFix = false, pendingMeRoute = null;
function isDark() { const t = document.documentElement.dataset.theme; if (t === 'dark') return true; if (t === 'light') return false; return matchMedia('(prefers-color-scheme: dark)').matches; }
function initMap() {
  if (typeof L === 'undefined') { $('#mapFail').hidden = false; return; }
  const t = T();
  map = L.map('map', { zoomControl: false, attributionControl: true, tapHold: true, worldCopyJump: true }).setView(t.center, t.zoom);
  map.attributionControl.setPrefix(false);
  setTiles();
  routeLayer = L.layerGroup().addTo(map);
  dayLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  meLayer = L.layerGroup().addTo(map);
  map.on('click', () => { if (UI.pick) return; $('#searchResults').hidden = true; if (UI.sheet) closeSheet(); });
  map.on('contextmenu', e => { if (!UI.pick) addAt(e.latlng); });
  map.on('locationfound', onLocation);
  map.on('locationerror', e => { watching = false; updateLocBtn(); toast(e.code === 1 ? '위치 권한이 꺼져 있습니다. 브라우저 설정에서 위치 사용을 허용해 주세요.' : '현재 위치를 찾지 못했습니다.'); });
}
/* 지도 그림: OpenStreetMap 표준 타일. 어두운 화면에서는 CSS 필터로 밝기를 뒤집는다 */
function setTiles() {
  if (!map) return;
  document.getElementById('map').classList.toggle('dark-tiles', isDark());
  if (tileLayer) return;
  tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 기여자' }).addTo(map);
}
function pinHTML(p, o) {
  const c = cat(p);
  const inner = o.nums ? `<b>${o.nums.join('·')}</b>` : icon(c.icon);
  return `<div class="pin${o.sel ? ' sel' : ''}${o.faded ? ' faded' : ''}${o.nums ? ' num' : ''}" style="--c:${c.color}"><div class="pin-head">${inner}</div></div>`;
}
/* 일차별 동선: 그날 일정 순서대로 장소 번호를 매긴다 */
function dayPath(date) {
  const nums = new Map(), path = [], pts = [];
  let n = 0;
  for (const it of dayItems(date)) {
    const ps = it.kind === 'flight' ? [it.startsHere ? it.before : null, it.endsHere && !it.noArr ? it.after : null] : [it.place];
    for (const p of ps) {
      if (!p) continue;
      n++;
      if (!nums.has(p.id)) nums.set(p.id, []);
      nums.get(p.id).push(n);
      const last = path[path.length - 1];
      if (!last || last[0] !== p.lat || last[1] !== p.lng) path.push([p.lat, p.lng]);
      pts.push(p);
    }
  }
  return { nums, path, pts };
}
function renderMarkers() {
  if (!map) return;
  markerLayer.clearLayers(); dayLayer.clearLayers();
  const t = T(), dp = UI.mapDay ? dayPath(UI.mapDay) : null;
  const selIds = UI.sheet ? [UI.sheet.a, UI.sheet.b] : [];
  if (dp && dp.path.length > 1) L.polyline(dp.path, { className: 'rt-day', weight: 3, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(dayLayer);
  for (const p of t.places) {
    const nums = dp ? dp.nums.get(p.id) : null, sel = selIds.includes(p.id);
    const m = L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: 'pin-wrap', html: pinHTML(p, { nums, sel, faded: dp && !nums && !sel }), iconSize: [34, 44], iconAnchor: [17, 41] }),
      zIndexOffset: sel ? 1000 : nums ? 500 : 0, title: p.name, keyboard: true, riseOnHover: true,
    });
    m.on('click', ev => { L.DomEvent.stopPropagation(ev); onMarkerTap(p.id); });
    markerLayer.addLayer(m);
  }
}
function onMarkerTap(id) {
  if (UI.pick) return;
  $('#searchResults').hidden = true;
  const s = UI.sheet;
  if (s && s.type === 'place' && s.a === id) return closeSheet();
  if (s && s.type === 'route' && s.a === id) return openSheet('place', id);
  if (s && s.a && s.a !== id) return openSheet('route', s.a, id);
  openSheet('place', id);
}
function renderMapDays() {
  const days = tripDays();
  if (UI.mapDay && !days.includes(UI.mapDay)) UI.mapDay = null;
  $('#mapDays').innerHTML = `<button class="dchip ${UI.mapDay ? '' : 'on'}" data-mapday="">전체 장소</button>` +
    days.map((d, i) => `<button class="dchip ${UI.mapDay === d ? 'on' : ''}" data-mapday="${d}">${i + 1}일차 <b>${md(d)}</b>${WD[weekday(d)]}</button>`).join('');
}
function setMapDay(d) {
  UI.mapDay = d || null;
  renderMapDays(); renderMarkers();
  if (d) { const dp = dayPath(d); if (dp.pts.length) revealOnMap(dp.pts); else toast(`${dayLabel(d)} 일정이 아직 없습니다. 일정 탭에서 장소를 시간표에 넣어 주세요.`); }
}
/* 아래 정보 창에 가리지 않는 영역 안으로 지점을 옮긴다 */
function revealOnMap(pts, force) {
  if (!map || !pts.length) return;
  const size = map.getSize(), sh = $('#sheet'), sheetH = sh.hidden ? 0 : sh.offsetHeight, wide = isWide();
  const top = 116, bottom = wide ? 16 : sheetH + 16, left = wide && sheetH ? 432 : 16, right = 64;
  if (pts.length === 1) {
    const ll = L.latLng(pts[0].lat, pts[0].lng), cp = map.latLngToContainerPoint(ll);
    if (!force && cp.x > left && cp.x < size.x - right && cp.y > top && cp.y < size.y - bottom) return;
    const z = Math.max(map.getZoom(), 15), w = map.project(ll, z);
    const cx = left + (size.x - left - right) / 2, cy = top + (size.y - top - bottom) / 2;
    map.setView(map.unproject(w.subtract(L.point(cx - size.x / 2, cy - size.y / 2)), z), z, { animate: true });
  } else {
    map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom], maxZoom: 16, animate: true });
  }
}
function fitAll() {
  const ps = T().places;
  if (!ps.length) return toast('지도에 표시할 장소가 아직 없습니다.');
  revealOnMap(ps.length === 1 ? [ps[0]] : ps, true);
}

/* ===== 정보 창 ===== */
function openSheet(type, a, b) { UI.sheet = { type, a, b: b || null }; refreshSheet(true); }
function closeSheet() {
  UI.sheet = null; $('#sheet').hidden = true; $('#view-map').classList.remove('has-sheet');
  if (routeLayer) routeLayer.clearLayers();
  renderMarkers();
}
function refreshSheet(adjust) {
  const s = UI.sheet; if (!s) return;
  const A = placeById(s.a), B = s.b ? placeById(s.b) : null;
  if (!A || (s.type === 'route' && !B)) return closeSheet();
  const el = $('#sheet');
  el.innerHTML = s.type === 'place' ? placeSheetHTML(A) : routeSheetHTML(A, B);
  el.hidden = false; $('#view-map').classList.add('has-sheet');
  if (adjust) el.scrollTop = 0;
  renderMarkers();
  if (s.type === 'route') drawRoute(A, B, adjust);
  else { if (routeLayer) routeLayer.clearLayers(); if (adjust) revealOnMap([A]); }
}
function hoursTable(p) {
  const days = tripDays(), rows = [];
  for (const wd of WEEK_ORDER) {
    const tripIdx = days.map((d, i) => weekday(d) === wd ? i + 1 : 0).filter(Boolean);
    const v = p.hours ? p.hours[wd] : null;
    rows.push(`<span class="d ${tripIdx.length ? 'trip' : ''}">${WD[wd]}</span><span class="v ${tripIdx.length ? 'trip' : ''} ${v == null ? 'unk' : ''}">${v == null ? '확인 필요' : esc(fmtRanges(v))}</span><span class="td">${tripIdx.map(n => n + '일차').join(' ')}</span>`);
  }
  const exc = (p.exc || []).filter(e => days.includes(e.date)).map(e => `<span class="d trip">${md(e.date)}</span><span class="v trip">${esc(fmtRanges(e.hours))}</span><span class="td">${esc(e.note || '특별 운영')}</span>`);
  return `<div class="hrs">${rows.join('')}${exc.join('')}</div>`;
}
const VERIFY = { official: ['official', 'check', '공식 출처 확인'], other: ['other', 'info', '기타 출처 확인 (다시 확인 권장)'], none: ['none', 'warn', '운영시간 확인 필요'] };
function placeSheetHTML(p) {
  const c = cat(p), t = T(), days = tripDays();
  const v = VERIFY[p.verify] || VERIFY.none;
  const sched = t.schedule.filter(s => s.placeId === p.id).sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start))
    .map(s => `<button class="chip" data-action="edit-sched" data-sid="${s.id}">${days.indexOf(s.date) + 1}일차 ${s.start}–${s.end}</button>`).join('');
  const url = safeUrl(p.url), src = safeUrl(p.source);
  const gq = encodeURIComponent(p.nameLocal || p.name);
  return `<div class="sh-head"><div class="t"><span class="catchip" style="--c:${c.color}">${icon(c.icon)}${c.label}</span>
      <h3>${esc(p.name)}${p.sample ? '<em class="tag">예시</em>' : ''}</h3>${p.nameLocal ? `<p class="loc">${esc(p.nameLocal)}</p>` : ''}</div>
      <button class="icon-btn" data-action="close-sheet" aria-label="닫기">${icon('close')}</button></div>
    <div class="sec"><h4>운영시간 (현지 시각)</h4>${hoursTable(p)}
      ${p.hoursNote ? `<p class="small muted" style="margin-top:6px">${esc(p.hoursNote)}</p>` : ''}
      <span class="verify ${v[0]}">${icon(v[1])}${v[2]}${p.checked ? ` · ${esc(p.checked)}` : ''}</span></div>
    <div class="sec"><dl class="kv">
      ${p.fee ? `<dt>요금</dt><dd>${esc(p.fee)}</dd>` : ''}
      ${p.addr ? `<dt>주소</dt><dd>${esc(p.addr)}</dd>` : ''}
      ${p.memo ? `<dt>메모</dt><dd>${esc(p.memo)}</dd>` : ''}
      ${url ? `<dt>웹사이트</dt><dd><a href="${esc(url)}" target="_blank" rel="noopener">${esc(new URL(url).host)}</a></dd>` : ''}
      ${src ? `<dt>운영시간 출처</dt><dd><a href="${esc(src)}" target="_blank" rel="noopener">${esc(new URL(src).host)}</a></dd>` : ''}
    </dl></div>
    ${sched ? `<div class="sec"><h4>시간표에 있는 일정</h4><div class="durs">${sched}</div></div>` : ''}
    <div class="sh-acts">
      <button class="btn primary" data-action="sched" data-pid="${p.id}">${icon('cal')}시간표에 추가</button>
      <button class="btn" data-action="route-me" data-pid="${p.id}">${icon('locate')}내 위치에서</button>
      <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${gq}" target="_blank" rel="noopener">${icon('ext')}구글 지도</a>
      <button class="btn" data-action="edit" data-pid="${p.id}">${icon('edit')}수정</button>
    </div>
    <p class="hint">${icon('info')}<span>지도에서 다른 장소 표시를 누르면 이 장소에서 그곳까지 도보, 대중교통, 차량 이동시간을 보여 드립니다.</span></p>`;
}
function routeRow(kind, label, ic, r, a, b, rec) {
  const mode = { foot: 'walking', transit: 'transit', car: 'driving' }[kind];
  let main, sub;
  if (kind === 'transit') { main = `약 ${fmtDur(ceilMin(r.min))}<small class="est">추정</small>`; sub = `경로거리 ${r.km.toFixed(1)}km 기준 계산`; }
  else if (r.noRoute) { main = '경로 없음'; sub = '도로망에서 이어지는 경로를 찾지 못했습니다'; }
  else if (r.src === 'osrm') { main = fmtDur(ceilMin(r.min)); sub = `${r.km.toFixed(1)}km · 도로망 계산${kind === 'car' ? ', 교통 혼잡 미반영' : ''}`; }
  else { main = `약 ${fmtDur(ceilMin(r.min))}<small class="est">추정</small>`; sub = r.loading ? '도로망 계산 중입니다' : '직선거리 기반 추정 (경로 서버 연결 실패)'; }
  const gm = `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${mode}`;
  return `<div class="rt-row ${rec ? 'rec' : ''}"><span class="rt-ic">${icon(ic)}</span><div class="rt-main"><b>${main}</b><p>${label} · ${sub}</p></div><a class="btn sm" href="${gm}" target="_blank" rel="noopener">구글 지도</a></div>`;
}
function routeSheetHTML(A, B) {
  ensureRoutes(A, B, true);
  const tr = travel(A, B), rec = recMode(tr);
  return `<div class="sh-head"><div class="t"><span class="catchip" style="--c:var(--accent)">${icon('clock')}이동시간 · 직선 ${tr.straightKm < 1 ? Math.round(tr.straightKm * 1000) + 'm' : tr.straightKm.toFixed(1) + 'km'}</span>
      <div class="rt-ends"><p><small>출발</small>${esc(A.name)}</p><span></span><p><small>도착</small>${esc(B.name)}</p>
      <button class="icon-btn sm" data-action="swap" aria-label="출발과 도착 바꾸기" title="출발과 도착 바꾸기" style="grid-row:1/3;grid-column:2">${icon('swap')}</button></div></div>
      <button class="icon-btn" data-action="close-sheet" aria-label="닫기">${icon('close')}</button></div>
    ${routeRow('foot', '도보', 'walk', tr.foot, A, B, rec.mode === 'foot')}
    ${routeRow('transit', '대중교통', 'transit', tr.transit, A, B, rec.mode === 'transit')}
    ${routeRow('car', '차량', 'car', tr.car, A, B, false)}
    <div class="rt-legend"><span><i></i>도보 경로</span><span><i class="car"></i>차량 경로</span></div>
    <p class="hint">${icon('info')}<span>대중교통 시간은 경로거리와 평균 속도로 낸 추정치입니다. 실제 노선과 시간은 구글 지도에서 확인하세요.</span></p>
    <div class="sh-acts">${A.me ? '' : `<button class="btn" data-action="info" data-pid="${A.id}">출발지 정보</button>`}${B.me ? '' : `<button class="btn" data-action="info" data-pid="${B.id}">도착지 정보</button>`}</div>`;
}
function drawRoute(A, B, adjust) {
  if (!map) return;
  routeLayer.clearLayers();
  const tr = travel(A, B);
  if (tr.car.geom) L.polyline(tr.car.geom, { className: 'rt-car', weight: 4, dashArray: '7 8', interactive: false }).addTo(routeLayer);
  if (tr.foot.geom) L.polyline(tr.foot.geom, { className: 'rt-foot', weight: 5, interactive: false }).addTo(routeLayer);
  if (!tr.foot.geom && !tr.car.geom) L.polyline([[A.lat, A.lng], [B.lat, B.lng]], { className: 'rt-straight', weight: 3, dashArray: '2 8', interactive: false }).addTo(routeLayer);
  if (A.me || B.me) drawMe();
  if (adjust) revealOnMap([A, B], true);
}

/* ===== 내 위치 ===== */
function updateLocBtn() { $('#btnLocate').classList.toggle('on', watching); }
function toggleLocate(force) {
  if (!map) return;
  if (watching && !force) { map.stopLocate(); watching = false; UI.me = null; meLayer.clearLayers(); updateLocBtn(); return; }
  if (!watching) { firstFix = true; watching = true; map.locate({ watch: true, enableHighAccuracy: true, setView: false, maximumAge: 15000 }); updateLocBtn(); toast('현재 위치를 찾는 중입니다.'); }
}
function onLocation(e) {
  UI.me = { lat: e.latlng.lat, lng: e.latlng.lng, acc: e.accuracy };
  drawMe();
  if (pendingMeRoute) { const id = pendingMeRoute; pendingMeRoute = null; openSheet('route', '__me', id); }
  else if (firstFix) map.setView(e.latlng, Math.max(map.getZoom(), 15));
  firstFix = false;
}
function drawMe() {
  if (!UI.me) return;
  meLayer.clearLayers();
  L.circle([UI.me.lat, UI.me.lng], { radius: UI.me.acc || 30, className: 'me-acc', weight: 1, interactive: false }).addTo(meLayer);
  L.marker([UI.me.lat, UI.me.lng], { icon: L.divIcon({ className: 'me-dot', iconSize: [18, 18] }), interactive: false, zIndexOffset: 2000 }).addTo(meLayer);
}
function routeFromMe(pid) {
  if (UI.me) return openSheet('route', '__me', pid);
  pendingMeRoute = pid; toggleLocate(true);
}

/* ===== 장소 검색 (OpenStreetMap Nominatim, 버튼을 누를 때만 1초 간격 이상으로 보낸다) ===== */
let lastNomi = 0, searchRes = [];
async function nomiWait() { const w = 1100 - (Date.now() - lastNomi); if (w > 0) await sleep(w); lastNomi = Date.now(); }
function osmCat(x) {
  const c = x.category, t = x.type;
  if (c === 'amenity' && /restaurant|fast_food|food_court|bar|pub/.test(t)) return 'food';
  if (c === 'amenity' && /cafe|ice_cream/.test(t)) return 'cafe';
  if (c === 'shop' || (c === 'amenity' && t === 'marketplace')) return 'shop';
  if (c === 'tourism' && /hotel|hostel|guest_house|apartment|motel/.test(t)) return 'hotel';
  if (c === 'tourism' || c === 'historic' || c === 'leisure' || (c === 'amenity' && /place_of_worship|theatre|arts_centre/.test(t))) return 'sight';
  if (c === 'railway' || c === 'aeroway' || c === 'public_transport' || (c === 'amenity' && /ferry_terminal|bus_station/.test(t))) return 'transport';
  return 'etc';
}
/* OpenStreetMap 운영시간 표기 가운데 단순한 형식만 읽는다. 못 읽으면 null */
function parseOSMHours(s) {
  if (!s) return null;
  s = s.trim();
  const D = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 };
  if (s === '24/7') return Array.from({ length: 7 }, () => [['00:00', '24:00']]);
  const out = Array(7).fill(null);
  for (const rule of s.split(';').map(x => x.trim()).filter(Boolean)) {
    let days = [0, 1, 2, 3, 4, 5, 6], val = rule;
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
    if (m) {
      days = [];
      for (const part of m[1].split(',')) { const [a, b] = part.split('-'); if (!b) { days.push(D[a]); continue; } let i = D[a]; for (let k = 0; k < 7; k++) { days.push(i); if (i === D[b]) break; i = (i + 1) % 7; } }
      val = m[2].trim();
    } else if (!/^\d/.test(rule) && !/^(off|closed)$/i.test(rule)) return null;
    let ranges = [];
    if (!/^(off|closed)$/i.test(val)) {
      for (const tt of val.split(',')) { const r = tt.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/); if (!r) return null; ranges.push([`${pad(+r[1])}:${r[2]}`, `${pad(+r[3])}:${r[4]}`]); }
    }
    days.forEach(d => { out[d] = ranges; });
  }
  return out;
}
function fromOSM(x, lat, lng) {
  const nd = x.namedetails || {}, ex = x.extratags || {};
  const name = x.name || (x.display_name || '').split(',')[0] || '';
  const hours = parseOSMHours(ex.opening_hours);
  return {
    name: (nd['name:ko'] || name).slice(0, 80), nameLocal: (nd['name:en'] || nd.name || '').slice(0, 120), cat: osmCat(x),
    lat: +(lat ?? x.lat), lng: +(lng ?? x.lon), addr: (x.display_name || '').slice(0, 200), hours,
    hoursNote: ex.opening_hours && !hours ? `OpenStreetMap 표기: ${ex.opening_hours}` : '',
    verify: hours ? 'other' : 'none', source: hours ? 'https://www.openstreetmap.org/' + (x.osm_type || 'node') + '/' + (x.osm_id || '') : '',
    url: safeUrl(ex.website || ex['contact:website'] || ''),
  };
}
async function doSearch(q) {
  q = q.trim(); if (!q) return;
  const box = $('#searchResults'), lq = q.toLowerCase();
  const local = T().places.filter(p => `${p.name} ${p.nameLocal}`.toLowerCase().includes(lq));
  const localHTML = local.length ? `<p class="sr-sec">내 장소</p>` + local.map(p => `<button class="sr" data-lp="${p.id}"><b>${esc(p.name)}</b><small>${esc(cat(p).label)}${p.nameLocal ? ' · ' + esc(p.nameLocal) : ''}</small></button>`).join('') : '';
  box.hidden = false;
  box.innerHTML = localHTML + `<p class="sr-msg">OpenStreetMap에서 찾는 중입니다…</p>`;
  if (navigator.onLine === false) { box.innerHTML = localHTML + `<p class="sr-msg">인터넷에 연결되어 있지 않아 새 장소를 찾을 수 없습니다.</p>`; return; }
  try {
    await nomiWait();
    const b = map ? map.getBounds().pad(0.5) : null;
    const vb = b ? `&viewbox=${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}` : '';
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&extratags=1&namedetails=1&accept-language=ko,en${vb}&q=${encodeURIComponent(q)}`);
    searchRes = await r.json();
    box.innerHTML = localHTML + `<p class="sr-sec">새 장소 추가</p>` + (searchRes.length
      ? searchRes.map((x, i) => `<button class="sr" data-sr="${i}"><b>${esc(fromOSM(x).name)}</b><small>${esc(CATS[osmCat(x)].label)} · ${esc(x.display_name)}</small></button>`).join('')
      : `<p class="sr-msg">찾은 장소가 없습니다. 영어나 현지어 이름으로도 찾아보세요. 지도를 길게 누르면 그 자리에 바로 추가할 수 있습니다.</p>`)
      + `<p class="sr-attr">검색: OpenStreetMap Nominatim</p>`;
  } catch (e) {
    box.innerHTML = localHTML + `<p class="sr-msg">검색 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>`;
  }
}
function focusPlace(id) {
  const p = placeById(id); if (!p) return;
  if (!isWide()) setTab('map');
  $('#searchResults').hidden = true;
  setTimeout(() => { openSheet('place', id); revealOnMap([p], true); }, 30);
}

/* ===== 지도에서 위치 지정 ===== */
async function reverseGeo(lat, lng) {
  try {
    await nomiWait();
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&extratags=1&namedetails=1&accept-language=ko,en&lat=${lat}&lon=${lng}`, { signal: ctrl.signal });
    clearTimeout(tm);
    return await r.json();
  } catch (e) { return null; }
}
async function addAt(latlng) {
  toast('그 자리의 이름과 주소를 찾는 중입니다.');
  const x = await reverseGeo(latlng.lat, latlng.lng);
  const init = x && !x.error ? fromOSM(x, latlng.lat, latlng.lng) : { lat: latlng.lat, lng: latlng.lng };
  init.lat = +latlng.lat.toFixed(6); init.lng = +latlng.lng.toFixed(6);
  openPlaceForm(init);
}
function startPick(opts) {
  if (!map) return toast('지도를 불러오지 못해 위치를 지정할 수 없습니다.');
  closeModal(); if (UI.sheet) closeSheet();
  if (!isWide()) setTab('map');
  UI.pick = opts;
  $('#crosshair').hidden = false;
  const bar = $('#pickBar');
  bar.hidden = false;
  bar.innerHTML = `<p>${opts.mode === 'move' ? '지도를 움직여 새 위치를 빨간 십자에 맞추세요.' : '지도를 움직여 추가할 위치를 빨간 십자에 맞추세요.'}</p>
    <div><button class="btn ghost" data-action="pick-cancel">취소</button><button class="btn primary" data-action="pick-ok">${opts.mode === 'move' ? '이 위치로 옮기기' : '이 위치에 추가'}</button></div>`;
  if (opts.latlng) setTimeout(() => map.setView(opts.latlng, Math.max(map.getZoom(), 16)), 50);
}
function endPick() { UI.pick = null; $('#crosshair').hidden = true; $('#pickBar').hidden = true; }
function pickOk() {
  const c = map.getCenter(), o = UI.pick; endPick();
  if (o.mode === 'move') {
    const p = placeById(o.pid); if (!p) return;
    const snap = snapshot();
    p.lat = +c.lat.toFixed(6); p.lng = +c.lng.toFixed(6);
    commit(); toast(`${p.name} 위치를 옮겼습니다.`, { label: '되돌리기', fn: () => restore(snap) });
  } else addAt(c);
}
