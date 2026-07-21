/**
 * SEVENTEEN Album-Cover Quiz — 게임 엔진 (DOM 전담)
 *
 * 모드: normal(랜덤) / daily(날짜 시드 결정론) / review(직전 오답 복습)
 * 라운드 = 앨범 자켓 1장 + 3문제(앨범/발매연도/타이틀곡), 각 4지선다.
 */
(function () {
  "use strict";

  const { ALBUMS, albumById, ALBUM_YEARS } = window.SVTData;
  const { shuffle, buildChoices, buildYearChoices, buildAlbumChoices, tierFor } =
    window.QuizLogic;

  const CONFIG = { rounds: 8, pointsPerCorrect: 10, choices: 4 };
  const LS = { theme: "svt-theme", wrong: "svt-wrong", daily: "svt-daily", streak: "svt-streak" };

  const state = {
    mode: "normal",
    rng: Math.random, // 모드별 난수원(daily는 시드 고정)
    deck: [],
    round: 0,
    score: 0,
    displayScore: 0, // 카운트업 표시용
    answers: [], // [{ albumId, got:{album,year,track} }]
  };

  // ── 로컬스토리지 헬퍼(사파리 프라이빗 등 예외 방어) ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // ── 시드 PRNG(mulberry32) + 문자열 해시 ──
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

  // ── DOM ──
  const el = {};
  function cacheDom() {
    [
      "screen-start", "screen-play", "screen-result",
      "btn-restart", "btn-next", "btn-share", "btn-tweet", "btn-review",
      "card-art", "card-caption", "progress", "score", "hud-mode",
      "q-album", "q-year", "q-track", "feedback",
      "result-score", "result-detail", "result-canvas",
      "theme-toggle", "mode-review", "review-sub", "daily-sub",
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }
  function show(screen) {
    ["screen-start", "screen-play", "screen-result"].forEach((s) =>
      el[s].classList.toggle("active", s === screen));
  }

  // ── 테마 ──
  function initTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    el["theme-toggle"].textContent = cur === "dark" ? "🌙" : "☀️";
    el["theme-toggle"].addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      el["theme-toggle"].textContent = next === "dark" ? "🌙" : "☀️";
      store.set(LS.theme, next);
    });
  }

  // ── 플레이스홀더(정답 노출 없음) ──
  function placeholderArt(album) {
    const seed = hashStr(album.id); const hue = seed % 360;
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="앨범 자켓">
      <defs><linearGradient id="g-${album.id}" gradientTransform="rotate(${seed % 180})">
      <stop offset="0%" stop-color="hsl(${hue} 70% 55%)"/><stop offset="100%" stop-color="hsl(${(hue + 45) % 360} 65% 32%)"/>
      </linearGradient></defs><rect width="400" height="400" fill="url(#g-${album.id})"/>
      <circle cx="200" cy="185" r="92" fill="rgba(255,255,255,0.10)"/>
      <text x="200" y="360" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.5)" font-family="sans-serif">NO IMAGE · 자켓 미로드</text></svg>`;
  }

  // ── 시작: 모드 선택 ──
  function startMode(mode) {
    state.mode = mode;
    if (mode === "daily") {
      state.rng = mulberry32(hashStr("svt-daily-" + todayKey()));
      state.deck = shuffle(ALBUMS, state.rng).slice(0, Math.min(CONFIG.rounds, ALBUMS.length));
    } else if (mode === "review") {
      const ids = store.get(LS.wrong, []);
      const albums = ids.map((id) => albumById[id]).filter(Boolean);
      if (!albums.length) return; // 방어(버튼 비활성 상태여야 함)
      state.rng = Math.random;
      state.deck = shuffle(albums, state.rng).slice(0, CONFIG.rounds);
    } else {
      state.rng = Math.random;
      state.deck = shuffle(ALBUMS, state.rng).slice(0, Math.min(CONFIG.rounds, ALBUMS.length));
    }
    state.round = 0; state.score = 0; state.displayScore = 0; state.answers = [];
    el.score.textContent = "0";
    el["hud-mode"].textContent = { normal: "🎲 일반", daily: "📅 데일리", review: "🔁 복습" }[mode] || "";
    show("screen-play");
    renderRound();
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    const album = state.deck[state.round];
    const stage = el["card-art"];

    if (album.art) {
      stage.classList.add("loading");
      stage.innerHTML = "";
      el["card-caption"].textContent = "";
      const img = document.createElement("img");
      img.alt = "앨범 자켓";
      img.addEventListener("load", () => { img.classList.add("loaded"); stage.classList.remove("loading"); el["card-caption"].textContent = "© 저작권자 · Apple Music"; });
      img.addEventListener("error", () => { stage.classList.remove("loading"); stage.innerHTML = placeholderArt(album); el["card-caption"].textContent = "이미지 미로드 · 자켓 상상 모드"; });
      img.src = album.art;
      stage.appendChild(img);
    } else {
      stage.classList.remove("loading");
      stage.innerHTML = placeholderArt(album);
      el["card-caption"].textContent = "이미지 미로드 · scripts/fetch-art.mjs 실행 시 표시";
    }

    el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;

    renderQuestion("q-album", "이 자켓의 앨범은?", album.title,
      buildAlbumChoices(album, ALBUMS, CONFIG.choices, state.rng));
    renderQuestion("q-year", "이 앨범의 발매 연도는?", album.year,
      buildYearChoices(album.year, ALBUM_YEARS, CONFIG.choices, state.rng));
    renderQuestion("q-track", "이 앨범의 타이틀곡은?", album.titleTrack,
      buildChoices(album.titleTrack, ALBUMS.map((a) => a.titleTrack), CONFIG.choices, state.rng));

    el.feedback.textContent = ""; el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    el["btn-next"].textContent = state.round + 1 === state.deck.length ? "결과 보기" : "다음 자켓 →";
  }

  function renderQuestion(containerId, label, correct, choices) {
    const c = el[containerId];
    c.dataset.answered = "false"; c.dataset.result = "";
    c.innerHTML = `<p class="q-label">${label}</p>` +
      `<div class="choices" role="group" aria-label="${label}">` +
      choices.map((v) => `<button type="button" class="choice" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join("") +
      `</div>`;
    c.querySelectorAll(".choice").forEach((btn) => btn.addEventListener("click", () => selectChoice(c, btn, correct)));
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // ── 보기 선택 ──
  function selectChoice(container, btn, correct) {
    if (container.dataset.answered === "true") return;
    container.dataset.answered = "true";
    const isCorrect = String(btn.dataset.value) === String(correct);
    container.dataset.result = isCorrect ? "correct" : "wrong";
    if (isCorrect) animateScore(state.score, (state.score += CONFIG.pointsPerCorrect));
    container.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true; b.setAttribute("aria-disabled", "true");
      if (String(b.dataset.value) === String(correct)) { b.classList.add("correct"); b.setAttribute("aria-label", b.textContent + " (정답)"); }
      else if (b === btn) { b.classList.add("wrong"); b.setAttribute("aria-label", b.textContent + " (오답)"); }
    });
    maybeFinishRound();
  }

  // ── 점수 카운트업 ──
  function animateScore(from, to) {
    const start = performance.now(), dur = 400;
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const val = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      el.score.textContent = val;
      if (t < 1) requestAnimationFrame(step); else el.score.textContent = to;
    }
    requestAnimationFrame(step);
  }

  function maybeFinishRound() {
    const ids = ["q-album", "q-year", "q-track"];
    if (!ids.every((id) => el[id].dataset.answered === "true")) return;
    if (el["btn-next"].disabled === false) return;
    const album = state.deck[state.round];
    const got = {
      album: el["q-album"].dataset.result === "correct",
      year: el["q-year"].dataset.result === "correct",
      track: el["q-track"].dataset.result === "correct",
    };
    state.answers.push({ albumId: album.id, got });
    const hit = Object.values(got).filter(Boolean).length;
    el.feedback.textContent = hit === 3 ? "🎉 3문제 모두 정답!" : `이 자켓에서 ${hit} / 3 정답`;
    el.feedback.className = "feedback " + (hit === 3 ? "good" : "mid");
    el["btn-next"].disabled = false; el["btn-next"].focus();
  }

  function nextRound() {
    if (state.round + 1 < state.deck.length) { state.round++; renderRound(); }
    else showResult();
  }

  // ── 결과 ──
  function computeStats() {
    const max = state.deck.length * 3 * CONFIG.pointsPerCorrect;
    const hits = state.answers.reduce((a, x) => a + Object.values(x.got).filter(Boolean).length, 0);
    const total = state.deck.length * 3;
    const pct = total ? Math.round((hits / total) * 100) : 0;
    return { max, hits, total, pct, tier: tierFor(pct) };
  }

  function showResult() {
    const st = computeStats();
    el["result-score"].textContent = `${state.score} / ${st.max} 점`;
    el["result-detail"].innerHTML = `<p class="tier">${st.tier}</p><p class="pct">정답률 ${st.pct}% (${st.hits}/${st.total})</p>`;

    // 오답 앨범 저장(복습용): 한 문제라도 틀린 앨범
    const wrongIds = state.answers.filter((a) => Object.values(a.got).some((v) => !v)).map((a) => a.albumId);
    store.set(LS.wrong, wrongIds);
    el["btn-review"].hidden = wrongIds.length === 0;

    // 데일리 기록 + 스트릭
    if (state.mode === "daily") updateDaily(st.pct);

    drawShareCard(st);
    show("screen-result");
  }

  function updateDaily(pct) {
    const today = todayKey();
    store.set(LS.daily, { date: today, pct });
    const streak = store.get(LS.streak, { count: 0, lastDate: null });
    if (streak.lastDate !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      streak.count = streak.lastDate === yKey ? streak.count + 1 : 1;
      streak.lastDate = today;
      store.set(LS.streak, streak);
    }
  }

  // ── 공유 카드(canvas) ──
  function drawShareCard(st) {
    const cv = el["result-canvas"], ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#171427"); g.addColorStop(1, "#0d0d14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 악센트 바
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, "#7b5cff"); bar.addColorStop(1, "#ff5c9d");
    ctx.fillStyle = bar; ctx.fillRect(0, 0, W, 10);
    ctx.textAlign = "center"; ctx.fillStyle = "#f2f2f7";
    ctx.font = "700 40px Pretendard, sans-serif";
    ctx.fillText("SEVENTEEN 앨범 자켓 퀴즈", W / 2, 130);
    // 등급
    ctx.font = "800 84px Pretendard, sans-serif";
    ctx.fillStyle = "#ff5c9d"; ctx.fillText(st.tier, W / 2, 300);
    // 점수/정답률
    ctx.fillStyle = "#f2f2f7"; ctx.font = "800 96px Pretendard, sans-serif";
    ctx.fillText(`${state.score} / ${st.max}점`, W / 2, 430);
    ctx.fillStyle = "#9a9ab0"; ctx.font = "500 40px Pretendard, sans-serif";
    const modeLabel = { normal: "일반", daily: "데일리", review: "복습" }[state.mode] || "";
    ctx.fillText(`정답률 ${st.pct}% · ${modeLabel} 모드`, W / 2, 500);
    ctx.fillStyle = "#6b6a80"; ctx.font = "400 30px Pretendard, sans-serif";
    ctx.fillText("팬메이드 비영리 데모", W / 2, 580);
  }

  function downloadShare() {
    const cv = el["result-canvas"];
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `svt-quiz-${todayKey()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function tweetShare() {
    const st = computeStats();
    const text = `SEVENTEEN 앨범 자켓 퀴즈 결과\n${st.tier} · ${state.score}점 (정답률 ${st.pct}%)\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`;
    const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
  }

  // ── 시작화면 상태 갱신(복습 가능 여부, 데일리 완료 표시) ──
  function refreshStart() {
    const wrong = store.get(LS.wrong, []);
    el["mode-review"].disabled = wrong.length === 0;
    el["review-sub"].textContent = wrong.length ? `직전 오답 ${wrong.length}개 다시 풀기` : "직전 판의 틀린 앨범(먼저 한 판 필요)";
    const daily = store.get(LS.daily, null);
    const streak = store.get(LS.streak, { count: 0 });
    if (daily && daily.date === todayKey()) el["daily-sub"].textContent = `오늘 완료 · 정답률 ${daily.pct}%${streak.count ? ` · 🔥${streak.count}일` : ""}`;
    else el["daily-sub"].textContent = "오늘의 8장 · 하루 한 번 같은 문제";
  }

  // ── 초기화 ──
  function init() {
    cacheDom();
    initTheme();
    document.querySelectorAll(".mode-btn").forEach((b) =>
      b.addEventListener("click", () => { if (!b.disabled) startMode(b.dataset.mode); }));
    el["btn-next"].addEventListener("click", nextRound);
    el["btn-restart"].addEventListener("click", () => { refreshStart(); show("screen-start"); });
    el["btn-share"].addEventListener("click", downloadShare);
    el["btn-tweet"].addEventListener("click", tweetShare);
    el["btn-review"].addEventListener("click", () => startMode("review"));
    refreshStart();
    show("screen-start");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
