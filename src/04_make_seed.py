"""홍콩 예시 장소 자료(JSON)를 플래너의 예시 자료(04_seed.js)로 바꾼다.

좌표, 운영시간, 주소, 공식 사이트, 출처, 확인일은 원본 JSON 값을 그대로 옮긴다.
첫 번째 원본(01, 처음 12곳)은 국문 이름, 국문 운영시간 참고, 요금 문구, 머무는 시간을 아래 KO 표에서 붙인다.
두 번째부터의 원본(02~)은 국문 항목(name_ko, hours_note_ko, fee_ko, memo_ko, dur)을 원본 안에 함께 적는다.
원본의 순서가 예시 장소 묶음(v)이 된다. 플래너는 이미 고친 일정에도 새 묶음만 한 번 넣어 준다(05_state.js).
사용: python -I 04_make_seed.py <출력 JS 경로> <원본 JSON 경로> [<원본 JSON 경로> ...]
"""
import json
import sys

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]  # 플래너는 0=일요일 순서를 쓴다

KO = {
    "hkg-t1": dict(name="홍콩국제공항 제1터미널", local="Hong Kong International Airport Terminal 1", code="HKG", dur=60,
        note="출입국 심사(제1터미널)는 24시간 운영합니다(홍콩 이민국). 상점, 식당, 공항철도는 각자 운영시간이 다릅니다.",
        fee=""),
    "peak-tram-garden-road": dict(name="피크트램 (가든로드 승강장)", local="The Peak Tram Garden Road Terminus", dur=30,
        note="매일 07:30–23:00, 마지막 트램 23:00 출발. 태풍 신호나 흑색 호우 경보, 예정 정비 때는 운행을 멈춥니다. 공식 사이트가 자동 접속을 막아 검색 색인으로 읽은 값이므로 출발 전에 공식 사이트에서 다시 확인하세요.",
        fee="성인 편도 HK$82, 왕복 HK$116 (3~11세, 65세 이상 편도 HK$52, 왕복 HK$75). 스카이 테라스 428 묶음권 성인 편도 HK$146, 왕복 HK$182"),
    "sky-terrace-428": dict(name="스카이 테라스 428 (피크 타워)", local="Sky Terrace 428", dur=60, verify="other",
        note="공식 사이트 안에서 값이 엇갈립니다. 상품·매표 페이지는 매일 08:30–22:00(2026년 5월 1일부터), 이용약관은 평일 10:00–22:00, 주말 08:00–22:00입니다. 더 최근 값인 08:30–22:00을 넣었습니다. 마지막 입장 시각은 공개되지 않았습니다.",
        fee="단독 입장 성인 HK$80 (2차 출처, 공식 사이트 미확인). 피크트램 묶음권 성인 편도 HK$146, 왕복 HK$182"),
    "star-ferry-tst": dict(name="스타페리 침사추이 선착장", local="Star Ferry Tsim Sha Tsui Pier", dur=30,
        note="센트럴과 침사추이 양쪽 모두 첫 배 06:30, 마지막 배 23:30. 배차 간격은 6~12분입니다.",
        fee="성인 평일 위층 HK$5.0, 아래층 HK$4.0 / 토·일·공휴일 위층 HK$6.5, 아래층 HK$5.6 (2027년 1월 24일까지 요금, 1월 25일부터 새 요금)"),
    "avenue-of-stars": dict(name="스타의 거리 (침사추이 해변 산책로)", local="Avenue of Stars", dur=60, verify="other",
        note="공식 사이트에는 운영시간이 없습니다. 24시간은 2차 출처와 레저문화서비스부(LCSD) 산책로 지정 구역 정보입니다. 심포니 오브 라이트는 2026년 11월 18일 마지막 공연으로 끝나 여행 기간에는 열리지 않습니다(홍콩 관광사무처).",
        fee=""),
    "temple-street-night-market": dict(name="템플 스트리트 야시장", local="Temple Street Night Market", dur=90, verify="other",
        note="시장 운영 주체가 공개한 시간은 없습니다. 14:00–23:00은 노점 허가 영업시간(2017년 입법회 자료)이며 노점마다 다릅니다. 붐비는 시간은 18:00–23:00 무렵입니다.",
        fee=""),
    "ladies-market": dict(name="레이디스 마켓 (여인가)", local="Ladies' Market", dur=90, verify="other",
        note="시장 운영 주체가 공개한 시간은 없습니다. 12:00–23:00은 노점 허가 영업시간(2017년 입법회 자료)이며 노점마다 다릅니다.",
        fee=""),
    "mid-levels-escalator": dict(name="미드레벨 에스컬레이터", local="Central–Mid-Levels Escalator", dur=30,
        note="06:00–10:00은 내려가는 방향, 10:00–24:00은 올라가는 방향으로만 운행합니다(홍콩 운수서). 구간별 보수로 일부가 멈출 수 있습니다.",
        fee="무료"),
    "man-mo-temple": dict(name="만모 사원 (문무묘)", local="Man Mo Temple", dur=45,
        note="평소 08:00–18:00, 음력 1일·15일과 명절은 07:00–18:00입니다.",
        fee="", exc_note="음력 12월 15일"),
    "m-plus": dict(name="M+ 뮤지엄", local="M+", dur=150,
        note="월요일 휴관(월요일 공휴일 포함). 금요일은 22:00까지 엽니다. 마지막 입장은 마감 30분 전이며, 태풍 신호 8호 이상이면 휴관합니다.",
        fee="일반 HK$190, 할인 HK$100, 6세 이하 무료"),
    "wong-tai-sin-temple": dict(name="웡타이신 사원 (황대선 사원)", local="Wong Tai Sin Temple", dur=60,
        note="사원은 매일 07:30–16:30(2020년 6월 1일부터). 음력 15일 연장 운영은 공식 사이트에 없어 확인되지 않았습니다.",
        fee="사원 무료, 태세원진전 HK$100"),
    "maxims-palace-city-hall": dict(name="맥심스 팰리스 (시티홀)", local="Maxim's Palace City Hall", dur=90,
        note="일요일·공휴일은 09:00부터 엽니다. 저녁 마감은 운영사 페이지 기준 23:00이며, 시티홀 안내 페이지(2022년 수정본)는 22:30입니다. 카트 딤섬은 점심에만 나온다는 2차 출처 정보가 있습니다. 전화 2521 1303",
        fee=""),
}
CAT = {k: k for k in ("sight", "food", "cafe", "bar", "shop", "transport")}


