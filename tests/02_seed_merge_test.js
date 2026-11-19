// 예시 장소 묶음 넣기(addNewSeedPlaces)와 공유 링크 압축·복원(packTrip, unpackTrip) 시험.
// 저장소 맨 위 폴더에서 실행한다: node tests/02_seed_merge_test.js
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');
const cut = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b); if (i < 0 || j < 0) throw new Error(`구간을 찾지 못했습니다: ${a}`); return s.slice(i, j); };
const state = cut(read('05_state.js'), '/* ===== 처음 여는 사람에게', 'let S = (function load()');
const share = cut(read('10_more.js'), 'const SEED_PLACE_OBJ', 'function bytesToB64url');
const api = new Function(`${read('03_core.js')}\n${read('04_seed.js')}\n${state}\n${share}\nreturn { normTrip, normPlace, CATS, SEED_PLACES, SEED_VER, SEED_TRIP, addNewSeedPlaces, packTrip, unpackTrip };`)();
const { normTrip, normPlace, CATS, SEED_PLACES, SEED_VER, SEED_TRIP, addNewSeedPlaces, packTrip, unpackTrip } = api;

let fail = 0, n = 0;
const ok = (label, cond) => { n++; if (!cond) fail++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); };
const clone = x => JSON.parse(JSON.stringify(x));
const v1 = SEED_PLACES.filter(p => (p.v || 1) === 1), later = SEED_PLACES.filter(p => (p.v || 1) > 1);

ok(`예시 장소 ${SEED_PLACES.length}곳이 모두 자료 정리를 통과`, SEED_PLACES.every(p => normPlace(p)));
ok('예시 장소 이름표가 겹치지 않음', new Set(SEED_PLACES.map(p => p.id)).size === SEED_PLACES.length);
ok('예시 장소 분류가 모두 정해진 분류', SEED_PLACES.every(p => CATS[p.cat] && p.cat !== 'etc'));
ok('예시 장소 운영시간이 7일치이거나 비어 있음', SEED_PLACES.every(p => p.hours === null || p.hours.length === 7));
ok(`처음 여는 여행은 묶음 ${SEED_VER}까지 모두 담음`, (() => { const t = normTrip(SEED_TRIP); return t.seedVer === SEED_VER && t.places.length === SEED_PLACES.length; })());

/* 예전 버전에서 고친 여행: 처음 12곳 중 하나를 지우고 하나를 고쳤다 */
const old = normTrip(Object.assign(clone(SEED_TRIP), { places: clone(v1), updatedAt: 1763500000000 }));
delete old.seedVer; const oldT = normTrip(old);
oldT.places = oldT.places.filter(p => p.id !== 'ladies-market');
oldT.places[0].memo = '내가 고친 메모';
ok('예전 여행은 묶음 1로 읽음', oldT.seedVer === 1);
const added = addNewSeedPlaces(oldT);
ok(`새 묶음 ${later.length}곳을 넣음 (넣은 수 ${added})`, added === later.length);
ok('지운 예시 장소는 다시 생기지 않음', !oldT.places.some(p => p.id === 'ladies-market'));
ok('고친 메모는 그대로', oldT.places[0].memo === '내가 고친 메모');
ok('묶음 차례가 최신으로 바뀜', oldT.seedVer === SEED_VER);
ok('두 번째에는 넣지 않음', addNewSeedPlaces(oldT) === 0);
if (later.length) {
  oldT.places = oldT.places.filter(p => p.id !== later[0].id);
  ok('새로 넣은 장소를 지운 뒤에도 다시 생기지 않음', addNewSeedPlaces(oldT) === 0 && !oldT.places.some(p => p.id === later[0].id));
}
ok('다른 여행에는 넣지 않음', addNewSeedPlaces(normTrip({ id: 'other', name: '제주', places: [] })) === 0);

/* 공유 링크 자료: 압축한 뒤 복원하면 같은 여행 */
const back = normTrip(unpackTrip(JSON.parse(JSON.stringify(packTrip(oldT)))));
ok('압축 뒤 복원하면 같은 여행', JSON.stringify(back) === JSON.stringify(normTrip(oldT)));
const packed = packTrip(normTrip(SEED_TRIP));
ok('고치지 않은 예시 장소는 이름표만 보냄', packed.places.every(p => p.ref && !p.d));
let threw = '';
try { unpackTrip({ places: [{ ref: 'not-in-this-version' }], schedule: [], checklist: [] }); } catch (e) { threw = e.message; }
ok('모르는 예시 장소 이름표는 새 버전 링크로 알림', threw === 'newer');
const kept = unpackTrip({ places: [{ ref: 'not-in-this-version', d: { name: 'x', lat: 22.3, lng: 114.1 } }], schedule: [], checklist: [] });
ok('달라진 항목이 있으면 그 자료로 살림', kept.places.length === 1 && kept.places[0].id === 'not-in-this-version');

console.log(fail ? `\n실패 ${fail}건` : `\n모두 통과 (${n}건)`);
process.exit(fail ? 1 : 0);
