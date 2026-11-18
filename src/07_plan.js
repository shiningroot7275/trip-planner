
/* ===== 장소 목록 ===== */
function hoursSummary(p) {
  const days = tripDays(), seen = [], parts = [];
  for (const d of days) {
    const h = hoursOn(p, d), key = h.exc ? d : 'w' + weekday(d);
    if (seen.includes(key)) continue; seen.push(key);
    parts.push({ label: h.exc ? md(d) : WD[weekday(d)], v: h.v });
  }
  if (!parts.length || parts.every(x => x.v == null)) return '<span class="unk">운영시간 확인 필요</span>';
  const txt = parts.map(x => x.v == null ? '확인 필요' : fmtRanges(x.v));
  if (txt.every(x => x === txt[0])) return `여행 기간 매일 ${esc(txt[0])}`;
  return parts.map((x, i) => `${x.label} ${esc(txt[i])}`).join(' · ');
}
function renderPlaces() {
  const t = T(), counts = {};
  t.places.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  if (UI.filter !== 'all' && !counts[UI.filter]) UI.filter = 'all';
  $('#placeCount').textContent = t.places.length;
  $('#placeFilters').innerHTML = `<button class="fchip ${UI.filter === 'all' ? 'on' : ''}" data-filter="all">전체 <i>${t.places.length}</i></button>` +
    Object.keys(CATS).filter(k => counts[k]).map(k => `<button class="fchip ${UI.filter === k ? 'on' : ''}" data-filter="${k}" style="--c:${CATS[k].color}"><span class="dot"></span>${CATS[k].label} <i>${counts[k]}</i></button>`).join('');
  const days = tripDays(), list = t.places.filter(p => UI.filter === 'all' || p.cat === UI.filter);
  $('#placeList').innerHTML = list.length ? list.map(p => {
    const c = cat(p);
    const dn = [...new Set(t.schedule.filter(s => s.placeId === p.id).map(s => days.indexOf(s.date) + 1).filter(n => n > 0))].sort((a, b) => a - b);
    return `<article class="pcard"><button class="pc-main" data-action="focus" data-pid="${p.id}">
        <span class="badge-ic" style="--c:${c.color}">${icon(c.icon)}</span>
        <span class="pc-txt"><b>${esc(p.name)}${p.sample ? '<em class="tag">예시</em>' : ''}</b><small>${esc(c.label)}${p.nameLocal ? ' · ' + esc(p.nameLocal) : ''}</small>
        <span class="pc-hours">${hoursSummary(p)}</span>${dn.length ? `<span class="pc-days">${dn.map(n => `<i>${n}일차</i>`).join('')}</span>` : ''}</span></button>
      <div class="pc-act"><button class="icon-btn" data-action="sched" data-pid="${p.id}" aria-label="${esc(p.name)} 시간표에 추가" title="시간표에 추가">${icon('cal')}</button>
        <button class="icon-btn" data-action="edit" data-pid="${p.id}" aria-label="${esc(p.name)} 수정" title="수정">${icon('edit')}</button></div></article>`;
  }).join('') : `<div class="empty"><p>아직 장소가 없습니다. 지도에서 이름으로 찾거나, 지도를 길게 눌러 장소를 추가해 주세요.</p><button class="btn primary" data-action="add-place">${icon('plus')}장소 추가</button></div>`;
}

