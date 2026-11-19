
/* ===== 화면 전환·그리기 ===== */
const TABS = [['map', '지도', 'map'], ['places', '장소', 'pin'], ['plan', '일정', 'cal'], ['flight', '항공', 'plane'], ['more', '더보기', 'list']];
function setTab(tab) {
  if (isWide() && tab === 'map') tab = 'places';
  UI.tab = tab;
  $$('#tabbar [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#view-map').hidden = !isWide() && tab !== 'map';
  for (const v of ['places', 'plan', 'flight', 'more']) $('#view-' + v).hidden = tab !== v;
  if (tab === 'flight') renderFlights();
  if (tab === 'plan') { renderPlan(); if (!UI.ttInit) { UI.ttInit = true; scrollToFirst(); } }
  if (map) setTimeout(() => map.invalidateSize(), 0);
  save();
}
function renderTop() {
  const t = T(), n = tripDays().length;
  document.title = `${t.name} 플래너`;
  $('#tripName').textContent = t.name;
  const sameYear = t.start.slice(0, 4) === t.end.slice(0, 4), sameMonth = t.start.slice(0, 7) === t.end.slice(0, 7);
  const end = t.start === t.end ? '' : ` – ${sameMonth ? `${+t.end.slice(8)}일(${WD[weekday(t.end)]})` : fmtLongDate(t.end, sameYear)}`;
  $('#tripMeta').textContent = `${fmtLongDate(t.start)}${end} · ${n > 1 ? `${n - 1}박 ${n}일` : '당일'}`;
  tick();
}
function tick() {
  const t = T(), diff = dayNum(t.start) - dayNum(localToday()), n = tripDays().length;
  $('#dday').textContent = diff > 0 ? `D-${diff}` : -diff < n ? `${1 - diff}일차` : '여행 끝';
  $('#clock').textContent = `현지 ${fmtHM(tripNow().min)}`;
}
function renderAll() {
  if (DND.active) { DND.dirty = true; return; }
  renderTop(); renderMapDays(); renderMarkers(); renderPlaces(); renderPlan(); renderMore();
  if (UI.sheet) refreshSheet(false);
}

