/**
 * season.js — 시즌 스케줄(캘린더 월 기준, 한국시간 KST 기준, 클라이언트 계산).
 *
 *  · 월간 시즌: 매월 1일 00:00 KST 시작 / 말일 23:59:59 KST 종료. 저장키 접미사 = "_YYYYMM".
 *    챔피언 = 직전 달 1위(직전 달 기록이 없으면 오픈베타=접미사 없음).
 *  · 분기 누적: 별도 리셋이 아니라 그 분기(3개월)의 월간 데이터를 합산한 "뷰".
 *    quarterMonths() 가 해당 분기의 월 접미사 목록을 준다.
 *  · 오픈베타: 월간 도입 이전의 구 기록(접미사 없음, "").
 *
 * 기준 시각은 KST(UTC+9). 시각 계산은 내부적으로 UTC ms 에 +9h 보정하여 한국 벽시계로 환산한다.
 * 공지(막판 강조)는 종료 noticeDays 일 전부터, 카운트다운은 종료 countdownMs 이내에 노출.
 *
 * 테스트/자동화 오버라이드:
 *  · window.__SVT_NOW : 현재시각(ms, UTC epoch) 고정
 */
(function (root) {
  "use strict";
  if (!root) return;
  var DAY = 86400000;
  var KST = 9 * 3600000; // 한국시간 오프셋(UTC+9)
  var CFG = { noticeDays: 2, countdownMs: 2 * 3600000 }; // 종료 2일 전 공지 / 종료 2시간 전 카운트다운

  function nowMs() {
    if (typeof root.__SVT_NOW === "number") return root.__SVT_NOW;
    try { return Date.now(); } catch (e) { return Date.UTC(2026, 6, 26); }
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  // KST 벽시계 기준 연/월 (UTC+9 보정)
  function ymNow() { var d = new Date(nowMs() + KST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }

  // start/end = KST 달력 경계의 실제 UTC 순간(= 'KST 00:00' - 9h)
  function month(y, m) {
    return { y: y, m: m, ym: "" + y + pad2(m), suffix: "_" + y + pad2(m),
             start: Date.UTC(y, m - 1, 1) - KST, end: Date.UTC(y, m, 1) - KST };
  }
  function active() { var n = ymNow(); return month(n.y, n.m); }
  function previous() { var n = ymNow(); var y = n.y, m = n.m - 1; if (m < 1) { m = 12; y--; } return month(y, m); }

  function msLeft() { return Math.max(0, active().end - nowMs()); }
  function daysLeft() { return Math.max(0, Math.ceil(msLeft() / DAY)); }
  function isFinalPush() { var d = daysLeft(); return d > 0 && d <= CFG.noticeDays; }
  // 종료 2시간 이내: 실시간 카운트다운 노출
  function isFinalCountdown() { var ms = msLeft(); return ms > 0 && ms <= CFG.countdownMs; }
  // 남은 시간 "H:MM:SS" (2시간 이내라 시(hour)는 0~1)
  function hms() {
    var s = Math.floor(msLeft() / 1000);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    return h + ":" + pad2(m) + ":" + pad2(s);
  }

  // 분기(1~4)와 그 분기 3개월의 접미사 목록(누적 뷰용)
  function quarterOf(m) { return Math.floor((m - 1) / 3) + 1; }
  function quarter() { var n = ymNow(); return { y: n.y, q: quarterOf(n.m) }; }
  function quarterMonths() {
    var n = ymNow(), q = quarterOf(n.m), first = (q - 1) * 3 + 1;
    return [first, first + 1, first + 2].map(function (mm) { return "_" + n.y + pad2(mm); });
  }

  root.SVTSeason = {
    CFG: CFG, nowMs: nowMs, active: active, previous: previous,
    msLeft: msLeft, daysLeft: daysLeft, isFinalPush: isFinalPush,
    isFinalCountdown: isFinalCountdown, hms: hms,
    quarter: quarter, quarterMonths: quarterMonths,
  };
})(typeof window !== "undefined" ? window : null);