def hours7(h):
    return None if h is None else [h[d] for d in DAYS]


def from_v1(r):
    k = KO[r["id"]]
    verify = k.get("verify") or ("official" if r["verification"] == "official" else "other")
    exc = [{"date": e["date"], "hours": e["hours"], "note": k.get("exc_note", "")} for e in r.get("date_exceptions", [])]
    return {
        "id": r["id"], "name": k["name"], "nameLocal": k["local"], "cat": CAT[r["category"]], "code": k.get("code", ""),
        "lat": r["lat"], "lng": r["lng"], "addr": r["address_en"], "hours": hours7(r["hours"]), "exc": exc,
        "hoursNote": k["note"], "verify": verify, "source": r["source_url"], "checked": r["accessed"],
        "fee": k["fee"], "url": r["url"], "memo": f"중문 이름: {r['name_zh']}", "dur": k["dur"], "sample": True,
    }


def from_ko(r):
    memo = [r.get("memo_ko", "").strip()]
    if r.get("name_zh"):
        memo.append(f"중문 이름: {r['name_zh']}")
    exc = [{"date": e["date"], "hours": e["hours"], "note": e.get("note_ko", "")} for e in r.get("date_exceptions", [])]
    return {
        "id": r["id"], "name": r["name_ko"], "nameLocal": r["name_local"], "cat": CAT[r["category"]], "code": "",
        "lat": r["lat"], "lng": r["lng"], "addr": r["address_en"], "hours": hours7(r["hours"]), "exc": exc,
        "hoursNote": r["hours_note_ko"], "verify": r["verification"] if r["verification"] in ("official", "other", "none") else "other",
        "source": r["source_url"], "checked": r["accessed"], "fee": r.get("fee_ko", ""), "url": r["url"],
        "memo": "\n".join(m for m in memo if m), "dur": r["dur"], "sample": True,
    }


def main(out, srcs):
    places, seen = [], set()
    for v, src in enumerate(srcs, start=1):
        with open(src, encoding="utf-8") as f:
            rows = json.load(f)
        for r in rows:
            p = from_v1(r) if v == 1 else from_ko(r)
            if p["id"] in seen:
                raise SystemExit(f"duplicate id: {p['id']}")
            seen.add(p["id"])
            p["v"] = v
            places.append(p)
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* 홍콩 예시 장소: 04_make_seed.py가 원본 JSON에서 만든 파일 (직접 고치지 않는다). v는 예시 장소 묶음 차례 */\n")
        lines = ",\n".join(" " + json.dumps(p, ensure_ascii=False) for p in places)
        f.write("const SEED_PLACES = [\n" + lines + "\n];\n")
    print(f"{len(places)} places written to {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
