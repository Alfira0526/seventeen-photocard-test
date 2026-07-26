/**
 * season.js — 시즌 스케줄(캘린더 월 기준, 클라이언트 계산).
 *
 *  · 월간 시즌: 매월 1일 리셋 / 말일 종료. 저장키 접미사 = "_YYYYMM"(예: _202608).
 *    챔피언 = 직전 달 1위(직전 달 기록이 없으면 오픈베타=접미사 없음).
 *  · 분기 누적: 별도 리셋이 아니라 그 분기(3개월)의 월간 데이터를 합산한 "뷰".
 *    quarterMonths() 가 해당 분기의 월 접미사 목록을 준다.
 *  · 오픈베타: 월간 도입 이전의 구 기록(접미사 없음, "").
 *
 * 모두 UTC 기준(테스트 __SVT_NOW 와 일치). 막판(말일 D-noticeDays) 강조.
 *
 * 테스트/자동화 오버라이드:
 *  · window.__SVT_NOW : 현재시각(ms) 고정
 */
(function (root) {
  "use strict";
  if (!root) return;
  var DAY = 86400000;
  var CFG = { noticeDays: 3 }; // 말일 3일 전부터 '막판 순위 굳히기'

  function nowMs() {
    if (typeof root.__SVT_NOW === "number") return root.__SVT_NOW;
    try { return Date.now(); } catch (e) { return Date.UTC(2026, 6, 26); }
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function ymNow() { var d = new Date(nowMs()); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }

  function month(y, m) {
    return { y: y, m: m, ym: "" + y + pad2(m), suffix: "_" + y + pad2(m),
             start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
  }
  function active() { var n = ymNow(); return month(n.y, n.m); }
  function previous() { var n = ymNow(); var y = n.y, m = n.m - 1; if (m < 1) { m = 12; y--; } return month(y, m); }
  function daysLeft() { return Math.max(0, Math.ceil((active().end - nowMs()) / DAY)); }
  function isFinalPush() { var d = daysLeft(); return d > 0 && d <= CFG.noticeDays; }

  // 분기(1~4)와 그 분기 3개월의 접미사 목록(누적 뷰용)
  function quarterOf(m) { return Math.floor((m - 1) / 3) + 1; }
  function quarter() { var n = ymNow(); return { y: n.y, q: quarterOf(n.m) }; }
  function quarterMonths() {
    var n = ymNow(), q = quarterOf(n.m), first = (q - 1) * 3 + 1;
    return [first, first + 1, first + 2].map(function (mm) { return "_" + n.y + pad2(mm); });
  }

  root.SVTSeason = {
    CFG: CFG, nowMs: nowMs, active: active, previous: previous,
    daysLeft: daysLeft, isFinalPush: isFinalPush,
    quarter: quarter, quarterMonths: quarterMonths,
  };
})(typeof window !== "undefined" ? window : null);
