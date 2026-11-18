
/* ===== 더보기: 준비물, 여행 설정, 공유·백업, 여행 목록 ===== */
function tripRange(t) { const n = tripDays(t).length; return `${md(t.start)}–${md(t.end)} · ${n > 1 ? `${n - 1}박 ${n}일` : '당일'}`; }
function renderMore() {
  const t = T(), done = t.checklist.filter(c => c.done).length, total = t.checklist.length;
  const samples = t.places.filter(p => p.sample).length, sampleSched = t.schedule.filter(s => s.sample).length, theme = S.ui.look || 'light';
  $('#moreBody').innerHTML = `
  <section class="card"><div class="ch"><h2>준비물</h2><span>${done}/${total}</span></div>
    <div class="bar"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    <ul class="cl">${t.checklist.map(c => `<li class="${c.done ? 'done' : ''}"><label class="cb"><input type="checkbox" data-cl="${c.id}" ${c.done ? 'checked' : ''} aria-label="${esc(c.text)} 준비 완료"><span></span></label>
      <input class="cl-text" data-clt="${c.id}" value="${esc(c.text)}" maxlength="100" aria-label="준비물 이름"><button class="icon-btn sm" data-cldel="${c.id}" aria-label="${esc(c.text)} 지우기">${icon('close')}</button></li>`).join('')}</ul>
    <form class="cl-add" id="clAdd"><input id="clNew" placeholder="준비물 추가" maxlength="100" autocomplete="off" aria-label="새 준비물"><button class="btn sm">추가</button></form>
  </section>
  <section class="card"><h2>여행 설정</h2>
    <label class="fld"><span>여행 이름</span><input id="ts-name" value="${esc(t.name)}" maxlength="60"></label>
    <div class="row2"><label class="fld"><span>시작일</span><input type="date" id="ts-start" value="${t.start}"></label><label class="fld"><span>종료일</span><input type="date" id="ts-end" value="${t.end}"></label></div>
    <div class="row2"><label class="fld"><span>여행지 시간대</span><select id="ts-tz">${tzOptions(t.tz)}</select></label><label class="fld"><span>출발지(집) 시간대</span><select id="ts-home">${tzOptions(t.homeTz)}</select></label></div>
    <button class="btn sm ghost" data-action="set-center" style="align-self:flex-start">${icon('map')}지금 지도 화면을 이 여행의 기본 위치로</button>
  </section>
  <section class="card"><h2>공유와 백업</h2>
    <p class="small muted">일정은 이 기기의 브라우저에 자동 저장됩니다. 다른 기기나 동행자에게는 공유 링크로 보내고, 받은 사람이 링크를 열면 일정을 가져올 수 있습니다.</p>
    <div class="btnrow"><button class="btn primary sm" data-action="share">${icon('share')}공유 링크 만들기</button><button class="btn sm" data-action="export">${icon('download')}백업 파일 저장</button>
      <label class="btn sm" for="importFile">${icon('upload')}백업 파일 불러오기</label><input type="file" id="importFile" accept=".json,application/json" hidden></div>
    <p class="note">아이폰에서 홈 화면에 추가한 아이콘으로 열면 Safari와 저장 공간이 따로입니다. 한쪽에서 짠 일정은 공유 링크로 다른 쪽에 옮겨 주세요.</p>
  </section>
  <section class="card"><h2>여행 목록</h2>
    <div class="trips">${Object.values(S.trips).sort((a, b) => a.start.localeCompare(b.start)).map(x => `<div class="trip ${x.id === t.id ? 'cur' : ''}"><div><b>${esc(x.name)}</b><small>${tripRange(x)} · 장소 ${x.places.length}곳</small></div>
      ${x.id === t.id ? '<small>지금 여행</small>' : `<button class="btn sm" data-action="open-trip" data-tid="${x.id}">열기</button><button class="icon-btn sm" data-action="del-trip" data-tid="${x.id}" aria-label="${esc(x.name)} 지우기">${icon('trash')}</button>`}</div>`).join('')}</div>
    <button class="btn sm" data-action="new-trip" style="align-self:flex-start">${icon('plus')}새 여행 만들기</button>
    ${t.id === SEED_TRIP.id && !sampleSched ? `<button class="btn sm" data-action="add-sample-sched" style="align-self:flex-start">${icon('cal')}예시 시간표 넣기</button>` : ''}
    ${sampleSched ? `<button class="btn sm danger ghost" data-action="del-sample-sched" style="align-self:flex-start">${icon('trash')}예시 일정 ${sampleSched}개 지우기</button>` : ''}
    ${samples ? `<button class="btn sm danger ghost" data-action="del-samples" style="align-self:flex-start">${icon('trash')}예시 장소 ${samples}곳 지우기</button>` : ''}
  </section>
  <section class="card"><h2>화면</h2><div class="seg" role="group" aria-label="화면 밝기">${[['light', '밝게'], ['dark', '어둡게'], ['auto', '기기 설정']].map(([k, l]) => `<button data-theme-set="${k}" class="${theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></section>
  <section class="card"><h2>쓰는 방법</h2><ol class="how">
    <li>지도 위 검색창에 장소 이름을 넣거나 지도를 길게 눌러 장소를 표시합니다.</li>
    <li>표시를 누르면 장소 정보가 나오고, 그 상태에서 다른 표시를 누르면 두 곳 사이 이동시간이 나옵니다.</li>
    <li>일정 탭 아래쪽 장소를 시간표로 끌어다 놓고 시작과 종료 시각을 정합니다. 휴대폰에서는 길게 누르거나 위로 밀어 올린 뒤 움직입니다.</li>
    <li>시간표의 일정 사이에 이동시간이 붙고, 간격이 모자라거나 운영시간 밖이면 경고가 뜹니다.</li>
    <li>지도 위 일차 버튼을 누르면 그날 동선이 순서 번호와 점선으로 보입니다. 점선은 순서를 이은 직선이며 실제 경로가 아닙니다.</li></ol></section>
  <section class="card"><h2>자료 출처와 계산 방법</h2><ul class="src">
    <li>지도: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 기여자 (OpenStreetMap 표준 타일)</li>
    <li>장소 검색: OpenStreetMap Nominatim. 검색 버튼을 누를 때만 보냅니다.</li>
    <li>도보·차량 시간: FOSSGIS가 운영하는 OSRM 경로 서버(routing.openstreetmap.de)의 도로망 계산값입니다. 차량은 교통 혼잡을 반영하지 않습니다.</li>
    <li>대중교통 시간(추정): 도보와 차량 경로거리 가운데 짧은 쪽을 평균 속도(가까운 거리 시속 약 20km, 먼 거리 최대 시속 40km)로 나눈 값에 역까지 걷기와 대기 10분을 더했습니다. 실제 노선과 시간은 구글 지도에서 확인하세요.</li>
    <li>시간표 이동시간의 추천 수단: 도보 15분 이하는 도보, 그보다 멀면 대중교통 추정치입니다.</li>
    <li>예시 장소의 운영시간: 장소 정보마다 출처와 확인한 날(2026-11-18)을 적었습니다. 출발 전에 공식 사이트를 다시 확인하세요.</li></ul></section>`;
}
function setCheck(id, fn) { const c = T().checklist.find(x => x.id === id); if (c) { fn(c); commit(); } }

/* 공유 링크: 여행 자료 전체를 압축해 주소 뒤(#share=)에 붙인다. 서버로는 아무것도 보내지 않는다 */
function makeShare() {
  if (typeof LZString === 'undefined') return toast('압축 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  const url = `${location.href.split('#')[0]}#share=${LZString.compressToEncodedURIComponent(JSON.stringify(T()))}`;
  const isFile = location.protocol === 'file:';
  openModal(`${mHead('공유 링크')}<div class="mbody">
    <p class="small muted">이 링크를 연 사람은 지금 일정(장소 ${T().places.length}곳, 일정 ${T().schedule.length}개)을 자기 기기로 가져올 수 있습니다. 링크 길이 ${url.length.toLocaleString()}자.</p>
    ${isFile ? '<p class="note warn">지금은 컴퓨터의 파일로 열려 있어서 이 링크는 다른 기기에서 열리지 않습니다. 파일을 웹 주소로 올린 뒤 그 주소에서 링크를 만들어 주세요. 같은 컴퓨터 안에서는 백업 파일을 쓰세요.</p>' : ''}
    <textarea class="linkbox" id="shareUrl" rows="4" readonly>${esc(url)}</textarea></div>
    <div class="mf"><span class="sp"></span>${navigator.share ? `<button class="btn" id="sh-share">${icon('share')}보내기</button>` : ''}<button class="btn primary" id="sh-copy">${icon('copy')}복사</button></div>`, c => {
    $('#sh-copy', c).onclick = () => {
      const ta = $('#shareUrl');
      const fallback = () => { ta.focus(); ta.select(); try { document.execCommand('copy'); toast('링크를 복사했습니다.'); } catch (e) { toast('링크를 길게 눌러 직접 복사해 주세요.'); } };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('링크를 복사했습니다.'), fallback); else fallback();
    };
    if (navigator.share) $('#sh-share', c).onclick = () => navigator.share({ title: T().name, url }).catch(() => {});
  });
}
function exportBackup() {
  const t = T();
  const blob = new Blob([JSON.stringify({ app: 'trip-planner', version: 1, trip: t }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t.name.replace(/[\\/:*?"<>|]/g, '_')}_${t.start}_백업.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('백업 파일을 저장했습니다.');
}
function importFile(file) {
  const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); openImport(j.trip || j, '백업 파일'); } catch (e) { toast('백업 파일을 읽지 못했습니다. 이 플래너에서 저장한 파일인지 확인해 주세요.'); } };
  r.readAsText(file);
}
function openImport(raw, via) {
  let t; try { t = normTrip(raw); } catch (e) { return toast('일정 자료를 읽지 못했습니다.'); }
  const ex = S.trips[t.id];
  /* 이 기기에 같은 여행이 없거나, 있어도 한 번도 고치지 않은 예시 상태면 잃을 것이 없으므로 묻지 않고 바로 가져온다 */
  if (!ex || !ex.updatedAt) {
    S.trips[t.id] = t; closeModal(); switchTrip(t.id);
    toast(`${via}로 받은 ${t.name} 일정을 열었습니다.`);
    return;
  }
  const stat = x => `장소 ${x.places.length}곳, 일정 ${x.schedule.length}개${x.updatedAt ? `, ${fmtStamp(x.updatedAt)} 수정` : ''}`;
  openModal(`${mHead(`${via}로 받은 일정`)}<div class="mbody"><p><b>${esc(t.name)}</b> · ${tripRange(t)}</p><p class="small muted">받은 일정: ${stat(t)}</p>
    ${ex ? `<p class="note">이 기기에도 같은 여행이 있습니다. 이 기기 일정: ${stat(ex)}. 바꾸면 이 기기 일정은 받은 일정으로 덮어써집니다.</p>` : ''}</div>
    <div class="mf"><button class="btn ghost" data-close>취소</button><span class="sp"></span>
    ${ex ? `<button class="btn" id="im-new">새 여행으로 추가</button><button class="btn primary" id="im-rep">받은 일정으로 바꾸기</button>` : `<button class="btn primary" id="im-new">가져오기</button>`}</div>`, c => {
    $('#im-new', c).onclick = () => { if (ex) { t.id = uid(); t.name = (t.name + ' (받은 일정)').slice(0, 60); } S.trips[t.id] = t; closeModal(); switchTrip(t.id); toast('일정을 가져왔습니다.'); };
    if (ex) $('#im-rep', c).onclick = () => { const snap = JSON.stringify(ex); S.trips[t.id] = t; closeModal(); switchTrip(t.id); toast('받은 일정으로 바꿨습니다.', { label: '되돌리기', fn: () => restore(snap) }); };
  });
}
function checkHashImport() {
  const m = location.hash.match(/^#share=(.+)$/); if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const json = LZString.decompressFromEncodedURIComponent(m[1]);
    if (!json) throw new Error('empty');
    openImport(JSON.parse(json), '공유 링크');
  } catch (e) { toast('공유 링크를 읽지 못했습니다. 링크가 중간에 잘리지 않았는지 확인해 주세요.'); }
}
function switchTrip(id) {
  if (!S.trips[id]) return;
  S.activeId = id; UI.sheet = null; UI.mapDay = null; UI.planDay = null; UI.ttInit = false; UI.filter = 'all';
  save(); $('#sheet').hidden = true; $('#view-map').classList.remove('has-sheet');
  if (map) { routeLayer.clearLayers(); map.setView(T().center, T().zoom); }
  renderAll(); renderFlights();
}
function openNewTrip() {
  const today = localToday();
  openModal(`${mHead('새 여행 만들기')}<form id="nt" class="form">
    <label class="fld"><span>여행 이름</span><input id="nt-name" maxlength="60" placeholder="예: 제주 여행"></label>
    <div class="row2"><label class="fld"><span>시작일</span><input type="date" id="nt-start" value="${today}"></label><label class="fld"><span>종료일</span><input type="date" id="nt-end" value="${fromDayNum(dayNum(today) + 2)}"></label></div>
    <div class="row2"><label class="fld"><span>여행지 시간대</span><select id="nt-tz">${tzOptions(9)}</select></label><label class="fld"><span>출발지(집) 시간대</span><select id="nt-home">${tzOptions(T().homeTz)}</select></label></div>
    <p class="small muted">지도 기본 위치는 지금 보고 있는 지도 화면으로 정합니다. 만든 뒤 검색으로 여행지를 찾고 더보기 탭에서 기본 위치를 다시 정할 수 있습니다.</p>
    <p class="err" id="nt-err" hidden></p>
    <div class="mf"><span class="sp"></span><button type="button" class="btn ghost" data-close>취소</button><button class="btn primary">만들기</button></div></form>`, c => {
    $('#nt', c).onsubmit = e => {
      e.preventDefault();
      const s = $('#nt-start').value, en = $('#nt-end').value;
      if (!isDate(s) || !isDate(en) || dayNum(en) < dayNum(s)) { const er = $('#nt-err'); er.hidden = false; er.textContent = '종료일은 시작일과 같거나 그 뒤여야 합니다.'; return; }
      const ctr = map ? map.getCenter() : { lat: T().center[0], lng: T().center[1] };
      const t = normTrip({ id: uid(), name: $('#nt-name').value.trim() || '새 여행', start: s, end: en, tz: +$('#nt-tz').value, homeTz: +$('#nt-home').value, center: [ctr.lat, ctr.lng], zoom: map ? map.getZoom() : 12 });
      S.trips[t.id] = t; closeModal(); switchTrip(t.id); toast(`${t.name}을(를) 만들었습니다.`);
    };
  });
}
function applyTheme() {
  const th = S.ui.look || 'light';
  if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff';
  setTiles();
}
