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

  // 근접 연도 오답: 정답에 가까운 연도를 우선 오답으로 채운다(난이도↑).
  // years: 사용 가능한 전체 연도 배열. n개 보기(정답 포함) 반환.
  function buildYearChoices(correct, years, n, rnd) {
    const c = Number(correct);
    const others = [...new Set(years.map(Number))].filter((y) => y !== c);
    // |연도차| 오름차순 → 가까운 연도부터. 동일 거리엔 약간의 무작위.
    others.sort((a, b) => {
      const d = Math.abs(a - c) - Math.abs(b - c);
      return d !== 0 ? d : (rnd || Math.random)() - 0.5;
    });
    const near = others.slice(0, Math.max(0, n - 1));
    return shuffle([c, ...near].map(String), rnd);
  }

  // 관련 앨범 오답: 같은 유형(type) 또는 인접 연도(±1) 앨범을 우선 오답으로.
  // albums: [{title,type,year}], correctAlbum: 정답 앨범 객체.
  function buildAlbumChoices(correctAlbum, albums, n, rnd) {
    const others = albums.filter((a) => a.title !== correctAlbum.title);
    const score = (a) => {
      let s = 0;
      if (a.type === correctAlbum.type) s += 2; // 같은 유형(미니/정규...)이면 헷갈림
      const dy = Math.abs((a.year || 0) - (correctAlbum.year || 0));
      s += Math.max(0, 3 - dy); // 연도 가까울수록 가점(0~3)
      return s;
    };
    const ranked = others
      .map((a) => ({ a, s: score(a) + (rnd || Math.random)() * 0.5 }))
      .sort((x, y) => y.s - x.s)
      .map((o) => o.a.title);
    const picked = ranked.slice(0, Math.max(0, n - 1));
    return shuffle([correctAlbum.title, ...picked], rnd);
  }

  // 정답률(0~100)로 등급 산출
  function tierFor(pct) {
    if (pct >= 90) return "🏆 찐 캐럿, 인정!";
    if (pct >= 70) return "💎 진성 캐럿이네요";
    if (pct >= 40) return "🌱 입덕 준비 완료";
    return "👀 이제 입덕각이에요";
  }

  const api = { shuffle, buildChoices, buildYearChoices, buildAlbumChoices, tierFor };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.QuizLogic = api;
})(typeof window !== "undefined" ? window : null);
