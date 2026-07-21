/**
 * logic.js — 순수 게임 로직 (DOM/브라우저 비의존).
 * 브라우저에서는 window.QuizLogic, Node(테스트)에서는 module.exports 로 제공.
 * DOM 과 분리해 단위 테스트가 가능하도록 한다.
 */
(function (root) {
  "use strict";

  // Fisher–Yates 셔플(원본 불변)
  function shuffle(arr, rnd) {
    const rand = rnd || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 정답 1 + 오답 n-1 로 보기 생성. 항상 정답 포함, 중복 없음, 최대 n개.
  function buildChoices(correct, pool, n, rnd) {
    const distractors = [...new Set(pool.map(String))]
      .filter((x) => x !== String(correct));
    const picked = shuffle(distractors, rnd).slice(0, Math.max(0, n - 1));
    return shuffle([String(correct), ...picked], rnd);
  }

  // 정답률(0~100)로 등급 산출
  function tierFor(pct) {
    if (pct >= 90) return "🏆 캐럿 마스터";
    if (pct >= 70) return "💎 진성 캐럿";
    if (pct >= 40) return "🌱 입덕 준비생";
    return "👀 관심 단계";
  }

  const api = { shuffle, buildChoices, tierFor };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.QuizLogic = api;
})(typeof window !== "undefined" ? window : null);
