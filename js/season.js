/**
 * season.js — 시즌 스케줄(클라이언트 계산).
 *
 * 정적 사이트라 서버 스케줄러가 없으므로, 시작 기준일(anchor)과 시즌 길이(lenDays)를
 * 박아두고 브라우저의 현재 날짜와 비교해 "지금 몇 번째 시즌인지"를 계산한다.
 * 4주(28일)마다 자동으로 다음 시즌으로 롤오버되고, 직전 시즌은 챔피언/레거시로 남는다.
 *
 *  · 시즌2가 첫 정식 시즌(그 이전 = 오픈베타, 접미사 없음)
 *  · 종료 D-noticeDays 부터는 "막판 순위 굳히기" 강조(FOMO)
 *
 * 테스트/자동화 오버라이드:
 *  · window.__SVT_NOW           : 현재시각(ms) 고정
 *  · window.__SVT_SEASON_OVERRIDE: "s2" 처럼 활성 시즌 강제
 */
(function (root) {
  "use strict";
  if (!root) return;
  var DAY = 86400000;
  var CFG = {
    anchor: Date.parse("2026-07-26T00:00:00Z"), // 시즌2 시작 기준일
    lenDays: 28,     // 4주(월간 시즌)
    noticeDays: 3,   // 막판 강조 시작(D-3)
    firstNum: 2,     // 시즌2부터(그 이전=오픈베타)
  };
  function nowMs() {
    if (typeof root.__SVT_NOW === "number") return root.__SVT_NOW;
    try { return Date.now(); } catch (e) { return CFG.anchor; }
  }
  function activeNum() {
    var ov = root.__SVT_SEASON_OVERRIDE;
    if (typeof ov === "string" && /^s(\d+)$/.test(ov)) return parseInt(ov.slice(1), 10);
    var idx = Math.floor((nowMs() - CFG.anchor) / (CFG.lenDays * DAY));
    if (idx < 0) idx = 0;
    return CFG.firstNum + idx;
  }
  function byNum(num) {
    var start = CFG.anchor + (num - CFG.firstNum) * CFG.lenDays * DAY;
    return { beta: false, num: num, id: "s" + num, suffix: "_s" + num, start: start, end: start + CFG.lenDays * DAY };
  }
  function active() { return byNum(activeNum()); }
  function previous() {
    var num = activeNum();
    if (num <= CFG.firstNum) return { beta: true, id: "beta", suffix: "" };
    return byNum(num - 1);
  }
  function daysLeft() { return Math.max(0, Math.ceil((active().end - nowMs()) / DAY)); }
  function isFinalPush() { var d = daysLeft(); return d > 0 && d <= CFG.noticeDays; }

  root.SVTSeason = {
    CFG: CFG, nowMs: nowMs, active: active, previous: previous,
    daysLeft: daysLeft, isFinalPush: isFinalPush,
  };
})(typeof window !== "undefined" ? window : null);