/* ===== 시간표 ===== */
const HOUR_PX = 56;
function layoutLanes(items) {
  let cluster = [], end = -1;
  const flush = () => { const lanes = []; for (const it of cluster) { let l = lanes.findIndex(e => e <= it.start); if (l < 0) { l = lanes.length; lanes.push(it.end); } else lanes[l] = it.end; it.lane = l; } cluster.forEach(it => { it.lanes = lanes.length; }); cluster = []; };
  for (const it of items) { if (cluster.length && it.start >= end) { flush(); end = -1; } cluster.push(it); end = Math.max(end, it.end); }
  if (cluster.length) flush();
}
function blockHTML(it, date) {
  const top = it.start / 60 * HOUR_PX, h = Math.max((it.end - it.start) / 60 * HOUR_PX, 24);
  const pos = `top:${top}px;height:${h - 2}px;--lane:${it.lane};--lanes:${it.lanes}`;
  if (it.kind === 'flight') {
    const f = it.f, nm = itemName(it);
    const dep = it.startsHere ? `${f.from.name || f.from.code} 출발` : '', arr = it.endsHere && !it.noArr ? `${f.to.name || f.to.code} 도착` : '';
    return `<div class="blk flight" data-fid="${f.id}" style="${pos}"><div class="blk-time">${fmtHM(it.start)}–${it.noArr ? '?' : fmtHM(it.end)}</div><div class="blk-name">${icon('plane')}<span>${esc(nm)}</span></div><div class="blk-memo">${esc([dep, arr].filter(Boolean).join(', '))}${it.noArr ? ' · 도착 시각 미입력' : ''}</div></div>`;
  }
  const p = it.place, c = cat(p), hc = hoursCheck(p, date, it.start, it.end);
  const warn = hc.state === 'outside' ? '운영시간 밖' : hc.state === 'closed' ? '휴무일' : '';
  return `<div class="blk" data-sid="${it.id}" style="${pos};--c:${c.color}" tabindex="0" role="button" aria-label="${esc(p.name)} ${fmtHM(it.start)}부터 ${fmtHM(it.end)}까지">
    <div class="blk-time">${fmtHM(it.start)}–${fmtHM(it.end)}</div><div class="blk-name">${icon(c.icon)}<span>${esc(p.name)}</span></div>
    ${warn ? `<div class="blk-warn">${icon('warn')}${warn}</div>` : ''}${it.s.memo ? `<div class="blk-memo">${esc(it.s.memo)}</div>` : ''}</div>`;
}
function connectorsHTML(items, multi) {
  let html = '', prev = items[0];
  for (let i = 1; i < items.length; i++) {
    const next = items[i], last = prev;
    if (next.end > prev.end) prev = next;
    if (next.start < last.end) continue;
    prev = next;
    const a = last.after, b = next.before;
    if (!a || !b || a.id === b.id || dist(a, b) < 40) continue;
    ensureRoutes(a, b, false);
    const rm = recMode(travel(a, b)), need = ceilMin(rm.min), gap = next.start - last.end, warn = gap < need;
    const gapPx = gap / 60 * HOUR_PX, tight = gapPx < 26;
    const y = tight ? next.start / 60 * HOUR_PX : (last.end + gap / 2) / 60 * HOUR_PX;
    const label = `${rm.mode === 'foot' ? '도보' : '대중교통'} ${rm.est ? '약 ' : ''}${fmtDur(need)}${warn ? ` · 간격 ${fmtDur(gap)}` : ''}`;
    html += `<button class="conn ${warn ? 'warn' : ''} ${tight ? 'tight' : ''}" style="top:${y}px" data-from="${a.id}" data-to="${b.id}" title="${esc(a.name)}에서 ${esc(b.name)}까지 ${esc(label)}${rm.est ? ' (추정)' : ''}">${icon(warn ? 'warn' : rm.mode === 'foot' ? 'walk' : 'transit')}<span class="l">${esc(label)}</span>${multi ? `<span>${need}분</span>` : ''}</button>`;
  }
  return html;
}
function colHTML(date, multi) {
  const items = dayItems(date);
  layoutLanes(items);
  let html = items.map(it => blockHTML(it, date)).join('') + connectorsHTML(items, multi);
  if (!items.length && !multi) html += `<div class="tt-empty" style="top:${9 * HOUR_PX}px">아래 장소를 끌어다 원하는 시각에 놓으면 일정이 생깁니다. 장소를 누르기만 해도 추가할 수 있습니다.</div>`;
  const now = tripNow();
  if (now.date === date) html += `<div class="now" style="top:${now.min / 60 * HOUR_PX}px"></div>`;
  return html;
}
function renderPlan() {
  const days = tripDays(), t = T();
  if (!UI.planDay || !days.includes(UI.planDay)) { const now = tripNow().date; UI.planDay = days.includes(now) ? now : days[0]; }
  const multi = UI.planAll, shown = multi ? days : [UI.planDay];
  $('#planDays').innerHTML = days.map((d, i) => `<button class="dtab ${!multi && d === UI.planDay ? 'on' : ''}" data-day="${d}"><small>${i + 1}일차</small><b>${md(d)}</b><small>${WD[weekday(d)]}요일</small></button>`).join('') +
    `<button class="dtab all ${multi ? 'on' : ''}" data-action="plan-all"><small>전체</small><b>${days.length}일</b><small>한눈에</small></button>`;
  const outside = t.schedule.filter(s => !days.includes(s.date)).length;
  $('#planNote').hidden = !outside;
  $('#planNote').textContent = outside ? `여행 기간 밖에 있는 일정이 ${outside}개 있습니다. 더보기 탭의 여행 날짜를 확인해 주세요.` : '';
  const tt = $('#tt'), keep = tt.scrollTop;
  let hours = '';
  for (let h = 1; h < 24; h++) hours += `<span style="top:${h * HOUR_PX}px">${pad(h)}:00</span>`;
  tt.innerHTML = `<div class="${multi ? 'multi' : ''}" style="--cols:${shown.length};--hp:${HOUR_PX}px">
    ${multi ? `<div class="tt-head"><div></div>${shown.map((d, i) => `<div>${i + 1}일차 ${md(d)}</div>`).join('')}</div>` : ''}
    <div class="tt-body" style="height:${24 * HOUR_PX}px"><div class="tt-gutter">${hours}</div>${shown.map(d => `<div class="tt-col" data-date="${d}">${colHTML(d, multi)}</div>`).join('')}</div></div>`;
  if (tt.offsetParent && !UI.ttInit) { UI.ttInit = true; scrollToFirst(); } else tt.scrollTop = keep;
  $$('.blk[data-sid]', tt).forEach(el => bindDrag(el, () => {
    const s = t.schedule.find(x => x.id === el.dataset.sid); if (!s) return null;
    const p = placeById(s.placeId), r = el.getBoundingClientRect();
    return { type: 'block', sid: s.id, dur: toMin(s.end) - toMin(s.start), grab: (DND.y0 - r.top) / HOUR_PX * 60, label: p.name, color: cat(p).color, ic: cat(p).icon, el };
  }));
  renderTray();
}
function scrollToFirst() {
  const tt = $('#tt'), days = UI.planAll ? tripDays() : [UI.planDay];
  const firsts = days.map(d => dayItems(d)[0]).filter(Boolean).map(it => it.start);
  const m = firsts.length ? Math.min(...firsts) : 9 * 60;
  tt.scrollTop = Math.max(0, (Math.min(m, 9 * 60) - 45) / 60 * HOUR_PX);
}
function renderTray() {
  const t = T(), tray = $('#tray');
  tray.classList.toggle('closed', !UI.trayOpen);
  tray.innerHTML = `<button class="tray-head" data-action="tray-toggle" aria-expanded="${UI.trayOpen}"><span>장소를 시간표로 끌어다 놓으세요<small>휴대폰에서는 장소를 길게 누르거나 위로 밀어 올린 뒤 움직입니다. 눌러서 바로 추가할 수도 있습니다.</small></span>${icon('chev')}</button>
    <div class="tray-list">${t.places.length ? t.places.map(p => {
      const c = cat(p), n = t.schedule.filter(s => s.placeId === p.id).length;
      return `<div class="chip-p" data-pid="${p.id}" style="--c:${c.color}" tabindex="0" role="button" aria-label="${esc(p.name)} 시간표에 추가"><span class="badge-ic" style="--c:${c.color}">${icon(c.icon)}</span><span>${esc(p.name)}</span>${n ? `<i>${n}</i>` : ''}</div>`;
    }).join('') : '<p class="muted small">장소 탭에서 장소를 먼저 추가해 주세요.</p>'}</div>`;
  $$('.chip-p', tray).forEach(el => bindDrag(el, () => {
    const p = placeById(el.dataset.pid); if (!p) return null;
    return { type: 'place', pid: p.id, dur: p.dur || cat(p).dur, grab: 15, label: p.name, color: cat(p).color, ic: cat(p).icon, el };
  }, true));
}

