/**
 * SEVENTEEN Album-Cover Quiz — 게임 엔진 (DOM 전담)
 *
 * 모드: normal(랜덤 20문제·100점) / endless(무한, 틀리면 끝) /
 *       timeattack(60초·목숨 3개, 맞힌 개수 집계)
 * 라운드 = 앨범 자켓 또는 멤버 사진 1장 + 카드당 1문제(랜덤 유형), 4지선다.
 */
(function () {
  "use strict";

  const { ALBUMS, albumById, memberById, MEMBERS, ALBUM_YEARS, UNIT_SONGS, YT_SONGS } = window.SVTData;
  const { shuffle } = window.QuizLogic;
  const { buildQuestion, buildMemberQuestion, availableMemberTypes, buildYtQuestion } = window.QuizQuestions;
  const YTS = YT_SONGS || [];
  const I18N = window.I18N;
  const T = I18N.t; // UI 문자열(병기 i18n) — 내용은 setLocale 로 in-place 갱신됨

  const CONFIG = { rounds: 20, pointsPerCorrect: 5, choices: 4, taSeconds: 60, taLives: 3 };

  // 노멀 모드 점수 변별: 난이도 배점 + 속도 보너스 + 콤보 배수 (만점 동점 방지)
  const SCORE = {
    diff: { 1: 10, 2: 14, 3: 20, 4: 28 }, // 문제 난이도(1~4)별 기본 배점
    speedMax: 12,          // 속도 보너스 최대치
    speedWindowMs: 7000,   // 이 시간 안에 맞히면 보너스(선형 감소), 지나면 0
    comboStep: 0.1,        // 연속 정답 1개당 배수 증가폭
    comboCap: 9,           // 배수 상한(×1.9)
  };
  // 일반 모드 난이도 밴드: 출제 난이도 범위 + 점수 배수(통합 랭킹 유지)
  const DIFF = {
    easy:   { band: "easy",   min: 1, max: 2, mult: 0.8 },
    normal: { band: "normal", min: 1, max: 4, mult: 1.0 },
    hard:   { band: "hard",   min: 3, max: 4, mult: 1.3 },
  };

  // 현재 문제의 획득 점수(콤보는 이미 증가된 state.combo 기준, 난이도 밴드 배수 적용)
  function scoreGain(difficulty) {
    const base = SCORE.diff[difficulty] || 12;
    const elapsed = performance.now() - (state.qStart || performance.now());
    const speed = Math.round(SCORE.speedMax * Math.max(0, 1 - elapsed / SCORE.speedWindowMs));
    const combo = 1 + Math.min(Math.max(0, state.combo - 1), SCORE.comboCap) * SCORE.comboStep;
    const bandMult = (state.diff && state.diff.mult) || 1;
    return Math.max(1, Math.round((base + speed) * combo * bandMult));
  }

  // 멤버 이름: 라벨용은 {loc,en} 객체(병기), 보기용은 로케일 평문
  function nameObj(id) {
    const m = memberById[id];
    if (!m) return { loc: String(id), en: String(id) };
    const loc = I18N.locale === "ko" ? m.name : (m.en || m.name);
    return { loc, en: m.en || m.name };
  }
  const nameOf = (id) => nameObj(id).loc;

  // 선택 난이도 밴드의 출제 범위(없으면 전체) — 모든 ctx에 실어 문제 유형을 좁힌다.
  function diffRange() {
    return state.diff ? { diffMin: state.diff.min, diffMax: state.diff.max } : {};
  }
  // 앨범 문제 컨텍스트
  function qctx(rng) {
    return Object.assign({
      albums: ALBUMS, years: ALBUM_YEARS, members: MEMBERS, n: CONFIG.choices, rng,
      memberName: nameObj, nameOf,
    }, diffRange());
  }
  // 멤버 문제 컨텍스트
  function mctx(rng) {
    return Object.assign({
      members: MEMBERS, unitSongs: UNIT_SONGS, albums: ALBUMS, n: CONFIG.choices, rng,
      memberName: nameObj, nameOf,
    }, diffRange());
  }
  // 유튜브 솔로곡 문제 컨텍스트
  function ytctx(rng) {
    return Object.assign({ ytSongs: YTS, albums: ALBUMS, years: ALBUM_YEARS, n: CONFIG.choices, rng }, diffRange());
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
    combo: 0,       // 연속 정답 수(노멀 점수 배수)
    qStart: 0,      // 현재 문제 표시 시각(속도 보너스 계산)
    diff: null,     // 일반 모드 난이도 밴드(startMode에서 설정)
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
      "rank-name", "btn-rank", "rank-list", "btn-legacy", "btn-home", "btn-hud-home",
      "season-banner",
      "hall", "hall-season", "hall-tab-month", "hall-tab-quarter",
      "hall-h-normal", "hall-h-endless", "hall-h-timeattack",
      "hall-src-normal", "hall-src-endless", "hall-src-timeattack",
      "hall-champ-normal", "hall-champ-endless", "hall-champ-timeattack",
      "hall-normal", "hall-endless", "hall-timeattack",
      "question", "question-note", "feedback",
      "result-score", "result-detail", "result-canvas",
      "theme-toggle", "lang-select",
      "btn-report", "btn-report-result", "btn-report-play", "report-modal", "report-ctx", "report-text", "report-cancel", "report-send",
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }
  function show(screen) {
    ["screen-start", "screen-play", "screen-result"].forEach((s) =>
      el[s].classList.toggle("active", s === screen));
    // 플레이 중에는 바닥 플로팅 FAB를 숨겨 '다음 문제' 버튼과 겹치지 않게(모바일)
    document.body.classList.toggle("playing", screen === "screen-play");
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

  // 시작화면으로 복귀(+ 명예의 전당 갱신)
  function goHome() {
    stopTimer();
    show("screen-start");
    renderSeasonBanner();
    refreshHall();
    startHallPoll(); // 시작화면에서 실시간 순위 갱신 시작
  }

  // 시즌 종료 카운트다운 배너(막판 D-noticeDays 이내엔 '순위 굳히기' 강조)
  function renderSeasonBanner() {
    const b = el["season-banner"];
    if (!b || !window.SVTSeason) return;
    const s = window.SVTSeason.active();
    const d = window.SVTSeason.daysLeft();
    const name = activeMonthName(); // 오픈베타(7월) 또는 'M월'
    if (window.SVTSeason.isFinalPush()) {
      b.className = "season-banner final";
      b.innerHTML = `<b>🏆 ${name}</b> · ${T.season.final(d)}`;
    } else {
      b.className = "season-banner";
      b.innerHTML = `<b>🏆 ${name}</b> · ${T.season.endsIn(d)}`;
    }
    b.hidden = false;
  }

  // ── 시작: 모드 선택 ──
  function startMode(mode, band) {
    stopTimer();
    stopHall();
    stopHallPoll(); // 플레이 시작하면 실시간 폴링 중지
    state.mode = mode;
    // 난이도 밴드는 일반 모드에만 적용(무한·타임어택은 전체·배수 1.0)
    state.diff = (mode === "normal") ? (DIFF[band] || DIFF.normal) : DIFF.normal;
    state.rng = Math.random;
    const albumCards = ALBUMS.map((a) => ({ kind: "album", ref: a }));
    const memberCards = MEMBERS
      .filter((m) => availableMemberTypes(m, mctx(state.rng)).length >= 1)
      .map((m) => ({ kind: "member", ref: m }));
    const ytCards = YTS.map((s) => ({ kind: "yt", ref: s }));
    state.pool = albumCards.concat(memberCards, ytCards);

    state.round = 0; state.score = 0; state.correct = 0; state.over = false; state.answers = []; state.combo = 0;
    el.score.textContent = "0";
    el["hud-mode"].textContent = T.hudMode[mode] || "";
    if (window.SVTAnalytics) window.SVTAnalytics.play(mode);

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

    // 카드당 1문제: 카드 종류에 맞는 문제 생성
    const q = card.kind === "member"
      ? buildMemberQuestion(card.ref, mctx(state.rng))
      : card.kind === "yt"
        ? buildYtQuestion(card.ref, ytctx(state.rng))
        : buildQuestion(card.ref, qctx(state.rng));
    renderQuestion(q);
    // 현재 문제 맥락(텔레메트리·오류 제보용, 평문)
    state.cur = {
      mode: state.mode, typeId: q.typeId, cardKind: card.kind, cardId: card.ref.id,
      difficulty: q.difficulty,
      label: String(q.label || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      correct: q.correct, choices: q.choices,
    };
    state.qStart = performance.now(); // 속도 보너스 기준 시각

    el.feedback.innerHTML = ""; el.feedback.className = "feedback";
    el["btn-next"].disabled = true;
    // 무한/타임어택은 자동 진행 → '다음 문제' 버튼 숨김
    el["btn-next"].hidden = !state.limited;
    el["btn-next"].innerHTML = state.round + 1 === state.deck.length ? T.next.result : T.next.more;

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

  // 유튜브 썸네일 URL(고화질 → 실패 시 hq 로 폴백)
  function ytThumb(id, q) {
    return `https://img.youtube.com/vi/${id}/${q === "hq" ? "hqdefault" : "maxresdefault"}.jpg`;
  }

  // ── 카드 렌더: 앨범(자켓) / 멤버(사진) / 유튜브(MV 썸네일) ──
  function renderCardArt(card) {
    const stage = el["card-art"];
    el["btn-reload"].hidden = true;
    stage.classList.toggle("member", card.kind === "member");
    stage.classList.toggle("yt", card.kind === "yt");

    if (card.kind === "member") {
      const m = card.ref;
      const photos = (m.photos && m.photos.length) ? m.photos : (m.photo ? [m.photo] : []);
      if (photos.length) mountImage(stage, photos[Math.floor(Math.random() * photos.length)], card);
      else showMemberPlaceholder(stage, m);
      return;
    }
    if (card.kind === "yt") {
      mountImage(stage, ytThumb(card.ref.yt, "maxres"), card);
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
    const isYt = card.kind === "yt";
    const img = document.createElement("img");
    img.alt = isYt ? "유튜브 뮤직비디오 썸네일" : isMember ? "멤버 사진" : "앨범 자켓";
    img.addEventListener("load", () => {
      // 유튜브 maxres 미존재 시 회색 기본이미지(≤120px) → hqdefault 로 폴백
      if (isYt && url.indexOf("maxresdefault") >= 0 && img.naturalWidth <= 120) {
        if (isCurrent(card)) mountImage(stage, ytThumb(card.ref.yt, "hq"), card, retried);
        return;
      }
      img.classList.add("loaded"); stage.classList.remove("loading");
      el["card-caption"].innerHTML = isYt ? "© YouTube" : isMember ? "© kpop.fandom" : T.caption.loaded;
      el["btn-reload"].hidden = true;
    });
    img.addEventListener("error", () => {
      if (!isCurrent(card)) return;
      if (isYt && url.indexOf("maxresdefault") >= 0) { mountImage(stage, ytThumb(card.ref.yt, "hq"), card, retried); return; }
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
    el["card-caption"].innerHTML = isError ? T.caption.error : T.caption.noArt;
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
    el["question-note"].innerHTML = q.note || "";
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // ── 보기 선택(카드당 1문제) ──
  function selectChoice(btn, correct) {
    const c = el["question"];
    if (c.dataset.answered === "true" || state.over) return;
    c.dataset.answered = "true";
    const isCorrect = String(btn.dataset.value) === String(correct);
    if (window.SVTAnalytics && state.cur) {
      window.SVTAnalytics.answer(state.cur.typeId, isCorrect, state.cur.typeId + "__" + state.cur.cardKind + "_" + state.cur.cardId);
    }
    let gain = 0;
    if (isCorrect) {
      state.correct++;
      if (state.mode === "normal") {
        state.combo++;
        gain = scoreGain(state.cur && state.cur.difficulty);
      } else {
        gain = 1;
      }
      animateScore(state.score, (state.score += gain));
    } else {
      state.combo = 0; // 콤보 리셋
    }
    c.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true; b.setAttribute("aria-disabled", "true");
      if (String(b.dataset.value) === String(correct)) { b.classList.add("correct"); b.setAttribute("aria-label", b.textContent + " (정답)"); }
      else if (b === btn) { b.classList.add("wrong"); b.setAttribute("aria-label", b.textContent + " (오답)"); }
    });
    finishRound(isCorrect, gain);
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

  function finishRound(isCorrect, gain) {
    state.answers.push({ correct: isCorrect });
    updateHud();

    // 목숨 처리(무한=1, 타임어택=3)
    let ended = false;
    if (!isCorrect && state.lives !== Infinity) {
      state.lives--;
      updateHud();
      if (state.lives <= 0) ended = true;
    }

    // 노멀 정답: 획득 점수(+콤보) 표기로 점수 변별을 눈에 보이게
    let extra = "";
    if (isCorrect && state.mode === "normal" && gain) {
      const flame = state.combo >= 3 ? ` <span class="combo">🔥${state.combo}</span>` : "";
      extra = ` <span class="gain">+${gain}</span>${flame}`;
    }
    el.feedback.innerHTML = (isCorrect ? T.feedback.correct + extra
      : (ended ? T.feedback.over : T.feedback.wrong));
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

  // ── 결과 ── 모드별 결과 뷰(화면=병기 HTML, 공유카드=평문)
  function buildResultView() {
    const hits = state.correct;
    const RA = I18N.raw(I18N.locale);
    const modeText = RA.shareMode[state.mode] || "";
    if (state.mode === "normal") {
      const total = state.deck.length, pct = total ? Math.round((hits / total) * 100) : 0;
      return {
        rankScore: state.score, modeText,
        scoreHtml: T.resScore.normal(state.score),
        tierHtml: T.tier.normal(pct), subHtml: T.resSub.normal(total, hits, pct),
        tierText: RA.tier.normal(pct), scoreLine: RA.resLine.normal(state.score),
      };
    }
    if (state.mode === "endless") {
      return {
        rankScore: hits, modeText,
        scoreHtml: T.resScore.endless(hits),
        tierHtml: T.tier.count(hits), subHtml: T.resSub.endless(hits),
        tierText: RA.tier.count(hits), scoreLine: RA.resLine.endless(hits),
      };
    }
    return {
      rankScore: hits, modeText,
      scoreHtml: T.resScore.time(hits),
      tierHtml: T.tier.count(hits), subHtml: T.resSub.time(CONFIG.taSeconds, hits),
      tierText: RA.tier.count(hits), scoreLine: RA.resLine.time(hits),
    };
  }

  function showResult() {
    stopTimer();
    if (window.SVTAnalytics) window.SVTAnalytics.finish(state.mode);
    const res = buildResultView();
    state.lastRes = res;
    el["result-score"].innerHTML = res.scoreHtml;
    el["result-detail"].innerHTML = `<p class="tier">${res.tierHtml}</p><p class="pct">${res.subHtml}</p>`;
    el["rank-name"].value = store.get(LS.name, "");
    el["btn-rank"].disabled = false;
    rankLegacy = false; // 결과 진입 시 항상 현재 시즌부터
    renderRankList();
    drawShareCard(res);
    show("screen-result");
  }

  // ── 랭킹(로컬 즉시 + 원격 공유 병합) — 등록한 모드의 순위만 노출 ──
  const RANK = window.SVTRanking;
  function registerRank() {
    if (!state.lastRes) return;
    const name = (el["rank-name"].value || "익명").trim().slice(0, 12) || "익명";
    store.set(LS.name, name);
    const entry = { name, score: state.lastRes.rankScore, mode: state.mode, ts: nowStamp() };
    el["btn-rank"].disabled = true;
    RANK.add(entry).then(() => renderRankList(entry));
    renderRankList(entry); // 낙관적 즉시 반영
    toast(T.rank.saved);
  }

  // 현재 모드의 순위만 그린다(로컬 즉시 → 원격 병합 시 갱신)
  // rankLegacy=true 면 지난 시즌(구 100점제) 기록을 보여준다.
  let rankLegacy = false;
  function renderRankList(highlight) {
    // rankLegacy=true → 오픈베타(구 100점제, 접미사 없음) 기록. 기본은 이번 달.
    const mode = state.mode, opts = rankLegacy ? { suffix: "" } : undefined;
    const hl = rankLegacy ? null : highlight;
    paintRankList(RANK.localList(mode, opts), hl, mode);
    RANK.list(mode, opts).then((list) => {
      if (state.mode === mode) paintRankList(list, hl, mode);
    });
    if (el["btn-legacy"]) el["btn-legacy"].innerHTML = rankLegacy ? T.ui.legacyHide : T.ui.legacyShow;
  }
  function paintRankList(list, highlight, mode) {
    const top = list.slice(0, 10);
    const unit = mode === "normal" ? "점" : "개";
    el["rank-list"].innerHTML = top.length
      ? top.map((e, i) => {
          const me = highlight && e.ts === highlight.ts && e.name === highlight.name;
          return `<li class="${me ? "me" : ""}"><span class="rk">${i + 1}</span>` +
            `<span class="nm">${escapeHtml(e.name)}</span><span class="sc">${e.score}${unit}</span></li>`;
        }).join("")
      : `<li class="empty">${T.rank.empty}</li>`;
  }

  function nowStamp() { try { return Date.now(); } catch (e) { return Math.random(); } }

  // ── 명예의 전당(시작화면): 3모드(일반·무한·타임어택)를 한 화면에 나란히 ──
  //  · [이번 달] 탭: 이번 달 순위. 이번 달 기록이 HALL_SWAP 미만이면 지난 달(없으면 오픈베타)을
  //    대신 노출. 각 모드 '지난 달 1위'(없으면 오픈베타 1위)를 🏅 챔피언으로 상시 박제.
  //  · [분기 누적] 탭: 이번 분기 3개월 데이터를 합산한 순위(별도 리셋 아님).
  const HALL_SWAP = 3, MODES = ["normal", "endless", "timeattack"];
  let hallView = "month"; // "month" | "quarter"
  function stopHall() { /* 컬럼형은 CSS 애니메이션이라 타이머 없음(호환용) */ }

  // 실시간 갱신: 시작화면이 떠 있는 동안 주기적으로 원격 순위를 다시 불러와 1위 변동을 반영
  let hallPoll = null;
  function stopHallPoll() { if (hallPoll) { clearInterval(hallPoll); hallPoll = null; } }
  function startHallPoll() {
    stopHallPoll();
    if (!RANK || !RANK.remote) return; // 원격 저장소 없으면 폴링 불필요
    hallPoll = setInterval(function () {
      try {
        if (!document.hidden && el["screen-start"] && el["screen-start"].classList.contains("active")) refreshHall();
      } catch (e) {}
    }, 15000); // 15초 주기
  }
  function unitOf(mode) { return mode === "normal" ? "점" : "개"; }
  // 2026-07은 '오픈베타' 기간, 그 1위는 '시즌 첫 챔피언'으로 표기(8월부터는 일반 월간)
  const BETA_YM = "202607";
  function monthLabelOf(s) { return s ? (s.ym === BETA_YM ? T.season.beta : T.season.month(s.m)) : ""; }
  function champLabelOf(s) { return (s && s.ym === BETA_YM) ? T.season.firstChamp : T.season.champ(monthLabelOf(s)); }
  function activeMonthName() { return monthLabelOf(window.SVTSeason && window.SVTSeason.active()); }
  function prevMonthName() { return monthLabelOf(window.SVTSeason && window.SVTSeason.previous()); }
  function quarterName() { const q = window.SVTSeason && window.SVTSeason.quarter(); return q ? `${q.y} ${T.season.quarter(q.q)}` : T.season.tabQuarter; }

  function renderHallTabs() {
    const t = el["hall-tab-month"], q = el["hall-tab-quarter"];
    if (t) { t.textContent = T.season.tabMonth; t.classList.toggle("active", hallView === "month"); }
    if (q) { q.textContent = T.season.tabQuarter; q.classList.toggle("active", hallView === "quarter"); }
  }
  function refreshHall() {
    if (!RANK || !el["hall"]) return;
    renderHallTabs();
    return hallView === "quarter" ? refreshHallQuarter() : refreshHallMonth();
  }

  // 이번 달(+ 지난 달/오픈베타 폴백)
  function refreshHallMonth() {
    const prevSuf = window.SVTSeason ? window.SVTSeason.previous().suffix : "";
    const rows = (getter) => MODES.map((m) => ({
      mode: m,
      curList: getter(m),
      prevList: getter(m, { suffix: prevSuf }),
      betaList: getter(m, { suffix: "" }),
    }));
    paintHallMonth(rows((m, o) => RANK.localList(m, o)));
    if (RANK.remote) {
      Promise.all(MODES.map(async (m) => ({
        mode: m,
        curList: await RANK.list(m),
        prevList: await RANK.list(m, { suffix: prevSuf }),
        betaList: await RANK.list(m, { suffix: "" }),
      }))).then(paintHallMonth).catch(() => {});
    }
  }
  function paintHallMonth(data) {
    const active = window.SVTSeason && window.SVTSeason.active();
    const prev = window.SVTSeason && window.SVTSeason.previous();
    let shown = 0;
    data.forEach((d) => {
      const useCur = d.curList.length >= HALL_SWAP;
      // 금색 1위 박제 = "지금 보여주는 보드의 실제 1위". 라벨은 그 보드 시즌 기준
      //  · 오픈베타(2026-07) 1위 → "시즌 첫 챔피언"  · 그 외 → "M월 1위"
      let board, boardName, champLabel;
      if (useCur) {
        board = d.curList; boardName = activeMonthName(); champLabel = champLabelOf(active);
      } else if (d.prevList.length > 0) {
        board = d.prevList; boardName = prevMonthName(); champLabel = champLabelOf(prev);
      } else {
        board = d.betaList; boardName = T.season.beta; champLabel = T.season.champ(T.season.beta);
      }
      shown += paintHallCol(d.mode, {
        champion: board[0] || null,
        champLabel: champLabel,
        board: board,
        boardName: boardName,
        boardIsCur: useCur,
        skipChampInBoard: true, // 1위는 위에 박제 → 리스트는 2위부터
      });
    });
    el["hall"].hidden = !(shown > 0);
    if (el["hall-season"]) el["hall-season"].textContent = activeMonthName();
  }

  // 이번 분기 누적(3개월 병합)
  function refreshHallQuarter() {
    const sufs = window.SVTSeason ? window.SVTSeason.quarterMonths() : [""];
    paintHallQuarter(MODES.map((m) => ({ mode: m, list: RANK.localList(m, { suffixes: sufs }) })));
    if (RANK.remote) {
      Promise.all(MODES.map(async (m) => ({ mode: m, list: await RANK.list(m, { suffixes: sufs }) })))
        .then(paintHallQuarter).catch(() => {});
    }
  }
  function paintHallQuarter(data) {
    let shown = 0;
    data.forEach((d) => {
      shown += paintHallCol(d.mode, {
        champion: null, champName: "",
        board: d.list, boardName: quarterName(), boardIsCur: true, skipChampInBoard: false,
      });
    });
    el["hall"].hidden = !(shown > 0);
    if (el["hall-season"]) el["hall-season"].textContent = quarterName();
  }

  // 반환: 표시된 항목 수(챔피언 + 리스트) — 홀 노출 판정용
  function paintHallCol(mode, o) {
    const head = el["hall-h-" + mode], srcEl = el["hall-src-" + mode];
    const champEl = el["hall-champ-" + mode], ol = el["hall-" + mode];
    if (head) head.textContent = T.hudMode[mode] || mode;
    if (!ol) return 0;
    const unit = unitOf(mode);
    let count = 0;
    if (champEl) {
      if (o.champion) {
        champEl.hidden = false;
        champEl.innerHTML =
          `<div class="champ-top"><span class="crown">🏅</span><span class="champ-label">${o.champLabel || ""}</span></div>` +
          `<div class="champ-bot"><span class="champ-name">${escapeHtml(o.champion.name)}</span><span class="champ-score">${o.champion.score}${unit}</span></div>`;
        count++;
      } else { champEl.hidden = true; champEl.innerHTML = ""; }
    }
    if (srcEl) { srcEl.textContent = o.boardName; srcEl.className = "hall-src " + (o.boardIsCur ? "is-cur" : "is-beta"); }

    const board = o.board || [];
    const start = (o.skipChampInBoard && o.champion) ? 1 : 0;
    const liveList = board.slice(start, start + 10);
    if (!liveList.length) {
      ol.innerHTML = count ? "" : `<li class="empty">${T.rank.empty}</li>`;
      ol.style.animation = "none";
      return count;
    }
    const rows = liveList.map((e, i) =>
      `<li><span class="rk">${start + 1 + i}</span><span class="nm">${escapeHtml(e.name)}</span>` +
      `<span class="sc">${e.score}${unit}</span></li>`).join("");
    if (liveList.length >= 5) {
      ol.innerHTML = rows + rows; // 끊김 없는 세로 롤링
      ol.style.animation = "";
      ol.style.animationDuration = Math.max(9, liveList.length * 1.6) + "s";
    } else {
      ol.innerHTML = rows;
      ol.style.animation = "none";
    }
    return count + liveList.length;
  }

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
    const RA = I18N.raw(I18N.locale);
    ctx.textAlign = "center"; ctx.fillStyle = "#f2f2f7";
    ctx.font = "700 40px Pretendard, sans-serif";
    ctx.fillText(RA.share.title, W / 2, 130);
    // 등급(평문)
    ctx.font = "800 84px Pretendard, sans-serif";
    ctx.fillStyle = "#ff5c9d"; ctx.fillText(res.tierText, W / 2, 300);
    // 점수(모드별 표현, 평문)
    ctx.fillStyle = "#f2f2f7"; ctx.font = "800 96px Pretendard, sans-serif";
    ctx.fillText(res.scoreLine, W / 2, 430);
    ctx.fillStyle = "#9a9ab0"; ctx.font = "500 38px Pretendard, sans-serif";
    ctx.fillText(res.modeText, W / 2, 492);
    // 태그·링크를 이미지에 새겨, 텍스트를 지우는 앱(인스타·카톡)에서도 보이게 함
    ctx.fillStyle = "#b9a7ff"; ctx.font = "700 28px Pretendard, sans-serif";
    ctx.fillText(RA.share.tags, W / 2, 552);
    ctx.fillStyle = "#8a8aa0"; ctx.font = "400 28px Pretendard, sans-serif";
    ctx.fillText(siteUrl(), W / 2, 596);
  }

  // 공유·이미지에 넣을 사이트 주소(짧게)
  function siteUrl() {
    try { return (location.host + location.pathname).replace(/\/+$/, "") || location.host; }
    catch (e) { return "SEVENTEEN Album Cover Quiz"; }
  }
  // 클립보드 복사(사용자 제스처 내에서 호출해야 함)
  function copyText(s) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s); } catch (e) {}
    return Promise.resolve();
  }

  // 결과 캔버스를 PNG File 로 변환
  function resultFile(cb) {
    el["result-canvas"].toBlob((blob) => {
      cb(blob ? new File([blob], `svt-quiz-${todayKey()}.png`, { type: "image/png" }) : null);
    }, "image/png");
  }
  // Web Share: 이미지(파일) + 링크를 함께 전송.
  // ⚠️ 다수 플랫폼(안드로이드 Chrome 등)은 files 와 url 을 "동시에" 못 보낸다
  //    → files 와 함께 url 필드를 넣으면 canShare 가 false 가 되어 이미지가 빠진다.
  //    그래서 링크는 캡션(text) 안에 넣어 이미지와 같이 전달한다.
  async function webShare(file, text) {
    const link = location.href;
    const caption = text + "\n" + link;                 // 링크를 캡션에 포함 → 이미지와 함께 전달
    const withFile = { files: [file], text: caption };  // 이미지 + (링크 포함 캡션), url 필드는 넣지 않음
    const noFile = { text: caption, url: link };         // 파일 미지원 기기 → 텍스트+링크
    try {
      if (file && navigator.canShare && navigator.canShare(withFile)) { await navigator.share(withFile); return true; }
      if (navigator.share) { await navigator.share(noFile); return true; }
    } catch (e) {
      if (e && e.name === "AbortError") return true; // 사용자가 취소한 것은 성공으로 간주
    }
    return false;
  }

  // 간단 토스트 안내
  function toast(msg) {
    let t = document.getElementById("svt-toast");
    if (!t) { t = document.createElement("div"); t.id = "svt-toast"; t.className = "toast"; document.body.appendChild(t); }
    t.innerHTML = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ── 오류 제보 모달 ──
  function openReport() {
    const R = I18N.raw(I18N.locale);
    const c = state.cur;
    if (c && el["screen-play"].classList.contains("active")) {
      el["report-ctx"].textContent = `${R.ui.reportCtxLabel}: ${c.label}` + (c.correct != null ? ` · ✔ ${c.correct}` : "");
      el["report-ctx"].hidden = false;
    } else {
      el["report-ctx"].hidden = true;
    }
    el["report-text"].value = "";
    el["report-modal"].hidden = false;
    setTimeout(() => el["report-text"].focus(), 30);
  }
  function closeReport() { el["report-modal"].hidden = true; }
  function submitReport() {
    const text = (el["report-text"].value || "").trim();
    const ctx = (state.cur && el["screen-play"].classList.contains("active")) ? state.cur : null;
    if (!text && !ctx) { closeReport(); return; }
    if (window.SVTReport) window.SVTReport.submit({ text: text, ctx: ctx });
    closeReport();
    toast(T.ui.reportThanks);
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
    const text = T.share.native(res.tierText, res.scoreLine);
    resultFile(async (file) => {
      const ok = await webShare(file, text);
      if (!ok) { downloadShare(); toast(T.share.fallback); }
    });
  }

  // 트위터(X): 모바일은 네이티브 공유로 이미지+캡션(링크 포함) 첨부,
  //            데스크톱은 인텐트(text+url 링크) + 이미지 저장.
  function tweetShare() {
    const res = state.lastRes || buildResultView();
    const text = T.share.tweet(res.tierText, res.scoreLine);
    const link = location.href;
    resultFile(async (file) => {
      const payload = { files: [file], text: text + "\n" + link };
      if (file && navigator.canShare && navigator.canShare(payload)) {
        try { await navigator.share(payload); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      // 데스크톱 폴백: 인텐트에 url 파라미터로 링크 포함(이미지는 인텐트 첨부 불가 → 저장 후 수동)
      downloadShare();
      const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(link);
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  // 인스타그램: 스토리는 텍스트/링크를 못 받음 → 이미지에 태그·URL을 새겨두고,
  //            링크·태그는 클립보드에 복사해 스토리 텍스트에 붙여넣게 안내.
  function instaShare() {
    const res = state.lastRes || buildResultView();
    const text = T.share.native(res.tierText, res.scoreLine);
    copyText(text + "\n" + location.href); // 사용자 제스처 내 복사
    resultFile(async (file) => {
      const ok = await webShare(file, text);
      toast(ok ? T.share.copied : T.share.insta);
      if (!ok) downloadShare();
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
            description: `${res.tierText} · ${res.scoreLine}`,
            imageUrl: new URL("docs/img/share-card.png", location.href).href,
            link: { mobileWebUrl: location.href, webUrl: location.href },
          },
          buttons: [{ title: "나도 해보기", link: { mobileWebUrl: location.href, webUrl: location.href } }],
        });
        return;
      } catch (e) {}
    }
    const text = T.share.native(res.tierText, res.scoreLine);
    copyText(text + "\n" + location.href); // 카톡이 텍스트를 지워도 붙여넣을 수 있게 복사
    resultFile(async (file) => {
      const ok = await webShare(file, text);
      toast(ok ? T.share.copied : T.share.kakao);
      if (!ok) downloadShare();
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

  // ── 다국어: 정적 화면 문자열 적용(병기) + 언어 선택기 ──
  function applyStatic() {
    const R = I18N.raw(I18N.locale);
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const k = node.getAttribute("data-i18n");
      if (T.ui[k] != null) node.innerHTML = T.ui[k];
    });
    // 속성(placeholder/title 등)은 병기 불가 → 지역 언어 평문으로
    document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      node.getAttribute("data-i18n-attr").split(",").forEach((pair) => {
        const i = pair.indexOf(":");
        const attr = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
        if (R.ui[k] != null) node.setAttribute(attr, R.ui[k]);
      });
    });
    try { document.title = R.share.title; } catch (e) {}
    if (el["hud-mode"]) el["hud-mode"].textContent = T.hudMode[state.mode] || "";
    // 시즌 배너/명예의전당도 로케일 전환에 맞춰 갱신
    if (el["season-banner"] && !el["season-banner"].hidden) renderSeasonBanner();
    // 난이도 칩 라벨(단일언어 평문)
    const dc = R.diffChip || {};
    document.querySelectorAll("[data-diff-label]").forEach((n) => {
      const k = n.getAttribute("data-diff-label"); if (dc[k] != null) n.textContent = dc[k];
    });
    const drl = document.getElementById("diff-row-label");
    if (drl && dc.label) drl.textContent = "🎲 " + dc.label;
  }

  function buildLangUI() {
    const sel = el["lang-select"];
    if (!sel) return;
    sel.innerHTML = I18N.SUPPORTED.map((c) => `<option value="${c}">${I18N.LANG_NAMES[c]}</option>`).join("");
    sel.value = I18N.locale;
    sel.addEventListener("change", () => {
      if (window.SVTGeo) window.SVTGeo.choose(sel.value);
      else I18N.setLocale(sel.value);
    });
  }
  function syncLangUI() { if (el["lang-select"]) el["lang-select"].value = I18N.locale; }

  // ── 초기화 ──
  function init() {
    cacheDom();
    initTheme();
    buildLangUI();
    applyStatic();
    I18N.onChange(() => { applyStatic(); syncLangUI(); refreshHall(); });
    document.querySelectorAll(".mode-btn").forEach((b) =>
      b.addEventListener("click", () => { if (!b.disabled) startMode(b.dataset.mode); }));
    // 난이도 칩: 원탭으로 그 난이도의 일반 모드 시작
    document.querySelectorAll(".diff-chip").forEach((c) =>
      c.addEventListener("click", () => startMode("normal", c.dataset.diff)));
    el["btn-next"].addEventListener("click", nextRound);
    // 한 판 더: 방금 한 모드로 바로 재시작 / 처음으로: 시작화면 복귀
    el["btn-restart"].addEventListener("click", () => { stopTimer(); startMode(state.mode); });
    el["btn-home"].addEventListener("click", () => { stopTimer(); goHome(); });
    if (el["btn-legacy"]) el["btn-legacy"].addEventListener("click", () => { rankLegacy = !rankLegacy; renderRankList(); });
    if (el["hall-tab-month"]) el["hall-tab-month"].addEventListener("click", () => { hallView = "month"; refreshHall(); });
    if (el["hall-tab-quarter"]) el["hall-tab-quarter"].addEventListener("click", () => { hallView = "quarter"; refreshHall(); });
    if (el["btn-hud-home"]) el["btn-hud-home"].addEventListener("click", () => {
      const msg = I18N.raw(I18N.locale).ui.quitConfirm;
      if (window.confirm(msg)) { stopTimer(); goHome(); }
    });
    el["btn-rank"].addEventListener("click", registerRank);
    el["rank-name"].addEventListener("keydown", (e) => { if (e.key === "Enter") registerRank(); });
    el["btn-share"].addEventListener("click", shareMain);
    el["btn-save"].addEventListener("click", downloadShare);
    el["btn-tweet"].addEventListener("click", tweetShare);
    el["btn-insta"].addEventListener("click", instaShare);
    el["btn-kakao"].addEventListener("click", kakaoShare);
    el["btn-reload"].addEventListener("click", reloadArt);
    // 오류 제보
    el["btn-report"].addEventListener("click", openReport);
    if (el["btn-report-result"]) el["btn-report-result"].addEventListener("click", openReport);
    if (el["btn-report-play"]) el["btn-report-play"].addEventListener("click", openReport);
    el["report-cancel"].addEventListener("click", closeReport);
    el["report-send"].addEventListener("click", submitReport);
    el["report-modal"].addEventListener("click", (e) => { if (e.target === el["report-modal"]) closeReport(); });
    initKakao();
    goHome();
    // 접속 지역(IP) 기반 로케일 보정 — IP가 브라우저 언어보다 우선(사용자가 직접 고른 경우 제외)
    // 시작화면이면 정적 문구가 즉시 갱신되고, 플레이 중이면 다음 문제부터 반영됨.
    if (window.SVTGeo) window.SVTGeo.init((code) => I18N.setLocale(code));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
