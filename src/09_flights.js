
/* ===== 항공권 ===== */
const TZ_NAMES = { 9: '한국·일본', 8: '홍콩·대만·싱가포르·중국', 7: '태국·베트남', 5.5: '인도' };
const TZ_LIST = [-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 9, 9.5, 10, 10.5, 11, 12, 13, 14];
const tzOptions = sel => TZ_LIST.map(v => `<option value="${v}" ${v === sel ? 'selected' : ''}>${tzLabel(v)}${TZ_NAMES[v] ? ' ' + TZ_NAMES[v] : ''}</option>`).join('');
function getK(o, k) { return k.split('.').reduce((a, x) => a == null ? '' : a[x], o) ?? ''; }
function setK(o, k, v) { const ks = k.split('.'), last = ks.pop(); ks.reduce((a, x) => a[x], o)[last] = v; }
function tzDiffText(h) { if (!h) return '시차 없음'; return `도착지가 ${fmtHours(h)} ${h > 0 ? '빠름' : '느림'}`; }
function boardHTML(f) {
  const sp = flightSpan(f), t = T();
  const arrDate = f.arrDate || (sp && sp.arr != null ? fromDayNum(Math.floor((sp.arr + f.to.tz * 60) / 1440)) : '');
  let note = '', bad = false;
  if (!f.depTime || !f.arrTime) note = '출발·도착 시각을 넣으면 시간표에 자동으로 표시됩니다.';
  else if (sp.dur <= 0 || sp.dur > 24 * 60) { note = '도착 날짜와 시각을 확인해 주세요. 비행시간이 맞지 않습니다.'; bad = true; }
  else if (f.to.tz !== t.homeTz) note = `출발지(${tzLabel(t.homeTz)}) 시각으로는 ${fmtHM((toMin(f.arrTime) + (t.homeTz - f.to.tz) * 60 + 1440) % 1440)}에 도착합니다.`;
  else if (f.from.tz !== t.homeTz) note = `현지 출발 시각은 출발지(${tzLabel(t.homeTz)}) 시각으로 ${fmtHM((toMin(f.depTime) + (t.homeTz - f.from.tz) * 60 + 1440) % 1440)}입니다.`;
  const flt = [f.airline, f.no].filter(Boolean).join(' ');
  return `<div class="fb-top"><span><b>${esc(f.label || '항공편')}</b>${flt ? ' · ' + esc(flt) : ''}</span><span>${[f.from.term && `출발 ${esc(f.from.term)}`, f.to.term && `도착 ${esc(f.to.term)}`].filter(Boolean).join(' · ')}</span></div>
    <div class="fb-row">
      <div class="fb-end"><span class="fb-code">${esc(f.from.code || '---')}</span><span class="fb-time ${f.depTime ? '' : 'empty'}">${f.depTime || '--:--'}</span><span class="fb-date">${f.depDate ? dayLabel(f.depDate) : '날짜 미입력'}${f.from.name ? ' · ' + esc(f.from.name) : ''}</span></div>
      <div class="fb-mid"><span class="fb-dur">${sp && sp.dur > 0 && sp.dur <= 1440 ? fmtDur(sp.dur) : '비행시간'}</span><span class="fb-track">${icon('plane')}</span><span>${tzDiffText(f.to.tz - f.from.tz)}</span></div>
      <div class="fb-end r"><span class="fb-code">${esc(f.to.code || '---')}</span><span class="fb-time ${f.arrTime ? '' : 'empty'}">${f.arrTime || '--:--'}</span><span class="fb-date">${arrDate ? dayLabel(arrDate) : '날짜 미입력'}${sp && sp.nextDay ? ` +${sp.nextDay}` : ''}${f.to.name ? ' · ' + esc(f.to.name) : ''}</span></div>
    </div>${note ? `<p class="fb-note ${bad ? 'bad' : ''}">${note}</p>` : ''}`;
}
function flightCardHTML(f) {
  const inp = (k, label, type = 'text', extra = '') => `<label class="fld"><span>${label}</span><input type="${type}" data-k="${k}" value="${esc(getK(f, k))}" ${extra}></label>`;
  const tzSel = (k, label) => `<label class="fld"><span>${label}</span><select data-k="${k}" data-num="1">${tzOptions(getK(f, k))}</select></label>`;
  return `<article class="fcard" data-fid="${f.id}" id="fc-${f.id}"><div class="fboard" id="fb-${f.id}">${boardHTML(f)}</div>
    <div class="fform">
      <div class="row3">${inp('label', '구분', 'text', 'maxlength="20" placeholder="가는 편"')}${inp('airline', '항공사', 'text', 'maxlength="40"')}${inp('no', '편명', 'text', 'maxlength="12" placeholder="예: OZ745" autocapitalize="characters"')}</div>
      <h4>출발</h4>
      <div class="row3">${inp('from.code', '공항 코드', 'text', 'maxlength="4" autocapitalize="characters"')}${inp('from.name', '공항 이름', 'text', 'maxlength="40"')}${inp('from.term', '터미널', 'text', 'maxlength="20"')}</div>
      <div class="row2">${inp('depDate', '날짜', 'date')}${inp('depTime', '시각 (현지)', 'time')}</div>
      ${tzSel('from.tz', '시간대')}
      <h4>도착</h4>
      <div class="row3">${inp('to.code', '공항 코드', 'text', 'maxlength="4" autocapitalize="characters"')}${inp('to.name', '공항 이름', 'text', 'maxlength="40"')}${inp('to.term', '터미널', 'text', 'maxlength="20"')}</div>
      <div class="row2">${inp('arrDate', '날짜 (비우면 자동)', 'date')}${inp('arrTime', '시각 (현지)', 'time')}</div>
      ${tzSel('to.tz', '시간대')}
      ${inp('memo', '메모 (좌석, 수하물 등)', 'text', 'maxlength="300"')}
      <div class="foot"><button type="button" class="btn danger ghost sm" data-action="del-flight" data-fid="${f.id}">${icon('trash')}이 항공편 삭제</button></div>
    </div></article>`;
}
function renderFlights() {
  const t = T(), diff = t.tz - t.homeTz;
  $('#flightBody').innerHTML = `<div class="ch" style="margin-bottom:8px"><h2 style="font-size:20px">항공권</h2><button class="btn sm" data-action="add-flight">${icon('plus')}항공편 추가</button></div>
    <p class="tzinfo">시각은 각 공항의 현지 시각으로 넣습니다. 여행지(${tzLabel(t.tz)})는 출발지(${tzLabel(t.homeTz)})보다 ${diff ? `${fmtHours(diff)} ${diff > 0 ? '빠릅니다' : '느립니다'}` : '시차가 없습니다'}.
    공항 코드가 장소 목록의 공항과 같으면 시간표에서 공항까지 이동시간이 이어집니다.</p>
    ${t.flights.map(flightCardHTML).join('') || '<div class="empty"><p>등록된 항공편이 없습니다.</p></div>'}`;
}
let flightSaveTimer;
function onFlightInput(e) {
  const el = e.target.closest('[data-k]'); if (!el) return;
  const card = el.closest('.fcard'), f = T().flights.find(x => x.id === card.dataset.fid); if (!f) return;
  let v = el.value;
  if (el.dataset.num) v = +v;
  else if (/code$/.test(el.dataset.k)) { v = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (el.value !== v) el.value = v; }
  setK(f, el.dataset.k, v);
  $('#fb-' + f.id).innerHTML = boardHTML(f);
  clearTimeout(flightSaveTimer);
  flightSaveTimer = setTimeout(() => { T().updatedAt = Date.now(); save(); renderPlan(); renderMarkers(); }, 350);
}
