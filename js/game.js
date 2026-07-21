/**
 * SEVENTEEN Photocard Quiz — 게임 엔진
 *
 * 한 라운드 = 카드 1장 + 3개의 하위 문제(멤버 / 앨범 / 발매년도).
 * 각 하위 문제는 4지선다이며, 정답당 점수를 부여한다(부분 점수 허용).
 */
(function () {
  "use strict";

  const { MEMBERS, ALBUMS, CARDS, memberById, albumById, ALBUM_YEARS } =
    window.SVTData;

  // ── 설정 ──
  const CONFIG = {
    rounds: 8, // 한 판당 카드 수
    pointsPerCorrect: 10, // 하위 문제 1개 정답당 점수
    choices: 4, // 보기 개수
  };

  // ── 상태 ──
  const state = {
    deck: [], // 이번 판에 낼 카드 순서
    round: 0, // 현재 라운드 인덱스(0-base)
    score: 0,
    answers: [], // 라운드별 채점 결과 기록
    locked: false, // 채점 후 재클릭 방지
  };

  // ── 유틸: 배열 셔플(Fisher–Yates) ──
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── 유틸: 정답 + 오답 후보에서 n지선다 보기 생성 ──
  function buildChoices(correct, pool, n) {
    const distractors = shuffle(pool.filter((x) => x !== correct)).slice(0, n - 1);
    return shuffle([correct, ...distractors]);
  }

  // ── 플레이스홀더 카드 아트: 실제 이미지가 없을 때 SVG 생성 ──
  // 정답 노출을 막기 위해 멤버명/앨범명은 넣지 않고 추상 그라데이션만 사용한다.
  function placeholderArt(card) {
    const m = memberById[card.member];
    const seed = card.id
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const angle = seed % 360;
    const c1 = m.color;
    const c2 = shadeColor(m.color, -35);
    return `
      <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="포토카드">
        <defs>
          <linearGradient id="g-${card.id}" gradientTransform="rotate(${angle})">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="300" height="420" rx="14" fill="url(#g-${card.id})"/>
        <circle cx="150" cy="165" r="70" fill="rgba(255,255,255,0.14)"/>
        <circle cx="150" cy="135" r="34" fill="rgba(255,255,255,0.22)"/>
        <rect x="96" y="215" width="108" height="120" rx="54" fill="rgba(255,255,255,0.18)"/>
        <text x="150" y="392" text-anchor="middle" font-size="15"
              fill="rgba(255,255,255,0.55)" font-family="sans-serif">PHOTOCARD</text>
      </svg>`;
  }

  // 색상 밝기 조절(그라데이션 대비용)
  function shadeColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + Math.round((255 * percent) / 100);
    let g = ((num >> 8) & 0xff) + Math.round((255 * percent) / 100);
    let b = (num & 0xff) + Math.round((255 * percent) / 100);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // ── DOM 참조 ──
  const el = {};
  function cacheDom() {
    [
      "screen-start", "screen-play", "screen-result",
      "btn-start", "btn-restart", "btn-next",
      "card-art", "progress", "score",
      "q-member", "q-album", "q-year",
      "feedback", "result-score", "result-detail",
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }

  // ── 화면 전환 ──
  function show(screen) {
    ["screen-start", "screen-play", "screen-result"].forEach((s) =>
      el[s].classList.toggle("active", s === screen)
    );
  }

  // ── 게임 시작 ──
  function startGame() {
    state.deck = shuffle(CARDS).slice(0, Math.min(CONFIG.rounds, CARDS.length));
    state.round = 0;
    state.score = 0;
    state.answers = [];
    show("screen-play");
    renderRound();
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    state.locked = false;
    const card = state.deck[state.round];
    const m = memberById[card.member];
    const alb = albumById[card.album];

    // 카드 이미지(있으면 <img>, 없으면 SVG 플레이스홀더)
    el["card-art"].innerHTML = card.image
      ? `<img src="${card.image}" alt="포토카드" />`
      : placeholderArt(card);

    // 진행/점수
    el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;
    el.score.textContent = state.score;

    // 문제 3개 렌더
    renderQuestion(
      "q-member", "이 포토카드의 멤버는?",
      m.name,
      buildChoices(m.name, MEMBERS.map((x) => x.name), CONFIG.choices),
      "member"
    );
    renderQuestion(
      "q-album", "이 포토카드가 수록된 앨범은?",
      alb.title,
      buildChoices(alb.title, ALBUMS.map((x) => x.title), CONFIG.choices),
      "album"
    );
    renderQuestion(
      "q-year", "이 앨범의 발매 연도는?",
      alb.year,
      buildChoices(alb.year, ALBUM_YEARS, CONFIG.choices),
      "year"
    );

    el.feedback.textContent = "";
    el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    el["btn-next"].textContent =
      state.round + 1 === state.deck.length ? "결과 보기" : "다음 카드 →";
  }

  // ── 문제 하나 렌더 ──
  function renderQuestion(containerId, label, correct, choices, key) {
    const container = el[containerId];
    container.dataset.answered = "false";
    container.dataset.result = "";
    container.dataset.key = key;
    container.innerHTML =
      `<p class="q-label">${label}</p>` +
      `<div class="choices">` +
      choices
        .map(
          (c) =>
            `<button type="button" class="choice" data-value="${c}">${c}</button>`
        )
        .join("") +
      `</div>`;

    container.querySelectorAll(".choice").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectChoice(container, btn, correct)
      );
    });
    container._correct = correct;
  }

  // ── 보기 선택(문제별로 1회) ──
  function selectChoice(container, btn, correct) {
    if (container.dataset.answered === "true") return;
    container.dataset.answered = "true";

    const chosen = btn.dataset.value;
    const isCorrect = String(chosen) === String(correct);
    container.dataset.result = isCorrect ? "correct" : "wrong";
    if (isCorrect) state.score += CONFIG.pointsPerCorrect;

    container.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      if (String(b.dataset.value) === String(correct)) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });

    el.score.textContent = state.score;
    maybeFinishRound();
  }

  // ── 세 문제 모두 풀리면 다음 버튼 활성화 ──
  function maybeFinishRound() {
    const all = ["q-member", "q-album", "q-year"].every(
      (id) => el[id].dataset.answered === "true"
    );
    if (!all || state.locked) return;
    state.locked = true;

    // 라운드 채점 기록
    const card = state.deck[state.round];
    const m = memberById[card.member];
    const alb = albumById[card.album];
    const got = {
      member: el["q-member"].dataset.result === "correct",
      album: el["q-album"].dataset.result === "correct",
      year: el["q-year"].dataset.result === "correct",
    };
    state.answers.push({ card, got });

    const hit = Object.values(got).filter(Boolean).length;
    el.feedback.textContent =
      hit === 3 ? "🎉 3문제 모두 정답!" : `이 카드에서 ${hit} / 3 정답`;
    el.feedback.className = "feedback " + (hit === 3 ? "good" : "mid");
    el["btn-next"].disabled = false;
  }

  // ── 다음 라운드 / 결과 ──
  function nextRound() {
    if (state.round + 1 < state.deck.length) {
      state.round++;
      renderRound();
    } else {
      showResult();
    }
  }

  // ── 결과 화면 ──
  function showResult() {
    const max = state.deck.length * 3 * CONFIG.pointsPerCorrect;
    el["result-score"].textContent = `${state.score} / ${max} 점`;

    const totalHits = state.answers.reduce(
      (acc, a) => acc + Object.values(a.got).filter(Boolean).length,
      0
    );
    const totalQs = state.deck.length * 3;
    const pct = Math.round((totalHits / totalQs) * 100);

    let tier;
    if (pct >= 90) tier = "🏆 캐럿 마스터";
    else if (pct >= 70) tier = "💎 진성 캐럿";
    else if (pct >= 40) tier = "🌱 입덕 준비생";
    else tier = "👀 관심 단계";

    el["result-detail"].innerHTML =
      `<p class="tier">${tier}</p>` +
      `<p class="pct">정답률 ${pct}% (${totalHits}/${totalQs})</p>`;

    show("screen-result");
  }

  // ── 초기화 ──
  function init() {
    cacheDom();
    el["btn-start"].addEventListener("click", startGame);
    el["btn-restart"].addEventListener("click", startGame);
    el["btn-next"].addEventListener("click", nextRound);
    show("screen-start");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
