/**
 * SEVENTEEN Album-Cover Quiz — 게임 엔진 (DOM 전담)
 *
 * 모드: normal(랜덤 20문제·100점) / endless(무한, 틀리면 끝) /
 *       timeattack(60초·목숨 3개, 맞힌 개수 집계)
 * 라운드 = 앨범 자켓 또는 멤버 사진 1장 + 카드당 1문제(랜덤 유형), 4지선다.
 */
(function () {
  "use strict";

  const { ALBUMS, albumById, memberById, MEMBERS, ALBUM_YEARS, UNIT_SONGS } = window.SVTData;
  const { shuffle, tierFor } = window.QuizLogic;
  const { buildQuestion, buildMemberQuestion, availableMemberTypes } = window.QuizQuestions;
  const T = window.I18N.t; // UI 문자열(i18n-lite)

  const CONFIG = { rounds: 20, pointsPerCorrect: 5, choices: 4, taSeconds: 60, taLives: 3 };

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
  const LS = { theme: "svt-theme", ranking: "svt-ranking", name: "svt-name" };

  const state = {
    mode: "normal",
    rng: Math.random,
    pool: [],       // 카드 풀(무한/타임어택에서 덱 확장에 사용)
    deck: [],
    round: 0,
    score: 0,       // normal=점수, endless/timeattack=맞힌 개수
    correct: 0,     // 맞힌 개수(항상)
    lives: Infinity,
    timeLeft: 0,
    timerId: null,
    limited: true,  // true=고정 20문제, false=무한 진행
    over: false,
    answers: [],
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
      "btn-restart", "btn-next", "btn-share", "btn-save", "btn-tweet", "btn-insta", "btn-kakao", "share-hint",
      "card-art", "card-caption", "btn-reload", "progress", "progress-fill", "score", "hud-mode", "hud-lives",
      "rank-name", "btn-rank", "rank-list",
      "question", "question-note", "feedback",
      "result-score", "result-detail", "result-canvas",
      "theme-toggle",
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
    stopTimer();
    state.mode = mode;
    state.rng = Math.random;
    const albumCards = ALBUMS.map((a) => ({ kind: "album", ref: a }));
    const memberCards = MEMBERS
      .filter((m) => availableMemberTypes(m, mctx(state.rng)).length >= 1)
      .map((m) => ({ kind: "member", ref: m }));
    state.pool = albumCards.concat(memberCards);

    state.round = 0; state.score = 0; state.correct = 0; state.over = false; state.answers = [];
    el.score.textContent = "0";
    el["hud-mode"].textContent = T.hudMode[mode] || "";

    if (mode === "endless") {
      state.limited = false; state.lives = 1;
      state.deck = shuffle(state.pool, state.rng);
    } else if (mode === "timeattack") {
      state.limited = false; state.lives = CONFIG.taLives;
      state.deck = shuffle(state.pool, state.rng);
      startTimer();
    } else {
      state.limited = true; state.lives = Infinity;
      state.deck = shuffle(state.pool, state.rng).slice(0, Math.min(CONFIG.rounds, state.pool.length));
    }
    show("screen-play");
    renderRound();
  }

  // ── 타임어택 타이머 ──
  function startTimer() {
    state.timeLeft = CONFIG.taSeconds;
    updateHud();
    state.timerId = setInterval(() => {
      state.timeLeft--;
      updateHud();
      if (state.timeLeft <= 0) { stopTimer(); gameOver(); }
    }, 1000);
  }
  function stopTimer() { if (state.timerId) { clearInterval(state.timerId); state.timerId = null; } }

  // ── HUD(진행/타이머/목숨) 갱신 ──
  function updateHud() {
    if (state.mode === "timeattack") {
      el.progress.textContent = `⏱ ${state.timeLeft}s`;
      el["progress-fill"].style.width = `${(state.timeLeft / CONFIG.taSeconds) * 100}%`;
      el["hud-lives"].textContent = "❤️".repeat(Math.max(0, state.lives));
    } else if (state.mode === "endless") {
      el.progress.textContent = `🔥 ${state.correct}연속`;
      el["progress-fill"].style.width = `100%`;
      el["hud-lives"].textContent = "❤️";
    } else {
      el.progress.textContent = `${state.round + 1} / ${state.deck.length}`;
      el["progress-fill"].style.width = `${((state.round + 1) / state.deck.length) * 100}%`;
      el["hud-lives"].textContent = "";
    }
  }

  // ── 라운드 렌더 ──
  function renderRound() {
    // 무한/타임어택: 덱이 떨어지면 풀을 다시 섞어 이어붙임
    if (!state.limited && state.round >= state.deck.length - 1) {
      state.deck = state.deck.concat(shuffle(state.pool, state.rng));
    }
    const card = state.deck[state.round];
    renderCardArt(card);
    updateHud();

    // 카드당 1문제: 멤버 카드면 멤버 문제, 앨범 카드면 앨범 문제
    const q = card.kind === "member"
      ? buildMemberQuestion(card.ref, mctx(state.rng))
      : buildQuestion(card.ref, qctx(state.rng));
    renderQuestion(q);

    el.feedback.textContent = ""; el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    // 무한/타임어택은 자동 진행 → '다음 문제' 버튼 숨김
    el["btn-next"].hidden = !state.limited;
    el["btn-next"].textContent = state.round + 1 === state.deck.length ? T.next.result : T.next.more;

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
    if (c.dataset.answered === "true" || state.over) return;
    c.dataset.answered = "true";
    const isCorrect = String(btn.dataset.value) === String(correct);
    if (isCorrect) {
      state.correct++;
      const gain = state.mode === "normal" ? CONFIG.pointsPerCorrect : 1;
      animateScore(state.score, (state.score += gain));
    }
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
    updateHud();

    // 목숨 처리(무한=1, 타임어택=3)
    let ended = false;
    if (!isCorrect && state.lives !== Infinity) {
      state.lives--;
      updateHud();
      if (state.lives <= 0) ended = true;
    }

    el.feedback.textContent = isCorrect ? T.feedback.correct
      : (ended ? T.feedback.over : T.feedback.wrong);
    el.feedback.className = "feedback " + (isCorrect ? "good" : "mid");

    if (state.limited) {
      el["btn-next"].disabled = false; el["btn-next"].focus();
    } else if (ended) {
      setTimeout(() => gameOver(), 900);
    } else {
      // 무한/타임어택: 잠깐 정답 보여주고 자동 진행
      setTimeout(() => { if (!state.over) nextRound(); }, 800);
    }
  }

  function nextRound() {
    if (state.over) return;
    if (state.limited) {
      if (state.round + 1 < state.deck.length) { state.round++; renderRound(); }
      else showResult();
    } else {
      state.round++; renderRound(); // 덱은 renderRound에서 확장
    }
  }

  function gameOver() {
    if (state.over) return;
    state.over = true;
    stopTimer();
    showResult();
  }

  // ── 결과 ──
  function countTier(n) {
    if (n >= 20) return "🏆 찐 캐럿, 인정!";
    if (n >= 12) return "💎 진성 캐럿이네요";
    if (n >= 6) return "🌱 입덕 준비 완료";
    return "👀 이제 입덕각이에요";
  }

  // 모드별 결과 뷰(화면·공유카드·랭킹 공용)
  function buildResultView() {
    const hits = state.correct;
    if (state.mode === "normal") {
      const total = state.deck.length, pct = total ? Math.round((hits / total) * 100) : 0;
      return {
        tier: tierFor(pct), rankScore: state.score, mode: "일반",
        scoreHtml: `${state.score}<span class="score-max"> / 100점</span>`,
        scoreLine: `${state.score} / 100점`,
        sub: `${total}문제 중 ${hits}개 맞혔어요 · 정답률 ${pct}%`,
      };
    }
    if (state.mode === "endless") {
      return {
        tier: countTier(hits), rankScore: hits, mode: "무한",
        scoreHtml: `${hits}<span class="score-max"> 연속</span>`,
        scoreLine: `${hits}연속 정답`,
        sub: `무한 모드 · ${hits}문제 연속으로 맞혔어요`,
      };
    }
    return {
      tier: countTier(hits), rankScore: hits, mode: "타임어택",
      scoreHtml: `${hits}<span class="score-max"> 개</span>`,
      scoreLine: `${hits}개 정답`,
      sub: `타임어택 ${CONFIG.taSeconds}초 · ${hits}개 맞혔어요`,
    };
  }

  function showResult() {
    stopTimer();
    const res = buildResultView();
    state.lastRes = res;
    el["result-score"].innerHTML = res.scoreHtml;
    el["result-detail"].innerHTML = `<p class="tier">${res.tier}</p><p class="pct">${res.sub}</p>`;
    el["rank-name"].value = store.get(LS.name, "");
    el["btn-rank"].disabled = false;
    renderRankList();
    drawShareCard(res);
    show("screen-result");
  }

  // ── 랭킹(로컬 기기 저장) ──
  function registerRank() {
    if (!state.lastRes) return;
    const name = (el["rank-name"].value || "익명").trim().slice(0, 12) || "익명";
    store.set(LS.name, name);
    const list = store.get(LS.ranking, []);
    const entry = { name, score: state.lastRes.rankScore, mode: state.mode, ts: nowStamp() };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    store.set(LS.ranking, list.slice(0, 100));
    el["btn-rank"].disabled = true;
    renderRankList(entry);
    toast(T.rank.saved);
  }

  function renderRankList(highlight) {
    const list = store.get(LS.ranking, [])
      .filter((e) => e.mode === state.mode)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    const unit = state.mode === "normal" ? "점" : "개";
    el["rank-list"].innerHTML = list.length
      ? list.map((e, i) => {
          const me = highlight && e.ts === highlight.ts;
          return `<li class="${me ? "me" : ""}"><span class="rk">${i + 1}</span>` +
            `<span class="nm">${escapeHtml(e.name)}</span><span class="sc">${e.score}${unit}</span></li>`;
        }).join("")
      : `<li class="empty">${T.rank.empty}</li>`;
  }

  function nowStamp() { try { return Date.now(); } catch (e) { return Math.random(); } }

  // ── 공유 카드(canvas) ──
  function drawShareCard(res) {
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
    ctx.fillStyle = "#ff5c9d"; ctx.fillText(res.tier, W / 2, 300);
    // 점수(모드별 표현)
    ctx.fillStyle = "#f2f2f7"; ctx.font = "800 96px Pretendard, sans-serif";
    ctx.fillText(res.scoreLine, W / 2, 430);
    ctx.fillStyle = "#9a9ab0"; ctx.font = "500 40px Pretendard, sans-serif";
    ctx.fillText(`${res.mode} 모드`, W / 2, 500);
    ctx.fillStyle = "#6b6a80"; ctx.font = "400 30px Pretendard, sans-serif";
    ctx.fillText("팬메이드 비영리 데모", W / 2, 580);
  }

  // 결과 캔버스를 PNG File 로 변환
  function resultFile(cb) {
    el["result-canvas"].toBlob((blob) => {
      cb(blob ? new File([blob], `svt-quiz-${todayKey()}.png`, { type: "image/png" }) : null);
    }, "image/png");
  }
  function canShareFiles(file) {
    return !!(navigator.canShare && file && navigator.canShare({ files: [file] }));
  }

  // 간단 토스트 안내
  function toast(msg) {
    let t = document.getElementById("svt-toast");
    if (!t) { t = document.createElement("div"); t.id = "svt-toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // 이미지 저장(다운로드)
  function downloadShare() {
    el["result-canvas"].toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `svt-quiz-${todayKey()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
    toast(T.share.saved);
  }

  // 공유하기(Web Share) — 모바일 네이티브 시트: 인스타/카톡/트위터/등
  function shareMain() {
    const res = state.lastRes || buildResultView();
    const text = T.share.native(res.tier, res.scoreLine);
    resultFile(async (file) => {
      if (navigator.share && canShareFiles(file)) {
        try { await navigator.share({ files: [file], text }); } catch (e) { /* 취소 무시 */ }
      } else {
        downloadShare();
        toast(T.share.fallback);
      }
    });
  }

  function tweetShare() {
    const res = state.lastRes || buildResultView();
    const text = T.share.tweet(res.tier, res.scoreLine);
    // 인텐트는 이미지 첨부 불가 → 카드 PNG를 먼저 저장해 첨부에 쓰도록
    downloadShare();
    // anchor 클릭으로 '정상 탭' 오픈(팝업 차단·로그인 세션 문제 회피)
    const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // 인스타그램: 웹 게시 API가 없어 Web Share(모바일) 또는 저장+안내
  function instaShare() {
    resultFile(async (file) => {
      if (navigator.share && canShareFiles(file)) {
        try { await navigator.share({ files: [file], text: "#SEVENTEEN #세븐틴 #앨범자켓퀴즈" }); return; } catch (e) {}
      }
      downloadShare();
      toast(T.share.insta);
    });
  }

  // 카카오톡: Kakao SDK(키 설정 시) 링크 공유, 아니면 Web Share/저장 안내
  function kakaoShare() {
    const res = state.lastRes || buildResultView();
    if (window.Kakao && window.Kakao.isInitialized && Kakao.isInitialized()) {
      try {
        Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: T.share.title,
            description: `${res.tier} · ${res.scoreLine}`,
            imageUrl: new URL("docs/img/share-card.png", location.href).href,
            link: { mobileWebUrl: location.href, webUrl: location.href },
          },
          buttons: [{ title: "나도 해보기", link: { mobileWebUrl: location.href, webUrl: location.href } }],
        });
        return;
      } catch (e) {}
    }
    resultFile(async (file) => {
      if (navigator.share && canShareFiles(file)) { try { await navigator.share({ files: [file], text: T.share.native(res.tier, res.scoreLine) }); return; } catch (e) {} }
      downloadShare();
      toast(T.share.kakao);
    });
  }

  // 카카오 SDK는 키가 있을 때만 로드/초기화(개발자센터 JavaScript 키)
  const KAKAO_JS_KEY = ""; // 예: "xxxxxxxxxxxxxxxx" 넣으면 카카오톡 공유 활성화
  function initKakao() {
    if (!KAKAO_JS_KEY) return;
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.onload = () => { try { if (window.Kakao && !Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY); } catch (e) {} };
    document.head.appendChild(s);
  }

  // ── 초기화 ──
  function init() {
    cacheDom();
    initTheme();
    document.querySelectorAll(".mode-btn").forEach((b) =>
      b.addEventListener("click", () => { if (!b.disabled) startMode(b.dataset.mode); }));
    el["btn-next"].addEventListener("click", nextRound);
    el["btn-restart"].addEventListener("click", () => { stopTimer(); show("screen-start"); });
    el["btn-rank"].addEventListener("click", registerRank);
    el["rank-name"].addEventListener("keydown", (e) => { if (e.key === "Enter") registerRank(); });
    el["btn-share"].addEventListener("click", shareMain);
    el["btn-save"].addEventListener("click", downloadShare);
    el["btn-tweet"].addEventListener("click", tweetShare);
    el["btn-insta"].addEventListener("click", instaShare);
    el["btn-kakao"].addEventListener("click", kakaoShare);
    el["btn-reload"].addEventListener("click", reloadArt);
    initKakao();
    show("screen-start");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
