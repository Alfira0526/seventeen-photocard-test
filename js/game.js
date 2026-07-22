/**
 * SEVENTEEN Album-Cover Quiz — 게임 엔진 (DOM 전담)
 *
 * 모드: normal(랜덤) / daily(날짜 시드 결정론) / review(직전 오답 복습)
 * 라운드 = 앨범 자켓 1장 + 3문제(앨범/발매연도/타이틀곡), 각 4지선다.
 */
(function () {
  "use strict";

  const { ALBUMS, albumById, memberById, MEMBERS, ALBUM_YEARS } = window.SVTData;
  const { shuffle, tierFor } = window.QuizLogic;
  const { buildQuestion } = window.QuizQuestions;
  const T = window.I18N.t; // UI 문자열(i18n-lite)

  const CONFIG = { rounds: 10, pointsPerCorrect: 10, choices: 4 };

  // 문제 생성에 넘길 컨텍스트(카드당 1문제, 랜덤 유형)
  function qctx(rng) {
    return {
      albums: ALBUMS, years: ALBUM_YEARS, members: MEMBERS, n: CONFIG.choices, rng,
      memberName: (id) => (memberById[id] ? memberById[id].name : id),
    };
  }
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
      "btn-restart", "btn-next", "btn-share", "btn-tweet",
      "card-art", "card-caption", "btn-reload", "progress", "score", "hud-mode",
      "question", "question-note", "feedback",
      "result-score", "result-detail", "result-canvas",
      "theme-toggle", "daily-sub",
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
    } else {
      state.rng = Math.random;
      state.deck = shuffle(ALBUMS, state.rng).slice(0, Math.min(CONFIG.rounds, ALBUMS.length));
    }
    state.round = 0; state.score = 0; state.displayScore = 0; state.answers = [];
    el.score.textContent = "0";
    el["hud-mode"].textContent = T.hudMode[mode] || "";
    // 자켓을 미리 불러와 라운드 도달 전에 준비(로딩 실패·지연 완화)
    if (window.SVTArtLive && window.SVTArtLive.prefetch) window.SVTArtLive.prefetch(state.deck);
    show("screen-play");
    renderRound();
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    const album = state.deck[state.round];
    renderArt(album);

    el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;

    // 카드당 1문제: 이 앨범에서 가능한 유형 중 랜덤 출제
    const q = buildQuestion(album, qctx(state.rng));
    renderQuestion(q);

    el.feedback.textContent = ""; el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    el["btn-next"].textContent = state.round + 1 === state.deck.length ? T.next.result : T.next.more;

    // 문제 이동 모션: 카드/문제를 부드럽게 다시 등장시킴
    enterMotion(el["card-art"]);
    enterMotion(el["question"]);
  }

  // 애니메이션 재시작(클래스 제거 → 리플로 → 재부여)
  function enterMotion(node) {
    node.classList.remove("enter");
    void node.offsetWidth;
    node.classList.add("enter");
  }

  // ── 자켓 렌더: 베이크(album.art) → 실시간(SVTArtLive) → 플레이스홀더 순 ──
  function renderArt(album) {
    const stage = el["card-art"];
    el["btn-reload"].hidden = true; // 로딩 시작 시 재로딩 버튼 숨김
    if (album.art) { mountImage(stage, album.art, album); return; }

    // 실시간 로딩 시도: 스켈레톤 표시 후 URL 도착 시 교체
    stage.classList.add("loading");
    stage.innerHTML = "";
    el["card-caption"].textContent = "";
    const live = window.SVTArtLive;
    if (!live) { showPlaceholder(stage, album); return; }
    live.get(album).then((url) => {
      if (state.deck[state.round] !== album) return; // 이미 다음 라운드면 무시
      if (url) mountImage(stage, url, album);
      else showPlaceholder(stage, album);
    });
  }

  // 재로딩 버튼: 캐시를 비우고 현재 카드 자켓을 다시 시도
  function reloadArt() {
    const album = state.deck[state.round];
    if (!album) return;
    if (window.SVTArtLive && window.SVTArtLive.reload) window.SVTArtLive.reload(album);
    renderArt(album);
  }

  function isCurrent(album) { return state.deck[state.round] === album; }

  function mountImage(stage, url, album, retried) {
    stage.classList.add("loading");
    stage.innerHTML = "";
    el["card-caption"].textContent = "";
    const img = document.createElement("img");
    img.alt = "앨범 자켓";
    img.addEventListener("load", () => { img.classList.add("loaded"); stage.classList.remove("loading"); el["card-caption"].textContent = T.caption.loaded; el["btn-reload"].hidden = true; });
    img.addEventListener("error", () => {
      if (!isCurrent(album)) return; // 이미 다음 라운드면 무시
      if (!retried) setTimeout(() => { if (isCurrent(album)) mountImage(stage, url, album, true); }, 700);
      else showPlaceholder(stage, album, true);
    });
    img.src = url;
    stage.appendChild(img);
  }

  function showPlaceholder(stage, album, isError) {
    stage.classList.remove("loading");
    stage.innerHTML = placeholderArt(album);
    el["card-caption"].textContent = isError ? T.caption.error : T.caption.noArt;
    el["btn-reload"].hidden = false; // 실패 시 재로딩 버튼 노출
  }

  // 단일 문제 렌더(label 은 HTML 허용, 보기는 이스케이프)
  function renderQuestion(q) {
    const c = el["question"];
    c.dataset.answered = "false";
    c.innerHTML = `<p class="q-label">${q.label}</p>` +
      `<div class="choices" role="group">` +
      q.choices.map((v) => `<button type="button" class="choice" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join("") +
      `</div>`;
    c.querySelectorAll(".choice").forEach((btn) => btn.addEventListener("click", () => selectChoice(btn, q.correct)));
    el["question-note"].textContent = q.note || "";
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // ── 보기 선택(카드당 1문제) ──
  function selectChoice(btn, correct) {
    const c = el["question"];
    if (c.dataset.answered === "true") return;
    c.dataset.answered = "true";
    const isCorrect = String(btn.dataset.value) === String(correct);
    if (isCorrect) animateScore(state.score, (state.score += CONFIG.pointsPerCorrect));
    c.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true; b.setAttribute("aria-disabled", "true");
      if (String(b.dataset.value) === String(correct)) { b.classList.add("correct"); b.setAttribute("aria-label", b.textContent + " (정답)"); }
      else if (b === btn) { b.classList.add("wrong"); b.setAttribute("aria-label", b.textContent + " (오답)"); }
    });
    finishRound(isCorrect);
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

  function finishRound(isCorrect) {
    const album = state.deck[state.round];
    state.answers.push({ albumId: album.id, correct: isCorrect });
    el.feedback.textContent = isCorrect ? T.feedback.correct : T.feedback.wrong;
    el.feedback.className = "feedback " + (isCorrect ? "good" : "mid");
    el["btn-next"].disabled = false; el["btn-next"].focus();
  }

  function nextRound() {
    if (state.round + 1 < state.deck.length) { state.round++; renderRound(); }
    else showResult();
  }

  // ── 결과 ──
  function computeStats() {
    const total = state.deck.length; // 카드당 1문제
    const max = total * CONFIG.pointsPerCorrect;
    const hits = state.answers.reduce((a, x) => a + (x.correct ? 1 : 0), 0);
    const pct = total ? Math.round((hits / total) * 100) : 0;
    return { max, hits, total, pct, tier: tierFor(pct) };
  }

  function showResult() {
    const st = computeStats();
    el["result-score"].textContent = T.result.score(state.score, st.max);
    el["result-detail"].innerHTML = T.result.detail(st.tier, st.pct, st.hits, st.total);

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
    ctx.fillText(T.share.title, W / 2, 130);
    // 등급
    ctx.font = "800 84px Pretendard, sans-serif";
    ctx.fillStyle = "#ff5c9d"; ctx.fillText(st.tier, W / 2, 300);
    // 점수/정답률
    ctx.fillStyle = "#f2f2f7"; ctx.font = "800 96px Pretendard, sans-serif";
    ctx.fillText(`${state.score} / ${st.max}점`, W / 2, 430);
    ctx.fillStyle = "#9a9ab0"; ctx.font = "500 40px Pretendard, sans-serif";
    const modeLabel = T.shareMode[state.mode] || "";
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
    const text = T.share.tweet(st.tier, state.score, st.pct);
    // 이미지는 인텐트로 첨부 불가 → 카드 PNG를 먼저 내려받아 첨부에 쓰도록 안내
    downloadShare();
    // features 문자열을 주면 브라우저가 '작은 팝업'으로 열어 로그인이 불편함.
    // anchor 클릭으로 '정상 탭'을 연다(팝업 차단·로그인 세션 문제 회피).
    const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ── 시작화면 상태 갱신(데일리 완료 표시) ──
  function refreshStart() {
    const daily = store.get(LS.daily, null);
    const streak = store.get(LS.streak, { count: 0 });
    if (daily && daily.date === todayKey()) el["daily-sub"].textContent = T.start.dailyDone(daily.pct, streak.count);
    else el["daily-sub"].textContent = T.start.dailyOpen;
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
    el["btn-reload"].addEventListener("click", reloadArt);
    refreshStart();
    show("screen-start");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