/* ===== 끌어다 놓기 (마우스와 손가락 모두) ===== */
const DND = { active: null, dirty: false, lastEnd: 0, x: 0, y: 0, y0: 0 };
function bindDrag(el, payloadFn, swipeUp) {
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY; let started = false;
    const mm = ev => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { DND.y0 = sy; const pl = payloadFn(); if (!pl) return; started = true; dndStart(pl, ev.clientX, ev.clientY); }
      if (started) dndMove(ev.clientX, ev.clientY);
    };
    const mu = ev => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); if (started) dndEnd(ev.clientX, ev.clientY); };
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    e.preventDefault();
  });
  el.addEventListener('touchstart', e => {
    if (e.touches.length > 1 || DND.active) return;
    const t0 = e.touches[0], sx = t0.clientX, sy = t0.clientY;
    let lx = sx, ly = sy, started = false, dead = false;
    const begin = () => { if (dead || started) return; DND.y0 = sy; const pl = payloadFn(); if (!pl) return; started = true; el.classList.remove('pressing'); dndStart(pl, lx, ly); };
    el.classList.add('pressing');
    const timer = setTimeout(begin, 340);
    const cleanup = () => { clearTimeout(timer); el.classList.remove('pressing'); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('touchcancel', tc); };
    const tm = ev => {
      const t = ev.touches[0]; lx = t.clientX; ly = t.clientY;
      if (!started) {
        const dx = lx - sx, dy = ly - sy;
        if (Math.hypot(dx, dy) > 10) {
          if (swipeUp && dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.2) begin();
          else { dead = true; cleanup(); return; }
        } else return;
      }
      ev.preventDefault(); dndMove(lx, ly);
    };
    const te = ev => { cleanup(); if (started) { ev.preventDefault(); dndEnd(lx, ly); } };
    const tc = () => { cleanup(); if (started) dndCancel(); };
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('touchcancel', tc);
  }, { passive: true });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function dndStart(pl, x, y) {
  const g = document.createElement('div');
  g.className = 'drag-ghost'; g.style.setProperty('--c', pl.color);
  g.innerHTML = `<span class="badge-ic" style="--c:${pl.color}">${icon(pl.ic)}</span>${esc(pl.label)}`;
  document.body.appendChild(g);
  const ind = document.createElement('div'); ind.className = 'drop-ind'; ind.innerHTML = '<span></span>';
  DND.active = { pl, g, ind, target: null, entered: false };
  if (pl.type === 'block') pl.el.classList.add('lifted');
  document.body.classList.add('dragging');
  if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* 진동 미지원 */ }
  dndMove(x, y);
  DND.raf = requestAnimationFrame(autoScroll);
}
function dndMove(x, y) {
  const A = DND.active; if (!A) return;
  DND.x = x; DND.y = y;
  A.g.style.transform = `translate(${Math.round(x - A.g.offsetWidth / 2)}px,${Math.round(y - A.g.offsetHeight - 18)}px)`;
  const tt = $('#tt'), r = tt.getBoundingClientRect();
  if (y > r.top + 70 && y < r.bottom - 70) A.entered = true;
  const el = document.elementFromPoint(x, y), col = el && el.closest ? el.closest('.tt-col') : null;
  if (!col) { A.ind.remove(); A.target = null; return; }
  const cr = col.getBoundingClientRect(), dur = Math.min(A.pl.dur, 1439);
  let start = Math.round(((y - cr.top) / HOUR_PX * 60 - A.pl.grab) / 15) * 15;
  start = clamp(start, 0, 1439 - dur);
  const end = start + dur;
  if (A.ind.parentNode !== col) col.appendChild(A.ind);
  A.ind.style.top = `${start / 60 * HOUR_PX}px`; A.ind.style.height = `${dur / 60 * HOUR_PX}px`;
  A.ind.firstChild.textContent = `${fmtHM(start)}–${fmtHM(end)}`;
  A.target = { date: col.dataset.date, start, end };
}
function autoScroll() {
  const A = DND.active; if (!A) return;
  const tt = $('#tt'), r = tt.getBoundingClientRect(), y = DND.y, zone = 56;
  let v = 0;
  if (y >= r.top && y < r.top + zone) v = -Math.ceil((r.top + zone - y) / 5);
  else if (A.entered && y <= r.bottom && y > r.bottom - zone) v = Math.ceil((y - (r.bottom - zone)) / 5);
  if (v) { const before = tt.scrollTop; tt.scrollTop += v; if (tt.scrollTop !== before) dndMove(DND.x, DND.y); }
  DND.raf = requestAnimationFrame(autoScroll);
}
function dndFinish() {
  const A = DND.active; if (!A) return null;
  cancelAnimationFrame(DND.raf);
  A.g.remove(); A.ind.remove();
  if (A.pl.el) A.pl.el.classList.remove('lifted');
  document.body.classList.remove('dragging');
  DND.active = null; DND.lastEnd = Date.now();
  return A;
}
function dndCancel() { dndFinish(); if (DND.dirty) { DND.dirty = false; renderAll(); } }
function dndEnd(x, y) {
  dndMove(x, y);
  const A = dndFinish(); if (!A) return;
  const tg = A.target;
  if (DND.dirty) { DND.dirty = false; renderAll(); }
  if (!tg) return;
  if (A.pl.type === 'place') return openScheduleModal({ placeId: A.pl.pid, date: tg.date, start: fmtHM(tg.start), end: fmtHM(tg.end) });
  const s = T().schedule.find(z => z.id === A.pl.sid); if (!s) return;
  if (s.date === tg.date && toMin(s.start) === tg.start) return;
  const snap = snapshot();
  s.date = tg.date; s.start = fmtHM(tg.start); s.end = fmtHM(tg.end);
  commit();
  toast(`${dayLabel(s.date)} ${s.start}–${s.end}로 옮겼습니다.`, { label: '되돌리기', fn: () => restore(snap) });
}
const recentlyDragged = () => Date.now() - DND.lastEnd < 400;
