/**
 * report.js — 오류 제보 수집.
 *
 * 사용자가 "이 문제 이상해요"를 남기면 현재 문제 맥락과 함께 Firebase /reports 에 append.
 *   { text, ctx:{mode,typeId,cardKind,cardId,label,correct,choices}, locale, ua, ts, status:"open" }
 * 개인정보는 수집하지 않는다(자유 텍스트 + 문제 맥락 + 브라우저/로케일만).
 * 모인 제보는 GitHub Actions(ops-snapshot)가 스냅샷 → 주간 리뷰 루틴이 교차검증·수정.
 */
(function (root) {
  "use strict";
  if (!root) return;
  var cfg = root.SVTRankingConfig || {};
  var fb = cfg.firebase ? String(cfg.firebase).replace(/\/$/, "") : null;

  var api = {
    enabled: !!fb,
    // entry: { text, ctx } — 나머지 메타는 여기서 채움. 반환: Promise<boolean>
    submit: function (entry) {
      var payload = {
        text: String(entry && entry.text || "").slice(0, 1000),
        ctx: (entry && entry.ctx) || null,
        locale: (root.I18N && root.I18N.locale) || "",
        ua: (root.navigator && root.navigator.userAgent || "").slice(0, 200),
        ts: null,
        status: "open",
      };
      try { payload.ts = Date.now(); } catch (e) { payload.ts = 0; }
      if (!fb) { try { console.log("[report:local]", payload); } catch (e) {} return Promise.resolve(false); }
      try {
        return fetch(fb + "/reports.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(function (r) { return r.ok; }).catch(function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
  };
  root.SVTReport = api;
})(typeof window !== "undefined" ? window : null);
