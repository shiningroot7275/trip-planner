
/* ===== 대화상자·알림 ===== */
function openModal(html, mount) {
  const m = $('#modal'), card = $('#modalCard');
  card.innerHTML = html; m.hidden = false; card.scrollTop = 0;
  if (mount) mount(card);
}
function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }
const mHead = title => `<div class="mh"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="닫기">${icon('close')}</button></div>`;
function confirmBox(title, body, okLabel, onOk) {
  openModal(`${mHead(title)}<div class="mbody"><p>${body}</p></div><div class="mf"><span class="sp"></span><button class="btn ghost" data-close>취소</button><button class="btn danger" id="cf-ok">${esc(okLabel)}</button></div>`,
    c => { $('#cf-ok', c).onclick = () => { closeModal(); onOk(); }; });
}
let toastTimer;
function toast(msg, action, ms) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms || (action ? 6500 : 3200));
}

/* ===== 시간표 일정 추가·수정 ===== */
let schedCtx = null;
function quickSched(pid, date) {
  const days = tripDays(), p = placeById(pid); if (!p) return;
  date = date && days.includes(date) ? date : (UI.mapDay || UI.planDay || days[0]);
  const items = dayItems(date);
  let start = items.length ? Math.ceil(Math.max(...items.map(i => i.end)) / 15) * 15 : 9 * 60;
  start = Math.min(start, 22 * 60);
  openScheduleModal({ placeId: pid, date, start: fmtHM(start), end: fmtHM(Math.min(start + (p.dur || 60), 1439)) });
}
function openScheduleModal(o) {
  const t = T(), days = tripDays(), isEdit = !!o.id;
  schedCtx = { id: o.id || null };
  openModal(`${mHead(isEdit ? '일정 수정' : '시간표에 추가')}
    <form id="sf" class="form" novalidate>
      <label class="fld"><span>장소</span><select id="sf-place">${t.places.map(p => `<option value="${p.id}" ${p.id === o.placeId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>날짜</span><select id="sf-date">${days.map((d, i) => `<option value="${d}" ${d === o.date ? 'selected' : ''}>${i + 1}일차 · ${dayLabel(d)}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>시작 (현지 시각)</span><input type="time" id="sf-start" value="${o.start}" required></label>
        <label class="fld"><span>종료 (현지 시각)</span><input type="time" id="sf-end" value="${o.end}" required></label></div>
      <div class="durs" aria-label="머무는 시간으로 종료 시각 정하기">${[30, 60, 90, 120, 180].map(m => `<button type="button" class="chip" data-dur="${m}">${fmtDur(m)}</button>`).join('')}</div>
      <div class="check" id="sf-check"></div>
      <label class="fld"><span>메모</span><textarea id="sf-memo" rows="2" maxlength="500" placeholder="예약 시각, 할 일 등">${esc(o.memo || '')}</textarea></label>
      <p class="err" id="sf-err" hidden></p>
      <div class="mf">${isEdit ? `<button type="button" class="btn danger ghost" id="sf-del">${icon('trash')}삭제</button>` : ''}<span class="sp"></span>
        <button type="button" class="btn ghost" data-close>취소</button><button type="submit" class="btn primary">저장</button></div>
    </form>`, c => {
    const f = $('#sf', c);
    f.addEventListener('input', refreshSchedCheck);
    f.addEventListener('change', refreshSchedCheck);
    $$('[data-dur]', c).forEach(b => b.onclick = () => { const s = toMin($('#sf-start').value); if (s == null) return; $('#sf-end').value = fmtHM(Math.min(s + +b.dataset.dur, 1439)); refreshSchedCheck(); });
    f.onsubmit = e => { e.preventDefault(); saveSched(); };
    if (isEdit) $('#sf-del', c).onclick = () => {
      const snap = snapshot(); T().schedule = T().schedule.filter(s => s.id !== o.id); closeModal(); commit();
      toast('일정을 지웠습니다.', { label: '되돌리기', fn: () => restore(snap) });
    };
    refreshSchedCheck();
  });
}
function readSchedForm() { return { id: schedCtx && schedCtx.id, placeId: $('#sf-place').value, date: $('#sf-date').value, start: $('#sf-start').value, end: $('#sf-end').value, memo: $('#sf-memo').value.trim() }; }
function refreshSchedCheck() {
  const box = $('#sf-check'); if (!box) return;
  const o = readSchedForm(), p = placeById(o.placeId), s = toMin(o.start), e = toMin(o.end);
  if (!p || s == null || e == null) { box.innerHTML = ''; return; }
  if (e <= s) { box.innerHTML = `<p class="ck bad">${icon('warn')}종료 시각이 시작 시각보다 늦어야 합니다. 자정을 넘기는 일정은 다음 날로 나눠 넣어 주세요.</p>`; return; }
  const out = [], hc = hoursCheck(p, o.date, s, e), wdl = `${dayLabel(o.date)}`;
  if (hc.state === 'open') out.push(`<p class="ck ok">${icon('check')}${wdl} 운영시간 ${esc(hc.text)} 안에 있습니다.</p>`);
  else if (hc.state === 'outside') out.push(`<p class="ck warn">${icon('warn')}${wdl} 운영시간(${esc(hc.text)}) 밖입니다.</p>`);
  else if (hc.state === 'closed') out.push(`<p class="ck warn">${icon('warn')}${wdl}은 휴무일입니다.</p>`);
  else out.push(`<p class="ck">${icon('clock')}${wdl} 운영시간 정보가 없습니다.</p>`);
  if (p.hoursNote) out.push(`<p class="ck sub">${esc(p.hoursNote)}</p>`);
  const others = dayItems(o.date).filter(it => it.id !== o.id);
  const ov = others.filter(it => it.start < e && it.end > s);
  if (ov.length) out.push(`<p class="ck warn">${icon('warn')}겹치는 일정: ${ov.map(it => `${esc(itemName(it))} ${fmtHM(it.start)}–${fmtHM(it.end)}`).join(', ')}</p>`);
  const prev = others.filter(it => it.end <= s).sort((a, b) => b.end - a.end)[0];
  const next = others.filter(it => it.start >= e).sort((a, b) => a.start - b.start)[0];
  const leg = (a, b, gap, txt) => {
    if (!a || !b || a.id === b.id || dist(a, b) < 40) return;
    ensureRoutes(a, b, true);
    const rm = recMode(travel(a, b)), bad = gap < ceilMin(rm.min);
    out.push(`<p class="ck ${bad ? 'warn' : ''}">${icon(rm.mode === 'foot' ? 'walk' : 'transit')}${txt} ${modeLabel(rm)}, 일정 사이 간격 ${fmtDur(gap)}</p>`);
  };
  if (prev) leg(prev.after, p, s - prev.end, `앞 일정(${esc(itemName(prev))})에서`);
  if (next) leg(p, next.before, next.start - e, `다음 일정(${esc(itemName(next))})까지`);
  box.innerHTML = out.join('');
}
function saveSched() {
  const o = readSchedForm(), err = $('#sf-err'), s = toMin(o.start), e = toMin(o.end);
  if (s == null || e == null) { err.hidden = false; err.textContent = '시작과 종료 시각을 넣어 주세요.'; return; }
  if (e <= s) { err.hidden = false; err.textContent = '종료 시각이 시작 시각보다 늦어야 합니다.'; return; }
  const t = T();
  if (o.id) { const x = t.schedule.find(z => z.id === o.id); if (x) Object.assign(x, { placeId: o.placeId, date: o.date, start: o.start, end: o.end, memo: o.memo, sample: false }); }
  else t.schedule.push({ id: uid(), placeId: o.placeId, date: o.date, start: o.start, end: o.end, memo: o.memo });
  closeModal();
  if (!UI.planAll) UI.planDay = o.date;
  commit();
  toast(`${tripDays().indexOf(o.date) + 1}일차 ${o.start}–${o.end}에 ${placeById(o.placeId).name}을(를) 넣었습니다.`);
}

/* ===== 장소 추가·수정 ===== */
function openAddMenu() {
  openModal(`${mHead('장소 추가')}<div class="picklist">
    <button class="btn" data-m="search">${icon('search')}<span>이름으로 찾기<small>지도 위 검색창에 영어나 현지어 이름을 넣으면 OpenStreetMap에서 찾아 드립니다.</small></span></button>
    <button class="btn" data-m="pick">${icon('locate')}<span>지도에서 위치 지정<small>지도를 움직여 십자 표시에 맞춥니다. 지도를 길게 눌러도 그 자리에 추가됩니다.</small></span></button>
    <button class="btn" data-m="manual">${icon('edit')}<span>좌표 직접 입력<small>구글 지도에서 길게 눌러 나온 좌표를 붙여 넣을 수 있습니다.</small></span></button></div>`, c => {
    $$('[data-m]', c).forEach(b => b.onclick = () => {
      closeModal();
      if (b.dataset.m === 'search') { if (!isWide()) setTab('map'); setTimeout(() => $('#searchInput').focus(), 60); }
      else if (b.dataset.m === 'pick') startPick({ mode: 'add' });
      else { const ctr = map ? map.getCenter() : { lat: T().center[0], lng: T().center[1] }; openPlaceForm({ lat: +ctr.lat.toFixed(6), lng: +ctr.lng.toFixed(6) }); }
    });
  });
}
function openPlaceForm(init, editId) {
  const p = Object.assign({ name: '', nameLocal: '', cat: 'sight', code: '', lat: 0, lng: 0, addr: '', hours: null, hoursNote: '', verify: 'none', source: '', checked: '', fee: '', url: '', memo: '', dur: null }, init);
  const h = p.hours || Array(7).fill(null), dur = p.dur || cat(p).dur;
  openModal(`${mHead(editId ? '장소 수정' : '장소 추가')}
    <form id="pf" class="form" novalidate>
      <label class="fld"><span>이름 (필수)</span><input id="pf-name" value="${esc(p.name)}" maxlength="80" placeholder="예: 빅토리아 피크"></label>
      <label class="fld"><span>현지 이름</span><input id="pf-local" value="${esc(p.nameLocal)}" maxlength="120" placeholder="영어나 현지어 이름 (구글 지도 검색에 씁니다)"></label>
      <div class="row2"><label class="fld"><span>분류</span><select id="pf-cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === p.cat ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
        <label class="fld"><span>기본 머무는 시간</span><select id="pf-dur">${[15, 30, 45, 60, 90, 120, 150, 180, 240].map(m => `<option value="${m}" ${m === dur ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')}</select></label></div>
      <div class="row2"><label class="fld"><span>위도</span><input id="pf-lat" inputmode="decimal" value="${p.lat}"></label><label class="fld"><span>경도</span><input id="pf-lng" inputmode="decimal" value="${p.lng}"></label></div>
      ${editId ? `<button type="button" class="btn ghost sm" id="pf-move">${icon('locate')}지도에서 위치 다시 지정</button>` : ''}
      <label class="fld" id="pf-code-wrap" ${p.cat === 'transport' ? '' : 'hidden'}><span>공항 코드 (공항이면 넣어 주세요. 항공권과 연결됩니다)</span><input id="pf-code" value="${esc(p.code)}" maxlength="4" placeholder="예: HKG" autocapitalize="characters"></label>
      <label class="fld"><span>주소</span><input id="pf-addr" value="${esc(p.addr)}" maxlength="200"></label>
      <fieldset class="hours"><legend>운영시간 (현지 시각)<small>예: 10:00-18:00, 휴무, 24시간, 11:00-15:00, 17:30-22:00. 비워 두면 확인 필요로 표시됩니다.</small></legend>
        ${WEEK_ORDER.map(wd => `<label class="hrow"><span>${WD[wd]}</span><input data-wd="${wd}" value="${esc(hoursText(h[wd]))}" placeholder="확인 필요" aria-label="${WD[wd]}요일 운영시간"></label>`).join('')}
        <button type="button" class="btn ghost sm" id="pf-copy">월요일 값을 모든 요일에 적용</button></fieldset>
      <label class="fld"><span>운영시간 참고</span><textarea id="pf-hnote" rows="2" maxlength="600" placeholder="마지막 입장, 공휴일 운영 등">${esc(p.hoursNote)}</textarea></label>
      <div class="row2"><label class="fld"><span>운영시간 확인</span><select id="pf-verify"><option value="none" ${p.verify === 'none' ? 'selected' : ''}>확인 필요</option><option value="official" ${p.verify === 'official' ? 'selected' : ''}>공식 출처에서 확인</option><option value="other" ${p.verify === 'other' ? 'selected' : ''}>기타 출처에서 확인</option></select></label>
        <label class="fld"><span>확인한 날</span><input type="date" id="pf-checked" value="${esc(p.checked)}"></label></div>
      <label class="fld"><span>출처 주소</span><input id="pf-source" type="url" value="${esc(p.source)}" placeholder="https://"></label>
      <label class="fld"><span>요금</span><input id="pf-fee" value="${esc(p.fee)}" maxlength="300" placeholder="예: 성인 HK$82"></label>
      <label class="fld"><span>웹사이트</span><input id="pf-url" type="url" value="${esc(p.url)}" placeholder="https://"></label>
      <label class="fld"><span>메모</span><textarea id="pf-memo" rows="3" maxlength="1000">${esc(p.memo)}</textarea></label>
      <p class="err" id="pf-err" hidden></p>
      <div class="mf">${editId ? `<button type="button" class="btn danger ghost" id="pf-del">${icon('trash')}삭제</button>` : ''}<span class="sp"></span>
        <button type="button" class="btn ghost" data-close>취소</button><button type="submit" class="btn primary">저장</button></div>
    </form>`, c => {
    $('#pf-cat', c).onchange = e => { $('#pf-code-wrap').hidden = e.target.value !== 'transport'; };
    $('#pf-copy', c).onclick = () => { const v = $('[data-wd="1"]', c).value; $$('[data-wd]', c).forEach(i => { i.value = v; }); };
    if (editId) {
      $('#pf-move', c).onclick = () => startPick({ mode: 'move', pid: editId, latlng: [p.lat, p.lng] });
      $('#pf-del', c).onclick = () => deletePlace(editId);
    }
    $('#pf', c).onsubmit = e => { e.preventDefault(); savePlace(editId); };
  });
}
function savePlace(editId) {
  const err = $('#pf-err'), fail = m => { err.hidden = false; err.textContent = m; err.scrollIntoView({ block: 'nearest' }); };
  const name = $('#pf-name').value.trim();
  if (!name) return fail('이름을 넣어 주세요.');
  const lat = parseFloat($('#pf-lat').value), lng = parseFloat($('#pf-lng').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('위도는 -90에서 90, 경도는 -180에서 180 사이 숫자로 넣어 주세요.');
  const hours = Array(7).fill(null); let bad = false;
  $$('[data-wd]').forEach(i => { const r = parseHoursText(i.value); i.classList.toggle('bad', !r.ok); if (!r.ok) bad = true; else hours[+i.dataset.wd] = r.v; });
  if (bad) return fail('운영시간 형식을 확인해 주세요. 예: 10:00-18:00 또는 휴무');
  const data = {
    name, nameLocal: $('#pf-local').value.trim(), cat: $('#pf-cat').value, code: $('#pf-cat').value === 'transport' ? $('#pf-code').value.trim().toUpperCase() : '',
    lat, lng, addr: $('#pf-addr').value.trim(), hours: hours.every(v => v == null) ? null : hours, hoursNote: $('#pf-hnote').value.trim(),
    verify: $('#pf-verify').value, checked: $('#pf-checked').value, source: $('#pf-source').value.trim(), fee: $('#pf-fee').value.trim(),
    url: $('#pf-url').value.trim(), memo: $('#pf-memo').value.trim(), dur: +$('#pf-dur').value, sample: false,
  };
  const t = T();
  let id = editId;
  if (editId) { const x = t.places.find(z => z.id === editId); if (x) Object.assign(x, normPlace(Object.assign({}, x, data, { id: editId }))); }
  else { const np = normPlace(Object.assign({ id: uid() }, data)); np.exc = []; t.places.push(np); id = np.id; }
  closeModal(); commit();
  toast(editId ? '장소를 고쳤습니다.' : `${name}을(를) 추가했습니다.`);
  if (!editId) focusPlace(id); else if (UI.sheet) refreshSheet(false);
}
function deletePlace(id) {
  const p = placeById(id); if (!p) return;
  const n = T().schedule.filter(s => s.placeId === id).length;
  confirmBox('장소 삭제', `${esc(p.name)}을(를) 지웁니다.${n ? ` 시간표에 있는 이 장소의 일정 ${n}개도 함께 지워집니다.` : ''}`, '삭제', () => {
    const snap = snapshot(), t = T();
    t.places = t.places.filter(x => x.id !== id);
    t.schedule = t.schedule.filter(s => s.placeId !== id);
    if (UI.sheet && (UI.sheet.a === id || UI.sheet.b === id)) closeSheet();
    commit();
    toast(`${p.name}을(를) 지웠습니다.`, { label: '되돌리기', fn: () => restore(snap) });
  });
}
