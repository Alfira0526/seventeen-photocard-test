/**
 * analytics.js — 익명 집계 텔레메트리(모드 이용률 · 정답률).
 *
 * 개인정보 없이 "카운터"만 Firebase Realtime DB에 원자적 증가(서버 increment)로 기록한다.
 *   /stats/modes/<mode>         : { plays, games }        (모드 시작/완료 수)
 *   /stats/types/<typeId>       : { ok, total }           (문제 유형별 정답/응답 수)
 *   /stats/items/<typeId__ref>  : { ok, total }           (개별 문제 정답/응답 수 → 이상문제 탐지)
 *   /stats/updated              : 마지막 기록 시각(서버 타임스탬프)
 *
 * Firebase 미설정(window.SVTRankingConfig.firebase 없음) 또는 네트워크 실패 시 조용히 무시.
 * 집계는 GitHub Actions(ops-snapshot)에서 주기적으로 스냅샷 → 리뷰 루틴이 분석한다.
 */
(function (root) {
  "use strict";
  if (!root) return;
  var cfg = root.SVTRankingConfig || {};
  var fb = cfg.firebase ? String(cfg.firebase).replace(/\/$/, "") : null;
  var INC = { ".sv": { increment: 1 } };

  function patch(path, body) {
    if (!fb) return;
    try {
      fetch(fb + path + ".json", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true, // 페이지 이탈 중에도 전송 시도
      }).catch(function () {});
    } catch (e) {}
  }
  // 키에 쓸 수 없는 문자(. $ # [ ] /) 제거
  var safe = function (s) { return String(s == null ? "" : s).replace(/[.#$\[\]\/]+/g, "_").slice(0, 80); };

  var api = {
    enabled: !!fb,
    play: function (mode) { patch("/stats/modes/" + safe(mode), { plays: INC }); patch("/stats", { updated: { ".sv": "timestamp" } }); },
    finish: function (mode) { patch("/stats/modes/" + safe(mode), { games: INC }); },
    answer: function (typeId, ok, itemKey) {
      var body = ok ? { ok: INC, total: INC } : { total: INC };
      patch("/stats/types/" + safe(typeId), body);
      if (itemKey) patch("/stats/items/" + safe(itemKey), body);
    },
  };
  root.SVTAnalytics = api;
})(typeof window !== "undefined" ? window : null);