/* ===== 이벤트 연결 ===== */
function bindEvents() {
  $('#tabbar').innerHTML = TABS.map(([k, l, ic]) => `<button data-tab="${k}" role="tab" aria-selected="false">${icon(ic)}<span>${l}</span></button>`).join('');
  $('#tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('#btnAddPlace').innerHTML = `${icon('plus')}추가`;
  $('#btnZoomIn').innerHTML = icon('plus'); $('#btnZoomOut').innerHTML = icon('minus');
  $('#btnLocate').innerHTML = icon('locate'); $('#btnFit').innerHTML = icon('fit');
  $('#btnZoomIn').onclick = () => map && map.zoomIn();
  $('#btnZoomOut').onclick = () => map && map.zoomOut();
  $('#btnLocate').onclick = () => toggleLocate();
  $('#btnFit').onclick = fitAll;

  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); $('#searchInput').blur(); doSearch($('#searchInput').value); });
  $('#searchInput').addEventListener('input', e => { if (!e.target.value.trim()) $('#searchResults').hidden = true; });
  $('#searchResults').addEventListener('click', e => {
    const lp = e.target.closest('[data-lp]'); if (lp) return focusPlace(lp.dataset.lp);
    const sr = e.target.closest('[data-sr]'); if (!sr) return;
    const x = searchRes[+sr.dataset.sr]; if (!x) return;
    $('#searchResults').hidden = true;
    if (map) map.setView([+x.lat, +x.lon], Math.max(map.getZoom(), 16));
    openPlaceForm(fromOSM(x));
  });
  $('#mapDays').addEventListener('click', e => { const b = e.target.closest('[data-mapday]'); if (b) setMapDay(b.dataset.mapday); });
  $('#pickBar').addEventListener('click', e => { const a = e.target.closest('[data-action]'); if (!a) return; if (a.dataset.action === 'pick-ok') pickOk(); else endPick(); });

  /* 여러 화면에 공통인 버튼 */
  const common = e => {
    const a = e.target.closest('[data-action]'); if (!a) return false;
    const pid = a.dataset.pid, act = a.dataset.action;
    if (act === 'close-sheet') closeSheet();
    else if (act === 'sched') quickSched(pid);
    else if (act === 'edit') { const p = placeById(pid); if (p) openPlaceForm(p, pid); }
    else if (act === 'focus') focusPlace(pid);
    else if (act === 'route-me') routeFromMe(pid);
    else if (act === 'info') openSheet('place', pid);
    else if (act === 'swap') openSheet('route', UI.sheet.b, UI.sheet.a);
    else if (act === 'edit-sched') { const s = T().schedule.find(x => x.id === a.dataset.sid); if (s) openScheduleModal(s); }
    else if (act === 'add-place') openAddMenu();
    else return false;
    return true;
  };
  $('#sheet').addEventListener('click', common);
  $('#view-places').addEventListener('click', e => { if (common(e)) return; const f = e.target.closest('[data-filter]'); if (f) { UI.filter = f.dataset.filter; renderPlaces(); } });

  $('#planDays').addEventListener('click', e => {
    const b = e.target.closest('[data-day],[data-action="plan-all"]'); if (!b) return;
    if (b.dataset.day) { UI.planDay = b.dataset.day; UI.planAll = false; } else UI.planAll = !UI.planAll;
    renderPlan(); scrollToFirst();
  });
  $('#tt').addEventListener('click', e => {
    if (recentlyDragged()) return;
    const c = e.target.closest('.conn');
    if (c) { if (!isWide()) setTab('map'); setTimeout(() => openSheet('route', c.dataset.from, c.dataset.to), 30); return; }
    const fb = e.target.closest('.blk.flight');
    if (fb) { setTab('flight'); setTimeout(() => { const el = $('#fc-' + fb.dataset.fid); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); return; }
    const b = e.target.closest('.blk[data-sid]');
    if (b) { const s = T().schedule.find(x => x.id === b.dataset.sid); if (s) openScheduleModal(s); }
  });
  $('#tt').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.blk[data-sid]')) { e.preventDefault(); e.target.click(); } });
  $('#tray').addEventListener('click', e => {
    if (recentlyDragged()) return;
    if (e.target.closest('[data-action="tray-toggle"]')) { UI.trayOpen = !UI.trayOpen; renderTray(); save(); return; }
    const c = e.target.closest('.chip-p'); if (c) quickSched(c.dataset.pid, UI.planAll ? null : UI.planDay);
  });
  $('#tray').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.chip-p')) { e.preventDefault(); e.target.click(); } });

  $('#flightBody').addEventListener('input', onFlightInput);
  $('#flightBody').addEventListener('change', onFlightInput);
  $('#flightBody').addEventListener('click', e => {
    const a = e.target.closest('[data-action]'); if (!a) return;
    const t = T();
    if (a.dataset.action === 'add-flight') {
      const last = t.flights[t.flights.length - 1];
      t.flights.push(normFlight({ id: uid(), label: '항공편', from: { code: last ? last.to.code : '', name: last ? last.to.name : '', tz: last ? last.to.tz : t.homeTz }, to: { tz: t.tz } }));
      commit(); renderFlights();
    } else if (a.dataset.action === 'del-flight') {
      const f = t.flights.find(x => x.id === a.dataset.fid); if (!f) return;
      confirmBox('항공편 삭제', `${esc(f.label || '항공편')} 정보를 지웁니다.`, '삭제', () => { const snap = snapshot(); t.flights = t.flights.filter(x => x.id !== f.id); commit(); renderFlights(); toast('항공편을 지웠습니다.', { label: '되돌리기', fn: () => restore(snap) }); });
    }
  });

  const more = $('#moreBody');
  more.addEventListener('change', e => {
    const el = e.target, t = T();
    if (el.dataset.cl) setCheck(el.dataset.cl, c => { c.done = el.checked; });
    else if (el.dataset.clt) setCheck(el.dataset.clt, c => { c.text = el.value.trim().slice(0, 100) || c.text; });
    else if (el.id === 'ts-name') { t.name = el.value.trim().slice(0, 60) || t.name; commit(); }
    else if (el.id === 'ts-start' || el.id === 'ts-end') {
      const s = $('#ts-start').value, en = $('#ts-end').value;
      if (!isDate(s) || !isDate(en) || dayNum(en) < dayNum(s) || dayNum(en) - dayNum(s) > 59) { toast('종료일은 시작일과 같거나 그 뒤여야 하고, 기간은 60일 이내여야 합니다.'); renderMore(); return; }
      t.start = s; t.end = en; UI.planDay = null; commit();
    }
    else if (el.id === 'ts-tz') { t.tz = +el.value; commit(); }
    else if (el.id === 'ts-home') { t.homeTz = +el.value; commit(); }
    else if (el.id === 'importFile' && el.files[0]) { importFile(el.files[0]); el.value = ''; }
  });
  more.addEventListener('submit', e => {
    if (e.target.id !== 'clAdd') return; e.preventDefault();
    const v = $('#clNew').value.trim(); if (!v) return;
    T().checklist.push({ id: uid(), text: v.slice(0, 100), done: false }); commit();
    setTimeout(() => $('#clNew') && $('#clNew').focus(), 0);
  });
  more.addEventListener('click', e => {
    const del = e.target.closest('[data-cldel]');
    if (del) { const snap = snapshot(); T().checklist = T().checklist.filter(c => c.id !== del.dataset.cldel); commit(); toast('준비물을 지웠습니다.', { label: '되돌리기', fn: () => restore(snap) }); return; }
    const th = e.target.closest('[data-theme-set]');
    if (th) { S.ui.look = th.dataset.themeSet; save(); applyTheme(); renderMore(); return; }
    const a = e.target.closest('[data-action]'); if (!a) return;
    const act = a.dataset.action;
    if (act === 'share') makeShare();
    else if (act === 'export') exportBackup();
    else if (act === 'add-sample-sched') {
      const t = T(), ids = new Set(t.places.map(p => p.id));
      const add = SEED_SCHEDULE.filter(s => ids.has(s.placeId)).map(s => Object.assign({}, s, { id: uid() }));
      t.schedule.push(...add); UI.planDay = null; UI.ttInit = false; commit(); toast(`예시 일정 ${add.length}개를 시간표에 넣었습니다.`);
    }
    else if (act === 'del-sample-sched') {
      const snap = snapshot(); T().schedule = T().schedule.filter(s => !s.sample); commit();
      toast('예시 일정을 지웠습니다.', { label: '되돌리기', fn: () => restore(snap) });
    }
    else if (act === 'new-trip') openNewTrip();
    else if (act === 'open-trip') switchTrip(a.dataset.tid);
    else if (act === 'set-center') { if (!map) return; const c = map.getCenter(); T().center = [+c.lat.toFixed(5), +c.lng.toFixed(5)]; T().zoom = map.getZoom(); commit(); toast('지금 지도 화면을 기본 위치로 정했습니다.'); }
    else if (act === 'del-trip') {
      const x = S.trips[a.dataset.tid]; if (!x) return;
      confirmBox('여행 삭제', `${esc(x.name)}의 장소, 시간표, 항공권, 준비물을 이 기기에서 모두 지웁니다. 되돌릴 수 없으니 필요하면 먼저 백업 파일을 저장해 주세요.`, '삭제', () => { delete S.trips[x.id]; save(); renderMore(); toast(`${x.name}을(를) 지웠습니다.`); });
    }
    else if (act === 'del-samples') {
      const ids = T().places.filter(p => p.sample).map(p => p.id), n = T().schedule.filter(s => ids.includes(s.placeId)).length;
      confirmBox('예시 장소 지우기', `예시 장소 ${ids.length}곳을 지웁니다.${n ? ` 이 장소들로 만든 일정 ${n}개도 함께 지워집니다.` : ''} 직접 추가하거나 고친 장소는 남습니다.`, '지우기', () => {
        const snap = snapshot(), t = T(); t.places = t.places.filter(p => !p.sample); t.schedule = t.schedule.filter(s => !ids.includes(s.placeId)); closeSheet(); commit();
        toast('예시 장소를 지웠습니다.', { label: '되돌리기', fn: () => restore(snap) });
      });
    }
  });

  $('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (UI.pick) endPick(); else if (UI.sheet) closeSheet(); } });
  matchMedia('(min-width: 960px)').addEventListener('change', () => setTab(UI.tab === 'places' && !isWide() ? 'map' : UI.tab));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
  window.addEventListener('resize', () => map && map.invalidateSize());
  window.addEventListener('hashchange', checkHashImport);
}

/* 홈 화면 아이콘: 실행할 때 그려서 붙인다 */
function makeIcon() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = '#0d7457'; g.fillRect(0, 0, 180, 180);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(90, 74, 42, Math.PI, 0); g.lineTo(90, 148); g.closePath(); g.fill();
    g.beginPath(); g.arc(90, 74, 42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d7457'; g.beginPath(); g.arc(90, 74, 17, 0, Math.PI * 2); g.fill();
    const url = c.toDataURL('image/png');
    for (const rel of ['apple-touch-icon', 'icon']) { const l = document.createElement('link'); l.rel = rel; l.href = url; document.head.appendChild(l); }
  } catch (e) { /* 아이콘 없이 진행 */ }
}

