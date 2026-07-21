/**
 * SEVENTEEN Album-Jacket Quiz — 게임 엔진
 *
 * 한 라운드 = 앨범 자켓 1장 + 3개의 하위 문제(앨범 / 발매연도 / 타이틀곡).
 * 각 하위 문제는 4지선다이며, 정답당 점수를 부여한다(부분 점수 허용).
 */
(function () {
  "use strict";

  const { ALBUMS, ALBUM_YEARS } = window.SVTData;
  const { shuffle, buildChoices, tierFor } = window.QuizLogic;

  // ── 설정 ──
  const CONFIG = {
    rounds: Math.min(8, ALBUMS.length),
    pointsPerCorrect: 10,
    choices: 4,
  };

  // ── 상태(도메인 로직은 DOM과 분리해 이 객체에만 보관) ──
  const state = {
    deck: [],
    round: 0,
    score: 0,
    answers: [], // [{ albumId, got:{album,year,track} }]
  };

  // ── 플레이스홀더: 실제 자켓 URL이 없을 때만 사용(정답 노출 없음) ──
  function placeholderArt(album) {
    const seed = album.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const hue = seed % 360;
    return `
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="앨범 자켓">
        <defs>
          <linearGradient id="g-${album.id}" gradientTransform="rotate(${seed % 180})">
            <stop offset="0%" stop-color="hsl(${hue} 70% 55%)"/>
            <stop offset="100%" stop-color="hsl(${(hue + 45) % 360} 65% 32%)"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#g-${album.id})"/>
        <circle cx="200" cy="185" r="92" fill="rgba(255,255,255,0.10)"/>
        <text x="200" y="360" text-anchor="middle" font-size="18"
              fill="rgba(255,255,255,0.5)" font-family="sans-serif">NO IMAGE · 자켓 미로드</text>
      </svg>`;
  }

  // ── DOM ──
  const el = {};
  function cacheDom() {
    [
      "screen-start", "screen-play", "screen-result",
      "btn-start", "btn-restart", "btn-next",
      "card-art", "progress", "score",
      "q-album", "q-year", "q-track",
      "feedback", "result-score", "result-detail",
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }

  function show(screen) {
    ["screen-start", "screen-play", "screen-result"].forEach((s) =>
      el[s].classList.toggle("active", s === screen)
    );
  }

  // ── 게임 시작 ──
  function startGame() {
    state.deck = shuffle(ALBUMS).slice(0, CONFIG.rounds);
    state.round = 0;
    state.score = 0;
    state.answers = [];
    show("screen-play");
    renderRound();
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    const album = state.deck[state.round];

    // 자켓: URL 있으면 <img>(로드 실패시 플레이스홀더로 폴백), 없으면 플레이스홀더
    const stage = el["card-art"];
    if (album.art) {
      stage.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "앨범 자켓";
      img.addEventListener("error", () => {
        stage.innerHTML = placeholderArt(album);
      });
      img.src = album.art;
      stage.appendChild(img);
    } else {
      stage.innerHTML = placeholderArt(album);
    }

    el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;
    el.score.textContent = state.score;

    renderQuestion("q-album", "이 자켓의 앨범은?", album.title,
      buildChoices(album.title, ALBUMS.map((a) => a.title), CONFIG.choices));
    renderQuestion("q-year", "이 앨범의 발매 연도는?", album.year,
      buildChoices(album.year, ALBUM_YEARS, CONFIG.choices));
    renderQuestion("q-track", "이 앨범의 타이틀곡은?", album.titleTrack,
      buildChoices(album.titleTrack, ALBUMS.map((a) => a.titleTrack), CONFIG.choices));

    el.feedback.textContent = "";
    el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    el["btn-next"].textContent =
      state.round + 1 === state.deck.length ? "결과 보기" : "다음 자켓 →";
  }

  // ── 문제 하나 렌더 ──
  function renderQuestion(containerId, label, correct, choices) {
    const c = el[containerId];
    c.dataset.answered = "false";
    c.dataset.result = "";
    c.innerHTML =
      `<p class="q-label">${label}</p>` +
      `<div class="choices" role="group" aria-label="${label}">` +
      choices.map((v) =>
        `<button type="button" class="choice" data-value="${v}">${v}</button>`
      ).join("") +
      `</div>`;
    c.querySelectorAll(".choice").forEach((btn) =>
      btn.addEventListener("click", () => selectChoice(c, btn, correct))
    );
  }

  // ── 보기 선택(문제별 1회) ──
  function selectChoice(container, btn, correct) {
    if (container.dataset.answered === "true") return;
    container.dataset.answered = "true";

    const isCorrect = String(btn.dataset.value) === String(correct);
    container.dataset.result = isCorrect ? "correct" : "wrong";
    if (isCorrect) state.score += CONFIG.pointsPerCorrect;

    container.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
      if (String(b.dataset.value) === String(correct)) {
        b.classList.add("correct");
        b.setAttribute("aria-label", b.textContent + " (정답)");
      } else if (b === btn) {
        b.classList.add("wrong");
        b.setAttribute("aria-label", b.textContent + " (오답)");
      }
    });

    el.score.textContent = state.score;
    maybeFinishRound();
  }

  // ── 세 문제 모두 풀리면 라운드 마감 ──
  function maybeFinishRound() {
    const ids = ["q-album", "q-year", "q-track"];
    if (!ids.every((id) => el[id].dataset.answered === "true")) return;
    if (el["btn-next"].disabled === false) return; // 이미 마감됨

    const album = state.deck[state.round];
    const got = {
      album: el["q-album"].dataset.result === "correct",
      year: el["q-year"].dataset.result === "correct",
      track: el["q-track"].dataset.result === "correct",
    };
    state.answers.push({ albumId: album.id, got });

    const hit = Object.values(got).filter(Boolean).length;
    el.feedback.textContent =
      hit === 3 ? "🎉 3문제 모두 정답!" : `이 자켓에서 ${hit} / 3 정답`;
    el.feedback.className = "feedback " + (hit === 3 ? "good" : "mid");
    el["btn-next"].disabled = false;
    el["btn-next"].focus();
  }

  // ── 다음 / 결과 ──
  function nextRound() {
    if (state.round + 1 < state.deck.length) {
      state.round++;
      renderRound();
    } else {
      showResult();
    }
  }

  function showResult() {
    const max = state.deck.length * 3 * CONFIG.pointsPerCorrect;
    el["result-score"].textContent = `${state.score} / ${max} 점`;

    const hits = state.answers.reduce(
      (acc, a) => acc + Object.values(a.got).filter(Boolean).length, 0);
    const total = state.deck.length * 3;
    const pct = total ? Math.round((hits / total) * 100) : 0;

    const tier = tierFor(pct);

    el["result-detail"].innerHTML =
      `<p class="tier">${tier}</p>` +
      `<p class="pct">정답률 ${pct}% (${hits}/${total})</p>`;
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
