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

  const TYPES = [
    {
      id: "album", weight: 1, available: () => true,
      make: (al, c) => ({
        label: t.q.album, correct: al.title,
        choices: L.buildAlbumChoices(al, c.albums, c.n, c.rng),
      }),
    },
    {
      id: "year", weight: 1, available: () => true,
      make: (al, c) => ({
        label: t.q.year, correct: String(al.year),
        choices: L.buildYearChoices(al.year, c.years, c.n, c.rng),
      }),
    },
    {
      id: "titleTrack", weight: 1, available: () => true,
      make: (al, c) => ({
        label: t.q.track, correct: al.titleTrack,
        choices: L.buildChoices(al.titleTrack, c.albums.map((a) => a.titleTrack), c.n, c.rng),
      }),
    },
    {
      id: "notInAlbum", weight: 1.6,
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
      id: "lyricist", weight: 1.8,
      available: (al, c) =>
        Array.isArray(al.titleLyricists) && al.titleLyricists.length >= 1 &&
        c && c.members && (c.members.length - al.titleLyricists.length) >= 3,
      make: (al, c) => {
        const credited = al.titleLyricists;
        const correctId = L.shuffle(credited, c.rng)[0];
        const nonCredited = c.members.map((m) => m.id).filter((id) => !credited.includes(id));
        const distractIds = L.shuffle(nonCredited, c.rng).slice(0, 3);
        const name = (id) => c.memberName(id);
        return { label: t.q.lyricist(al.titleTrack), correct: name(correctId), note: t.note.lyricist,
          choices: L.shuffle([correctId, ...distractIds].map(name), c.rng) };
      },
    },
    {
      id: "unitSong", weight: 1.6,
      available: (al) =>
        Array.isArray(al.tracks) && al.tracks.length >= 4 && al.tracks.some((x) => x.unit),
      make: (al, c) => {
        const units = [...new Set(al.tracks.filter((x) => x.unit).map((x) => x.unit))];
        const unit = L.shuffle(units, c.rng)[0];
        const correct = L.shuffle(al.tracks.filter((x) => x.unit === unit), c.rng)[0].title;
        const others = al.tracks.filter((x) => x.title !== correct).map((x) => x.title);
        const distract = L.shuffle(others, c.rng).slice(0, 3);
        return { label: t.q.unitSong(t.unit[unit] || unit), correct, note: t.note.unitSong,
          choices: L.shuffle([correct, ...distract], c.rng) };
      },
    },
  ];

  function availableTypes(al, c) { return TYPES.filter((ty) => ty.available(al, c)); }

  function weightedPick(types, rng) {
    const total = types.reduce((s, ty) => s + ty.weight, 0);
    let r = (rng || Math.random)() * total;
    for (const ty of types) { if ((r -= ty.weight) <= 0) return ty; }
    return types[types.length - 1];
  }

  // 앨범 1장 → 랜덤 유형 문제 1개.
  function buildQuestion(al, ctx) {
    const c = Object.assign({ n: 4, rng: Math.random }, ctx);
    const ty = weightedPick(availableTypes(al, c), c.rng);
    return Object.assign({ typeId: ty.id }, ty.make(al, c));
  }

  const api = { TYPES, availableTypes, buildQuestion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.QuizQuestions = api;
})(typeof window !== "undefined" ? window : null);
