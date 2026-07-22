/**
 * SEVENTEEN Album-Cover Quiz — 게임 엔진 (DOM 전담)
 *
 * 모드: normal(랜덤) / daily(날짜 시드 결정론) / review(직전 오답 복습)
 * 라운드 = 앨범 자켓 1장 + 3문제(앨범/발매연도/타이틀곡), 각 4지선다.
 */
(function () {
  "use strict";

  const { ALBUMS, albumById, memberById, MEMBERS, ALBUM_YEARS, UNIT_SONGS } = window.SVTData;
  const { shuffle, tierFor } = window.QuizLogic;
  const { buildQuestion, buildMemberQuestion, availableMemberTypes } = window.QuizQuestions;
  const T = window.I18N.t; // UI 문자열(i18n-lite)

  const CONFIG = { rounds: 20, pointsPerCorrect: 10, choices: 4 };

  // 앨범 문제 컨텍스트
  function qctx(rng) {
    return {
      albums: ALBUMS, years: ALBUM_YEARS, members: MEMBERS, n: CONFIG.choices, rng,
      memberName: (id) => (memberById[id] ? memberById[id].name : id),
    };
  }
  // 멤버 문제 컨텍스트
  function mctx(rng) {
    return {
      members: MEMBERS, unitSongs: UNIT_SONGS, albums: ALBUMS, n: CONFIG.choices, rng,
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
      "card-art", "card-caption", "btn-reload", "progress", "progress-fill", "score", "hud-mode",
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
    state.rng = mode === "daily" ? mulberry32(hashStr("svt-daily-" + todayKey())) : Math.random;
    // 덱 = 앨범 카드 + 멤버 카드(문제 낼 수 있는 멤버만) 섞기
    const albumCards = ALBUMS.map((a) => ({ kind: "album", ref: a }));
    const memberCards = MEMBERS
      .filter((m) => availableMemberTypes(m, mctx(state.rng)).length >= 1)
      .map((m) => ({ kind: "member", ref: m }));
    const pool = albumCards.concat(memberCards);
    state.deck = shuffle(pool, state.rng).slice(0, Math.min(CONFIG.rounds, pool.length));
    state.round = 0; state.score = 0; state.displayScore = 0; state.answers = [];
    el.score.textContent = "0";
    el["hud-mode"].textContent = T.hudMode[mode] || "";
    show("screen-play");
    renderRound();
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    const card = state.deck[state.round];
    renderCardArt(card);

    el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;
    el["progress-fill"].style.width = `${((state.round + 1) / state.deck.length) * 100}%`;

    // 카드당 1문제: 멤버 카드면 멤버 문제, 앨범 카드면 앨범 문제
    const q = card.kind === "member"
      ? buildMemberQuestion(card.ref, mctx(state.rng))
      : buildQuestion(card.ref, qctx(state.rng));
    renderQuestion(q);

    el.feedback.textContent = ""; el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    el["btn-next"].textContent = state.round + 1 === state.deck.length ? T.next.result : T.next.more;

    // 다음 앨범 카드 자켓만 미리 살짝 데워둠(레이트리밋 회피)
    const next = state.deck[state.round + 1];
    if (next && next.kind === "album" && !next.ref.art && window.SVTArtLive) window.SVTArtLive.get(next.ref);

    enterMotion(el["card-art"]);
    enterMotion(el["question"]);
  }

  // 애니메이션 재시작(클래스 제거 → 리플로 → 재부여)
  function enterMotion(node) {
    node.classList.remove("enter");
    void node.offsetWidth;
    node.classList.add("enter");
  }

  // ── 카드 렌더: 앨범(자켓) 또는 멤버(사진) ──
  function renderCardArt(card) {
    const stage = el["card-art"];
    el["btn-reload"].hidden = true;
    stage.classList.toggle("member", card.kind === "member");

    if (card.kind === "member") {
      const m = card.ref;
      if (m.photo) mountImage(stage, m.photo, card);
      else showMemberPlaceholder(stage, m);
      return;
    }
    // 앨범: 베이크 → 실시간 → 플레이스홀더
    const album = card.ref;
    if (album.art) { mountImage(stage, album.art, card); return; }
    stage.classList.add("loading");
    stage.innerHTML = "";
    el["card-caption"].textContent = "";
    const live = window.SVTArtLive;
    if (!live) { showPlaceholder(stage, card); return; }
    live.get(album).then((url) => {
      if (state.deck[state.round] !== card) return;
      if (url) mountImage(stage, url, card);
      else showPlaceholder(stage, card);
    });
  }

  // 재로딩 버튼: 현재 카드 이미지를 다시 시도
  function reloadArt() {
    const card = state.deck[state.round];
    if (!card) return;
    if (card.kind === "album" && window.SVTArtLive && window.SVTArtLive.reload) window.SVTArtLive.reload(card.ref);
    renderCardArt(card);
  }

  function isCurrent(card) { return state.deck[state.round] === card; }

  function mountImage(stage, url, card, retried) {
    stage.classList.add("loading");
    stage.innerHTML = "";
    el["card-caption"].textContent = "";
    const isMember = card.kind === "member";
    const img = document.createElement("img");
    img.alt = isMember ? "멤버 사진" : "앨범 자켓";
    img.addEventListener("load", () => {
      img.classList.add("loaded"); stage.classList.remove("loading");
      el["card-caption"].textContent = isMember ? "© Wikimedia Commons" : T.caption.loaded;
      el["btn-reload"].hidden = true;
    });
    img.addEventListener("error", () => {
      if (!isCurrent(card)) return;
      if (!retried) { setTimeout(() => { if (isCurrent(card)) mountImage(stage, url, card, true); }, 700); return; }
      if (isMember) showMemberPlaceholder(stage, card.ref, true);
      else showPlaceholder(stage, card, true);
    });
    img.src = url;
    stage.appendChild(img);
  }

  function showPlaceholder(stage, card, isError) {
    stage.classList.remove("loading");
    stage.innerHTML = placeholderArt(card.ref);
    el["card-caption"].textContent = isError ? T.caption.error : T.caption.noArt;
    el["btn-reload"].hidden = false;
  }

  // 멤버 사진이 없을 때: 유닛 컬러 그라데이션 + 멤버 이름 아바타
  const UNIT_HUE = { vocal: 210, hiphop: 275, performance: 340 };
  function showMemberPlaceholder(stage, m, isError) {
    stage.classList.remove("loading");
    const hue = UNIT_HUE[m.unit] != null ? UNIT_HUE[m.unit] : 260;
    stage.innerHTML =
      `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="멤버">
        <defs><linearGradient id="mg" gradientTransform="rotate(60)">
        <stop offset="0%" stop-color="hsl(${hue} 65% 55%)"/><stop offset="100%" stop-color="hsl(${(hue + 30) % 360} 60% 32%)"/>
        </linearGradient></defs><rect width="400" height="400" fill="url(#mg)"/>
        <circle cx="200" cy="160" r="70" fill="rgba(255,255,255,0.18)"/>
        <rect x="120" y="250" width="160" height="90" rx="80" fill="rgba(255,255,255,0.15)"/>
        <text x="200" y="380" text-anchor="middle" font-size="30" font-weight="700" fill="#fff" font-family="sans-serif">${escapeHtml(m.name)}</text></svg>`;
    el["card-caption"].textContent = isError ? "사진을 못 불러왔어요" : "";
    el["btn-reload"].hidden = !isError;
  }

  // 단일 문제 렌더(label 은 HTML 허용, 보기는 이스케이프)
  function renderQuestion(q) {
    const c = el["question"];
    c.dataset.answered = "false";
    const d = T.difficulty[q.difficulty] || T.difficulty[1];
    const badge = `<span class="q-diff diff-${q.difficulty}" title="난이도">${d.stars} ${d.label}</span>`;
    c.innerHTML = `<div class="q-head"><p class="q-label">${q.label}</p>${badge}</div>` +
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
    state.answers.push({ correct: isCorrect });
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
    el["result-score"].innerHTML = T.result.score(state.score, st.max);
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
