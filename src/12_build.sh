#!/bin/sh
# src 조각을 번호 순서대로 이어 붙여 한 개짜리 HTML(index.html)을 만든다.
cd "$(dirname "$0")"
cat 01_head.html 02_body.html 03_core.js 04_seed.js 05_state.js 06_map.js 07_plan.js 08_forms.js 09_flights.js 10_more.js 11_init.js | sed "s/__BUILD__/$(date +%Y%m%d%H%M)/" > ../index.html
