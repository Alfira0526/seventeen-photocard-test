/**
 * env.js — 실행 환경 감지(프로덕션 vs 테스트베드) + 데이터 네임스페이스 + 경고 배너.
 *
 * 경로에 `/preview/` 가 포함되거나 `?preview=1` 이면 스테이징(테스트베드)으로 판단한다.
 *  - window.SVT_ENV         : "staging" | "prod"
 *  - window.SVT_DATA_PREFIX : 스테이징이면 "staging/" → Firebase 경로 접두사로 실데이터 오염 방지
 *
 * ranking.js / analytics.js / report.js 가 이 접두사를 사용한다. 반드시 그 스크립트들보다
 * 먼저 로드해야 하며, 값이 없을 때는 항상 빈 문자열("")로 폴백해 프로덕션 동작을 보존한다.
 */
(function (w, d) {
  "use strict";
  if (!w) return;
  var staging = false;
  try {
    staging = /(^|\/)preview(\/|$)/.test((w.location && w.location.pathname) || "") ||
              /[?&]preview=1\b/.test((w.location && w.location.search) || "");
  } catch (e) { staging = false; }
  w.SVT_ENV = staging ? "staging" : "prod";
  w.SVT_DATA_PREFIX = staging ? "staging/" : "";
  if (!staging || !d) return;

  function showBanner() {
    if (d.getElementById("svt-staging-banner")) return;
    var b = d.createElement("div");
    b.id = "svt-staging-banner";
    b.setAttribute("role", "status");
    b.textContent = "🧪 테스트베드(TEST) · 실제 랭킹과 분리된 미리보기 · TESTBED";
    b.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:99999",
      "background:#c8323d", "color:#fff", "text-align:center",
      "font:700 12.5px/1.6 system-ui,-apple-system,sans-serif",
      "padding:5px 10px", "letter-spacing:.02em",
    ].join(";");
    (d.body || d.documentElement).appendChild(b);
    try { if (d.body) d.body.style.paddingTop = "30px"; } catch (e) {}
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", showBanner);
  else showBanner();
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
