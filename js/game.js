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

  // 멤버 이름: 라벨용은 {loc,en} 객체(병기), 보기용은 로케일 평문
  function nameObj(id) {
    const m = memberById[id];
    if (!m) return { loc: String(id), en: String(id) };
    const loc = I18N.locale === "ko" ? m.name : (m.en || m.name);
    return { loc, en: m.en || m.name };
  }
  const nameOf = (id) => nameObj(id).loc;

  // 앨범 문제 컨텍스트
  function qctx(rng) {
    return {
      albums: ALBUMS, years: ALBUM_YEARS, members: MEMBERS, n: CONFIG.choices, rng,
      memberName: nameObj, nameOf,
    };
  }
  // 멤버 문제 컨텍스트
  function mctx(rng) {
    return {
      members: MEMBERS, unitSongs: UNIT_SONGS, albums: ALBUMS, n: CONFIG.choices, rng,
      memberName: nameObj, nameOf,
    };
  }
  // 유튜브 솔로곡 문제 컨텍스트
  function ytctx(rng) {
    return { ytSongs: YTS, albums: ALBUMS, years: ALBUM_YEARS, n: CONFIG.choices, rng };
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
      "rank-name", "btn-rank", "rank-list", "btn-home", "btn-hud-home",
      "hall", "hall-mode", "hall-list",
      "question", "question-note", "feedback",
      "result-score", "result-detail", "result-canvas",
      "theme-toggle", "lang-select",
      "btn-report", "btn-report-result", "report-modal", "report-ctx", "report-text", "report-cancel", "report-send",
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

  // 시작화면으로 복귀(+ 명예의 전당 갱신)
  function goHome() {
    stopTimer();
    show("screen-start");
    refreshHall();
  }

  // ── 시작: 모드 선택 ──
  function startMode(mode) {
    stopTimer();
    stopHall();
    state.mode = mode;
    state.rng = Math.random;
    const albumCards = ALBUMS.map((a) => ({ kind: "album", ref: a }));
    const memberCards = MEMBERS
      .filter((m) => availableMemberTypes(m, mctx(state.rng)).length >= 1)
      .map((m) => ({ kind: "member", ref: m }));
    const ytCards = YTS.map((s) => ({ kind: "yt", ref: s }));
    state.pool = albumCards.concat(memberCards, ytCards);

    state.round = 0; state.score = 0; state.correct = 0; state.over = false; state.answers = [];
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
      label: String(q.label || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      correct: q.correct, choices: q.choices,
    };

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

    el.feedback.innerHTML = isCorrect ? T.feedback.correct
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
  function renderRankList(highlight) {
    const mode = state.mode;
    paintRankList(RANK.localList(mode), highlight, mode);
    RANK.list(mode).then((list) => {
      if (state.mode === mode) paintRankList(list, highlight, mode);
    });
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

  // ── 명예의 전당(시작화면 롤링): 모드별 기록 10건 이상이면 노출 ──
  const HALL_MIN = 10, MODES = ["normal", "endless", "timeattack"];
  let hallTimer = null, hallModes = [], hallIdx = 0;
  function stopHall() { if (hallTimer) { clearInterval(hallTimer); hallTimer = null; } }
  function refreshHall() {
    stopHall();
    if (!RANK || !el["hall"]) return;
    // 로컬 기준으로 즉시 판정/표시(원격 대기로 지연되지 않게)
    applyHall(MODES.filter((m) => RANK.localList(m).length >= HALL_MIN));
    // 원격 저장소가 있으면 병합 결과로 재판정
    if (RANK.remote) {
      RANK.counts(MODES).then((counts) => {
        applyHall(MODES.filter((m) => (counts[m] || 0) >= HALL_MIN));
      });
    }
  }
  function applyHall(modes) {
    stopHall();
    hallModes = modes;
    if (!hallModes.length) { el["hall"].hidden = true; return; }
    el["hall"].hidden = false;
    hallIdx = 0;
    showHallMode(hallModes[0]);
    if (hallModes.length > 1) {
      hallTimer = setInterval(() => {
        hallIdx = (hallIdx + 1) % hallModes.length;
        showHallMode(hallModes[hallIdx]);
      }, 8000);
    }
  }
  function paintHall(mode, list) {
    el["hall-mode"].textContent = T.hudMode[mode] || "";
    const unit = mode === "normal" ? "점" : "개";
    const rows = list.map((e, i) =>
      `<li><span class="rk">${i + 1}</span><span class="nm">${escapeHtml(e.name)}</span>` +
      `<span class="sc">${e.score}${unit}</span></li>`).join("");
    // 마퀴: 항목을 두 번 이어붙여 끊김 없는 세로 스크롤
    el["hall-list"].innerHTML = rows + rows;
    el["hall-list"].style.animationDuration = Math.max(9, list.length * 1.6) + "s";
  }
  function showHallMode(mode) {
    paintHall(mode, RANK.localList(mode).slice(0, 10)); // 로컬 즉시
    if (RANK.remote) RANK.list(mode).then((all) => {
      if (hallModes[hallIdx] === mode) paintHall(mode, all.slice(0, 10)); // 원격 병합 갱신
    });
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
    el["btn-next"].addEventListener("click", nextRound);
    // 한 판 더: 방금 한 모드로 바로 재시작 / 처음으로: 시작화면 복귀
    el["btn-restart"].addEventListener("click", () => { stopTimer(); startMode(state.mode); });
    el["btn-home"].addEventListener("click", () => { stopTimer(); goHome(); });
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
