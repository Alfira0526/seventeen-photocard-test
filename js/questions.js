/**
 * questions.js — 문제 유형 레지스트리 (순수 로직, 브라우저/Node 공용).
 *
 * 카드(앨범) 1장당 문제 1개를, 그 앨범에서 "가능한 유형" 중 가중 랜덤으로 뽑는다.
 * 각 유형은 available(al)로 출제 가능 여부를 스스로 판단 → 데이터가 있는 앨범만
 * 고난도 유형이 나온다(정확도 우선, 부분 커버리지 허용).
 *
 * 유형:
 *  - album / year / titleTrack   : 기본(모든 앨범)
 *  - notInAlbum  : 이 앨범 수록곡이 아닌 것 (tracks 필요)
 *  - lyricist    : 타이틀곡 작사에 참여한 멤버 (titleLyricists 필요)
 *  - unitSong    : 이 앨범에서 특정 유닛이 부른 곡 (tracks + unit 태그 필요)
 */
(function (root) {
  "use strict";

  const L = root ? root.QuizLogic : require("./logic.js");
  const I = root ? root.I18N : require("./i18n.js");
  const t = I.t;
  // 앨범 유형을 현재 로케일로 표기(ko는 원문 유지 → 정답 매칭·테스트 불변)
  const locType = (s) => (I.localizeType ? I.localizeType(s) : s);

  // 원반↔리패키지 혼동 방지 보조 문구(로케일 트리와 분리 · 7개 언어). albumType 보기에 '리패키지'가 섞일 때만 노출.
  const ALBUMTYPE_HINT = {
    ko: "힌트! 원반과 리패키지(재발매반)는 서로 다른 유형이에요.",
    en: "Hint! An original and its repackage count as different types.",
    ja: "ヒント！原盤とリパッケージ盤は別の種類です。",
    zh: "提示！原版和改版属于不同类型。",
    es: "¡Pista! El original y su reedición son tipos distintos.",
    th: "คำใบ้! ฉบับต้นฉบับกับฉบับรีแพ็กเกจนับเป็นคนละประเภท",
    pt: "Dica! O original e a repackage contam como tipos diferentes.",
  };
  const albumTypeHint = () => ALBUMTYPE_HINT[I.locale] || ALBUMTYPE_HINT.en;

  const TYPES = [
    {
      id: "album", weight: 1, difficulty: 1,
      // 자켓에 앨범명이 적혀 있으면(titleOnCover) 읽으면 되므로 출제 제외
      available: (al) => !al.titleOnCover,
      make: (al, c) => ({
        label: t.q.album, correct: al.title,
        choices: L.buildAlbumChoices(al, c.albums, c.n, c.rng),
      }),
    },
    {
      id: "year", weight: 1, difficulty: 1, available: () => true,
      make: (al, c) => ({
        label: t.q.year, correct: String(al.year),
        choices: L.buildYearChoices(al.year, c.years, c.n, c.rng),
      }),
    },
    // 자켓 크롭(확대) 난이도: 자켓 일부만 확대해서 앨범 맞히기. 실제 베이크된 커버가 있고
    // 표지에 앨범명이 적혀있지 않은 경우에만(읽어서 맞히는 것 방지). crop 플래그로 렌더러가 확대.
    {
      id: "albumCrop", weight: 1.1, difficulty: 4,
      available: (al) => !al.titleOnCover && !!al.art && !al.artist,
      make: (al, c) => ({
        label: t.q.albumCrop, correct: al.title, crop: true,
        choices: L.buildAlbumChoices(al, c.albums, c.n, c.rng),
      }),
    },
    {
      id: "titleTrack", weight: 1, difficulty: 2, available: () => true,
      make: (al, c) => ({
        label: t.q.track, correct: al.titleTrack,
        choices: L.buildChoices(al.titleTrack, c.albums.map((a) => a.titleTrack), c.n, c.rng),
      }),
    },
    {
      id: "notInAlbum", weight: 1.6, difficulty: 3,
      available: (al) => Array.isArray(al.tracks) && al.tracks.length >= 3,
      make: (al, c) => {
        const inTitles = al.tracks.map((x) => x.title);
        // 오답(비수록곡)은 "다른 앨범의 수록곡"에서만 뽑아 표기 포맷을 통일한다.
        const pool = [];
        c.albums.forEach((a) => {
          if (a.id !== al.id) (a.tracks || []).forEach((x) => pool.push(x.title));
        });
        const outside = [...new Set(pool)].filter((x) => x && !inTitles.includes(x));
        const correct = L.shuffle(outside, c.rng)[0];
        const distract = L.shuffle(inTitles, c.rng).slice(0, 3);
        return { label: t.q.notInAlbum, correct, note: t.note.notInAlbum,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
    {
      id: "lyricist", weight: 1.8, difficulty: 3,
      available: (al, c) =>
        Array.isArray(al.titleLyricists) && al.titleLyricists.length >= 1 &&
        c && c.members && (c.members.length - al.titleLyricists.length) >= 3,
      make: (al, c) => {
        const credited = al.titleLyricists;
        const correctId = L.shuffle(credited, c.rng)[0];
        const nonCredited = c.members.map((m) => m.id).filter((id) => !credited.includes(id));
        const distractIds = L.shuffle(nonCredited, c.rng).slice(0, 3);
        const name = (id) => (c.nameOf ? c.nameOf(id) : c.memberName(id));
        return { label: t.q.lyricist(al.titleTrack), correct: name(correctId), note: t.note.lyricist,
          choices: L.shuffle([correctId, ...distractIds].map(name), c.rng) };
      },
    },
    {
      id: "unitSong", weight: 1.6, difficulty: 4,
      available: (al) =>
        Array.isArray(al.tracks) && al.tracks.length >= 4 && al.tracks.some((x) => x.unit),
      make: (al, c) => {
        const units = [...new Set(al.tracks.filter((x) => x.unit).map((x) => x.unit))];
        const unit = L.shuffle(units, c.rng)[0];
        const correct = L.shuffle(al.tracks.filter((x) => x.unit === unit), c.rng)[0].title;
        const others = al.tracks.filter((x) => x.title !== correct).map((x) => x.title);
        const distract = L.shuffle(others, c.rng).slice(0, 3);
        return { label: t.q.unitSong(unit), correct, note: t.note.unitSong,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
    // ── A1: 앨범 유형(카테고리) ──
    {
      id: "albumType", weight: 1, difficulty: 2, available: () => true,
      make: (al, c) => {
        const correct = categoryOf(al.type);
        const pool = [...new Set(c.albums.map((a) => categoryOf(a.type)))].filter((x) => x !== correct);
        const choices = L.shuffle([correct, ...L.shuffle(pool, c.rng).slice(0, 3)], c.rng);
        const q = { label: t.q.albumType, correct: locType(correct), choices: choices.map(locType) };
        // 보기에 '리패키지'가 섞이면 원반↔리패키지 구분 보조 문구를 붙인다(2주 연속 혼동 신호 대응).
        if (choices.some((x) => /리패키지/.test(x))) q.note = albumTypeHint();
        return q;
      },
    },
    // ── A4: 몇 집 (미니/정규 N집) ──
    // SEVENTEEN 자켓은 대부분 "Nth MINI/정규 ALBUM"이 인쇄돼 있어 '몇 집?'이 정답 노출이 됨.
    // 그래서 기본은 출제 안 하고, 자켓에 번호가 없다고 '확인된'(numOnCover===false) 앨범만 출제.
    {
      id: "albumNumber", weight: 1.2, difficulty: 3,
      available: (al) => al.numOnCover === false && /(미니|정규)\s*\d+집/.test(al.type),
      make: (al, c) => {
        const cat = categoryOf(al.type);
        const pool = [...new Set(c.albums.map((a) => a.type))]
          .filter((x) => x !== al.type && /(미니|정규)\s*\d+집/.test(x));
        // 같은 카테고리(미니/정규) 오답 우선
        const ranked = pool.sort((a, b) =>
          (categoryOf(b) === cat) - (categoryOf(a) === cat) || (c.rng() - 0.5));
        const choices = L.shuffle([al.type, ...ranked.slice(0, 3)], c.rng);
        return { label: t.q.albumNumber, correct: locType(al.type), choices: choices.map(locType) };
      },
    },
    // ── A3: 이 앨범보다 나중에 나온 앨범 ──
    {
      id: "laterAlbum", weight: 1.4, difficulty: 3,
      available: (al, c) =>
        c.albums.filter((a) => a.year > al.year).length >= 1 &&
        c.albums.filter((a) => a.year < al.year).length >= 3,
      make: (al, c) => {
        const later = c.albums.filter((a) => a.year > al.year).map((a) => a.title);
        const earlier = c.albums.filter((a) => a.year < al.year).map((a) => a.title);
        const correct = L.shuffle(later, c.rng)[0];
        return { label: t.q.laterAlbum, correct, note: t.note.laterAlbum,
          choices: L.shuffle([correct, ...L.shuffle(earlier, c.rng).slice(0, 3)], c.rng) };
      },
    },
    // 발매연도 타임라인: al 포함 3개 앨범을 발매순으로 나열한 것 고르기(4지선다)
    {
      id: "timeline", weight: 1.0, difficulty: 4,
      available: (al, c) => {
        const yrs = new Set(c.albums.filter((a) => Number.isInteger(a.year) && !a.artist && a.year !== al.year).map((a) => a.year));
        return Number.isInteger(al.year) && yrs.size >= 2;
      },
      make: (al, c) => {
        const arrow = " → ";
        const others = L.shuffle(c.albums.filter((a) => Number.isInteger(a.year) && !a.artist && a.id !== al.id), c.rng);
        const picked = [al]; const years = new Set([al.year]);
        for (const a of others) { if (picked.length >= 3) break; if (!years.has(a.year)) { picked.push(a); years.add(a.year); } }
        if (picked.length < 3) return { label: t.q.album, correct: al.title, choices: L.buildAlbumChoices(al, c.albums, c.n, c.rng) };
        const seq = [...picked].sort((a, b) => a.year - b.year).map((a) => a.title);
        const correct = seq.join(arrow);
        const seen = new Set([correct]); const distract = [];
        for (let g = 0; g < 60 && distract.length < 3; g++) {
          const perm = L.shuffle(seq, c.rng).join(arrow);
          if (!seen.has(perm)) { seen.add(perm); distract.push(perm); }
        }
        return { label: t.q.timeline, correct, note: t.note.timeline,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
  ];

  // "미니 4집" → "미니 앨범", "정규 1집" → "정규 앨범", 그 외는 원문 유지
  function categoryOf(type) {
    if (/미니/.test(type)) return "미니 앨범";
    if (/정규/.test(type)) return "정규 앨범";
    return type;
  }

  function availableTypes(al, c) { return TYPES.filter((ty) => ty.available(al, c)); }

  function weightedPick(types, rng) {
    const total = types.reduce((s, ty) => s + ty.weight, 0);
    let r = (rng || Math.random)() * total;
    for (const ty of types) { if ((r -= ty.weight) <= 0) return ty; }
    return types[types.length - 1];
  }

  // 선택 난이도(diffMin~diffMax)로 유형을 좁힌다. 걸러서 없으면 원래 후보 유지(비파괴 폴백).
  function filterByDiff(types, c) {
    if (c.diffMin == null && c.diffMax == null) return types;
    const lo = c.diffMin == null ? 0 : c.diffMin, hi = c.diffMax == null ? 99 : c.diffMax;
    const f = types.filter((ty) => ty.difficulty >= lo && ty.difficulty <= hi);
    return f.length ? f : types;
  }

  // 앨범 1장 → 랜덤 유형 문제 1개.
  function buildQuestion(al, ctx) {
    const c = Object.assign({ n: 4, rng: Math.random }, ctx);
    const ty = weightedPick(filterByDiff(availableTypes(al, c), c), c.rng);
    return Object.assign({ typeId: ty.id, difficulty: ty.difficulty }, ty.make(al, c));
  }

  // ── 멤버 문제(사진 라운드) ── name 은 문제에 병기(사진 오매칭에도 정답 유지)
  const otherUnitSongs = (m, c) =>
    Object.keys(c.unitSongs).filter((u) => u !== m.unit).flatMap((u) => c.unitSongs[u]);

  // 작사 데이터가 있는 앨범들의 타이틀곡 / 그 중 멤버가 참여한 곡
  function lyricInfo(m, c) {
    const dataAlbums = c.albums.filter((a) => Array.isArray(a.titleLyricists));
    const titles = dataAlbums.map((a) => a.titleTrack);
    const written = dataAlbums.filter((a) => a.titleLyricists.includes(m.id)).map((a) => a.titleTrack);
    const absent = titles.filter((x) => !written.includes(x));
    return { written, absent };
  }

  const MEMBER_TYPES = [
    // M0: 이 멤버는 어느 유닛(팀)? — 보컬/힙합/퍼포먼스 매칭
    {
      id: "memberUnit", weight: 1.1, difficulty: 2,
      available: (m, c) => {
        const units = [...new Set(c.members.map((x) => x.unit))];
        return !!m.unit && units.length >= 2;
      },
      make: (m, c) => {
        const U = t._unit || {};
        const label3 = (u) => U[u] || u;
        const correct = label3(m.unit);
        const others = [...new Set(c.members.map((x) => x.unit))]
          .filter((u) => u !== m.unit).map(label3);
        const choices = L.shuffle([correct, ...L.shuffle(others, c.rng)], c.rng).slice(0, Math.min(c.n, 1 + others.length));
        return { label: t.qm.unit(c.memberName(m.id)), correct, note: t.note.roster,
          choices: choices.includes(correct) ? choices : [correct, ...choices].slice(0, c.n) };
      },
    },
    // M1: 이 멤버가 부른 유닛곡
    {
      id: "memberUnitSong", weight: 1.3, difficulty: 3,
      available: (m, c) => (c.unitSongs[m.unit] || []).length >= 1 && otherUnitSongs(m, c).length >= 3,
      make: (m, c) => {
        const correct = L.shuffle(c.unitSongs[m.unit], c.rng)[0];
        const distract = L.shuffle(otherUnitSongs(m, c), c.rng).slice(0, 3);
        return { label: t.qm.unitSong(c.memberName(m.id)), correct, note: t.note.unitSong,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
    // M2: 이 멤버가 부르지 않은 곡 (다른 유닛곡)
    {
      id: "memberNotSong", weight: 1.3, difficulty: 4,
      available: (m, c) => (c.unitSongs[m.unit] || []).length >= 3 && otherUnitSongs(m, c).length >= 1,
      make: (m, c) => {
        const correct = L.shuffle(otherUnitSongs(m, c), c.rng)[0]; // 이 멤버 유닛이 아닌 곡
        const distract = L.shuffle(c.unitSongs[m.unit], c.rng).slice(0, 3); // 이 멤버가 부른 곡
        return { label: t.qm.notSong(c.memberName(m.id)), correct, note: t.note.memberNot,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
    // M4: 이 멤버와 다른 유닛인 멤버
    {
      id: "memberRoster", weight: 1, difficulty: 3,
      available: (m, c) => {
        const same = c.members.filter((x) => x.unit === m.unit && x.id !== m.id);
        const other = c.members.filter((x) => x.unit !== m.unit);
        return same.length >= 3 && other.length >= 1;
      },
      make: (m, c) => {
        const nameOf = (x) => (c.nameOf ? c.nameOf(x.id) : x.name);
        const same = c.members.filter((x) => x.unit === m.unit && x.id !== m.id).map(nameOf);
        const other = c.members.filter((x) => x.unit !== m.unit).map(nameOf);
        const correct = L.shuffle(other, c.rng)[0];
        return { label: t.qm.roster(c.memberName(m.id)), correct, note: t.note.roster,
          choices: L.shuffle([correct, ...L.shuffle(same, c.rng).slice(0, 3)], c.rng) };
      },
    },
    // M5: 이 멤버가 작사한 타이틀곡 (검증된 앨범만)
    {
      id: "memberLyricist", weight: 1, difficulty: 4,
      available: (m, c) => {
        const { written, absent } = lyricInfo(m, c);
        return written.length >= 1 && absent.length >= 3;
      },
      make: (m, c) => {
        const { written, absent } = lyricInfo(m, c);
        const correct = L.shuffle(written, c.rng)[0];
        return { label: t.qm.lyricist(c.memberName(m.id)), correct, note: t.note.mlyric,
          choices: L.shuffle([correct, ...L.shuffle(absent, c.rng).slice(0, 3)], c.rng) };
      },
    },
  ];

  function availableMemberTypes(m, c) { return MEMBER_TYPES.filter((ty) => ty.available(m, c)); }

  function buildMemberQuestion(m, ctx) {
    const c = Object.assign({ n: 4, rng: Math.random }, ctx);
    const ty = weightedPick(filterByDiff(availableMemberTypes(m, c), c), c.rng);
    return Object.assign({ typeId: ty.id, difficulty: ty.difficulty }, ty.make(m, c));
  }

  // ── 유튜브 솔로 MV 라운드(썸네일을 보고 곡/연도 맞히기) ──
  const YT_TYPES = [
    {
      // 이 MV가 어떤 솔로곡인지 (오답: 다른 솔로곡 + 앨범 타이틀곡)
      id: "ytSong", weight: 1.5, difficulty: 3,
      available: (s, c) => Array.isArray(c.ytSongs) && c.ytSongs.length >= 1,
      make: (s, c) => {
        const pool = [];
        (c.ytSongs || []).forEach((x) => { if (x.title !== s.title) pool.push(x.title); });
        (c.albums || []).forEach((a) => { if (a.titleTrack) pool.push(a.titleTrack); });
        const distract = L.shuffle([...new Set(pool)].filter((x) => x && x !== s.title), c.rng).slice(0, 3);
        return { label: t.qyt.song, correct: s.title, note: t.note.yt,
          choices: L.shuffle([s.title, ...distract], c.rng) };
      },
    },
    {
      // 이 솔로곡이 언제 나왔는지
      id: "ytYear", weight: 1, difficulty: 2,
      available: (s, c) => Array.isArray(c.ytSongs) && c.ytSongs.length >= 1,
      make: (s, c) => ({
        label: t.qyt.year, correct: String(s.year), note: t.note.yt,
        choices: L.buildYearChoices(s.year, c.years, c.n, c.rng),
      }),
    },
  ];
  function availableYtTypes(s, c) { return YT_TYPES.filter((ty) => ty.available(s, c)); }
  function buildYtQuestion(s, ctx) {
    const c = Object.assign({ n: 4, rng: Math.random }, ctx);
    const ty = weightedPick(filterByDiff(availableYtTypes(s, c), c), c.rng);
    return Object.assign({ typeId: ty.id, difficulty: ty.difficulty }, ty.make(s, c));
  }

  // ── 검수(review)용: 한 항목이 만들 수 있는 "모든 유형"의 문제를 열거 ──
  // 무작위 1문제 대신, 출제 가능한 각 유형마다 1문제씩 생성해 빠짐없이 검수할 수 있게 한다.
  function buildAllOfTypes(typesAvail, ref, c) {
    const out = [];
    typesAvail.forEach((ty) => {
      try {
        const made = ty.make(ref, c);
        if (made && Array.isArray(made.choices) && made.choices.length >= 2 && made.correct != null)
          out.push(Object.assign({ typeId: ty.id, difficulty: ty.difficulty }, made));
      } catch (e) { /* 특정 유형 생성 실패는 건너뜀(검수에서 나머지 유형은 계속 확인) */ }
    });
    return out;
  }
  function allAlbumCases(al, ctx) { const c = Object.assign({ n: 4, rng: Math.random }, ctx); return buildAllOfTypes(availableTypes(al, c), al, c); }
  function allMemberCases(m, ctx) { const c = Object.assign({ n: 4, rng: Math.random }, ctx); return buildAllOfTypes(availableMemberTypes(m, c), m, c); }
  function allYtCases(s, ctx) { const c = Object.assign({ n: 4, rng: Math.random }, ctx); return buildAllOfTypes(availableYtTypes(s, c), s, c); }

  const api = { TYPES, availableTypes, buildQuestion, MEMBER_TYPES, availableMemberTypes, buildMemberQuestion, YT_TYPES, availableYtTypes, buildYtQuestion,
    allAlbumCases, allMemberCases, allYtCases };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.QuizQuestions = api;
})(typeof window !== "undefined" ? window : null);
