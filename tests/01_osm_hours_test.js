// OpenStreetMap 운영시간 읽기(parseOSMHours) 시험. 저장소 맨 위 폴더에서 실행한다: node tests/01_osm_hours_test.js
// 실제 표기는 2026-11-19 OpenStreetMap에서 가져온 홍콩 장소 10곳의 opening_hours 값이다 (© OpenStreetMap 기여자, ODbL).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'src');
const core = fs.readFileSync(path.join(src, '03_core.js'), 'utf8');
const mapJs = fs.readFileSync(path.join(src, '06_map.js'), 'utf8');
const block = mapJs.slice(mapJs.indexOf('/* OSM-HOURS-START */'), mapJs.indexOf('/* OSM-HOURS-END */'));
if (!block) throw new Error('parseOSMHours 구간을 찾지 못했습니다');
const { parseOSMHours, fmtRanges } = new Function(`${core}\n${block}\nreturn { parseOSMHours, fmtRanges };`)();

const f = h => (h === null ? 'NULL' : [1, 2, 3, 4, 5, 6, 0].map(d => (h[d] == null ? '?' : fmtRanges(h[d]))).join(' | '));
// [표기, 기대값(월~일 순서, 읽지 못하면 'NULL'), 설명]
const CASES = [
  ['Su-Fr 10:00-21:30; Sa 09:00-22:00', '10:00–21:30 | 10:00–21:30 | 10:00–21:30 | 10:00–21:30 | 10:00–21:30 | 09:00–22:00 | 10:00–21:30', '팀호완 삼수이포'],
  ['Mo-Su,PH 11:30-21:00', '11:30–21:00 | 11:30–21:00 | 11:30–21:00 | 11:30–21:00 | 11:30–21:00 | 11:30–21:00 | 11:30–21:00', '막스 누들'],
  ['Mo-Su,PH 11:30-21:30', '11:30–21:30 | 11:30–21:30 | 11:30–21:30 | 11:30–21:30 | 11:30–21:30 | 11:30–21:30 | 11:30–21:30', '캄스 로스트 구스'],
  ['07:30-22:00; Th off', '07:30–22:00 | 07:30–22:00 | 07:30–22:00 | 휴무 | 07:30–22:00 | 07:30–22:00 | 07:30–22:00', '호주우유공사'],
  ['Mo-Su 07:00-18:00', '07:00–18:00 | 07:00–18:00 | 07:00–18:00 | 07:00–18:00 | 07:00–18:00 | 07:00–18:00 | 07:00–18:00', '란퐁유엔'],
  ['Mo-Fr 08:00-17:00; Sa,Su,PH 09:00-17:00', '08:00–17:00 | 08:00–17:00 | 08:00–17:00 | 08:00–17:00 | 08:00–17:00 | 09:00–17:00 | 09:00–17:00', 'Bakehouse'],
  ['Mo-Su 10:00-22:00', '10:00–22:00 | 10:00–22:00 | 10:00–22:00 | 10:00–22:00 | 10:00–22:00 | 10:00–22:00 | 10:00–22:00', '하버시티'],
  ['Mo,We-Th,Su 10:00-18:00 open "Ticket close 1h prior"; Fr,Sa 10:00-20:00 open "Ticket close 1h prior"; PH 10:00-20:00 open "LNY D1-2 off, Ticket close 1h prior"',
    '10:00–18:00 | 휴무 | 10:00–18:00 | 10:00–18:00 | 10:00–20:00 | 10:00–20:00 | 10:00–18:00', '홍콩 고궁박물관 (화요일 휴무)'],
  ['Mo-Su 09:00-16:30', '09:00–16:30 | 09:00–16:30 | 09:00–16:30 | 09:00–16:30 | 09:00–16:30 | 09:00–16:30 | 09:00–16:30', '치린 수녀원'],
  ['Mo-Su 07:00-21:00', '07:00–21:00 | 07:00–21:00 | 07:00–21:00 | 07:00–21:00 | 07:00–21:00 | 07:00–21:00 | 07:00–21:00', '난리안 가든'],
  ['Mo-Su 11:00-15:00,17:30-23:00', '11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00 | 11:00–15:00, 17:30–23:00', '하루 두 구간'],
  ['Mo-Sa 18:00-26:00', '18:00–02:00 | 18:00–02:00 | 18:00–02:00 | 18:00–02:00 | 18:00–02:00 | 18:00–02:00 | 휴무', '자정 넘김(26:00), 일요일 휴무'],
  ['24/7', '24시간 | 24시간 | 24시간 | 24시간 | 24시간 | 24시간 | 24시간', '24시간'],
  ['Mo-Fr 09:00-18:00; Sa unknown', '09:00–18:00 | 09:00–18:00 | 09:00–18:00 | 09:00–18:00 | 09:00–18:00 | ? | 휴무', '모름은 확인 필요'],
  ['PH off', 'NULL', '공휴일만 있는 표기'],
  ['Jan-Mar Mo-Fr 09:00-17:00', 'NULL', '월 지정'],
  ['sunrise-sunset', 'NULL', '일출·일몰'],
  ['Mo-Fr 10:00+', 'NULL', '끝 시각 없음'],
];

let fail = 0;
for (const [raw, want, label] of CASES) {
  const got = f(parseOSMHours(raw).hours);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     기대: ${want}\n     결과: ${got}`}`);
}
const ph = parseOSMHours('Mo-Su,PH 11:30-21:00');
if (!ph.holiday) { fail++; console.log('FAIL 공휴일 표시를 남기지 않음'); }
const note = parseOSMHours('Mo 10:00-18:00 open "A"; Tu 10:00-18:00 open "A"');
if (note.notes.length !== 1) { fail++; console.log('FAIL 같은 설명이 두 번 남음'); }
console.log(fail ? `\n실패 ${fail}건` : `\n모두 통과 (${CASES.length + 2}건)`);
process.exit(fail ? 1 : 0);