/* ===== 새 버전 확인: 휴대폰 브라우저가 예전 페이지를 계속 쓰지 않도록 한다 ===== */
let newerBuild = null;
async function checkUpdate() {
  if (!/^https?:$/.test(location.protocol) || !/^\d{12}$/.test(APP_BUILD)) return null;
  try {
    const r = await fetch(location.pathname + '?check=' + Date.now(), { cache: 'no-store' });
    const m = (await r.text()).match(/const APP_BUILD = '(\d{12})'/);
    if (m && m[1] > APP_BUILD) { newerBuild = m[1]; toast('새 버전이 나왔습니다. 새로 고친 뒤 써 주세요.', { label: '새로 고침', fn: reloadToNewest }, 30000); }
  } catch (e) { /* 연결이 없으면 다음에 다시 확인한다 */ }
  return newerBuild;
}
function reloadToNewest() { location.replace(location.pathname + '?v=' + (newerBuild || Date.now()) + location.hash); }

/* ===== 시작 ===== */
applyTheme();
initMap();
bindEvents();
renderAll();
setTab(UI.tab);
renderFlights();
makeIcon();
setInterval(() => { tick(); if (UI.tab === 'plan' && !DND.active && tripDays().includes(tripNow().date)) renderPlan(); }, 30000);
if (SEED_ADDED) { save(); renderAll(); toast(`새 예시 장소 ${SEED_ADDED}곳(맛집, 바, 명소)을 장소 목록에 넣었습니다.`, null, 6000); }
checkHashImport();
setTimeout(checkUpdate, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
window.addEventListener('pageshow', e => { if (e.persisted) checkUpdate(); });
</script>
</body>
</html>
