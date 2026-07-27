/**
 * 순수 로직 + 데이터 무결성 단위 테스트 (브라우저 불필요).
 * 실행:  node --test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { shuffle, buildChoices, buildYearChoices, buildAlbumChoices, tierFor } =
  require(resolve(root, "js/logic.js"));
const { ALBUMS, ALBUM_YEARS, MEMBERS, memberById, DRAFTS, splitDraft, isDraft, RAW } =
  require(resolve(root, "js/data.js"));
const { buildQuestion, availableTypes, buildMemberQuestion, buildYtQuestion } = require(resolve(root, "js/questions.js"));
const { UNIT_SONGS, YT_SONGS } = require(resolve(root, "js/data.js"));
const YTCTX = { ytSongs: YT_SONGS, albums: ALBUMS, years: ALBUM_YEARS, n: 4, rng: Math.random };
const MCTX = {
  members: MEMBERS, unitSongs: UNIT_SONGS, albums: ALBUMS, n: 4, rng: Math.random,
  memberName: (id) => (memberById[id] ? memberById[id].name : id),
  nameOf: (id) => (memberById[id] ? memberById[id].name : id),
};
const catOf = (t) => (/미니/.test(t) ? "미니 앨범" : /정규/.test(t) ? "정규 앨범" : t);
const otherUnits = (u) => Object.keys(UNIT_SONGS).filter((x) => x !== u).flatMap((x) => UNIT_SONGS[x]);

const QCTX = {
  albums: ALBUMS, years: ALBUM_YEARS, members: MEMBERS, n: 4, rng: Math.random,
  memberName: (id) => (memberById[id] ? memberById[id].name : id),
  nameOf: (id) => (memberById[id] ? memberById[id].name : id),
};

test("buildChoices: 항상 정답을 포함한다", () => {
  const pool = ALBUMS.map((a) => a.title);
  for (let i = 0; i < 200; i++) {
    const c = buildChoices("Attacca", pool, 4);
    assert.ok(c.includes("Attacca"), "정답 누락");
  }
});

test("buildChoices: 개수는 min(n, 풀+1) 이고 중복이 없다", () => {
  const c = buildChoices("Attacca", ALBUMS.map((a) => a.title), 4);
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, c.length, "중복 보기 존재");
});

test("buildChoices: 풀이 부족해도 정답은 남고 안전하다", () => {
  const c = buildChoices("A", ["A"], 4); // 오답 후보 없음
  assert.deepEqual(c, ["A"]);
});

test("buildChoices: 연도(숫자) 정답도 문자열로 정상 포함", () => {
  const c = buildChoices(2021, ALBUM_YEARS, 4);
  assert.ok(c.includes("2021"));
  assert.equal(c.length, 4);
});

test("shuffle: 원본을 변형하지 않고 같은 원소 집합을 유지", () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src);
  assert.deepEqual(src, [1, 2, 3, 4, 5], "원본 변형됨");
  assert.deepEqual([...out].sort(), [...src].sort());
});

test("tierFor: 경계값 등급", () => {
  assert.match(tierFor(100), /찐 캐럿/);
  assert.match(tierFor(90), /찐 캐럿/);
  assert.match(tierFor(70), /진성/);
  assert.match(tierFor(40), /입덕 준비/);
  assert.match(tierFor(0), /입덕각/);
});

test("buildYearChoices: 정답 포함 + 근접 연도 우선", () => {
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const c = buildYearChoices(2019, years, 4);
  assert.ok(c.includes("2019"), "정답 누락");
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, 4, "중복");
  // 오답 3개는 2019에서 가장 가까운 연도들이어야 함(2017,2018,2020,2021 근방)
  const nums = c.map(Number).filter((y) => y !== 2019);
  for (const y of nums) assert.ok(Math.abs(y - 2019) <= 3, `너무 먼 연도: ${y}`);
});

test("buildYearChoices: 경계 연도(최소/최대)에서도 안전", () => {
  const years = [2015, 2016, 2017, 2024, 2025];
  const c = buildYearChoices(2015, years, 4);
  assert.ok(c.includes("2015"));
  assert.equal(c.length, 4);
});

test("buildAlbumChoices: 정답 포함 + 같은 유형/인접연도 오답 선호", () => {
  const albums = [
    { title: "정규A", type: "정규", year: 2019 },
    { title: "정규B", type: "정규", year: 2020 },
    { title: "미니C", type: "미니", year: 2015 },
    { title: "미니D", type: "미니", year: 2016 },
    { title: "미니E", type: "미니", year: 2024 },
  ];
  const correct = albums[0];
  const c = buildAlbumChoices(correct, albums, 4);
  assert.ok(c.includes("정규A"), "정답 누락");
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, 4, "중복");
  // 같은 유형(정규B)이 오답에 포함될 확률이 높아야 함 → 다수 시행에서 검증
  let withSameType = 0;
  for (let i = 0; i < 100; i++) {
    if (buildAlbumChoices(correct, albums, 4).includes("정규B")) withSameType++;
  }
  assert.ok(withSameType > 80, `동유형 오답 선호 약함: ${withSameType}/100`);
});

test("buildAlbumChoices: 후보가 부족해도 정답 유지", () => {
  const albums = [{ title: "유일", type: "정규", year: 2020 }];
  const c = buildAlbumChoices(albums[0], albums, 4);
  assert.deepEqual(c, ["유일"]);
});

test("buildQuestion: 모든 앨범에서 정답 포함·4지선다·중복없음(대량 시행)", () => {
  for (let i = 0; i < 2000; i++) {
    const al = ALBUMS[i % ALBUMS.length];
    const q = buildQuestion(al, QCTX);
    assert.ok(q.choices.includes(q.correct), `정답 누락 (${q.typeId})`);
    assert.equal(q.choices.length, 4, `보기 4개 아님 (${q.typeId})`);
    assert.equal(new Set(q.choices).size, 4, `중복 보기 (${q.typeId})`);
    assert.ok(q.correct != null && q.correct !== "", `빈 정답 (${q.typeId})`);
  }
});

test("questions: 데이터 없는 앨범은 수록곡/작사/유닛 유형이 안 나온다", () => {
  const bare = ALBUMS.find((a) => !a.tracks && !a.titleLyricists && !a.titleOnCover);
  assert.ok(bare, "데이터 없는 앨범 예시 존재");
  const ids = availableTypes(bare, QCTX).map((t) => t.id);
  ["album", "year", "titleTrack", "albumType"].forEach((k) => assert.ok(ids.includes(k), `${k} 없음`));
  ["notInAlbum", "lyricist", "unitSong"].forEach((k) => assert.ok(!ids.includes(k), `${k} 나오면 안 됨`));
});

test("questions: titleOnCover 앨범은 album 유형 제외", () => {
  const sample = { id: "x", title: "FML", year: 2023, type: "미니", titleTrack: "Super", titleOnCover: true };
  const ids = availableTypes(sample, QCTX).map((t) => t.id);
  assert.ok(!ids.includes("album"), "titleOnCover인데 album 유형이 남음");
  assert.ok(ids.includes("year") && ids.includes("titleTrack"));
});

test("buildQuestion: 결과에 difficulty 포함", () => {
  const q = buildQuestion(ALBUMS[0], QCTX);
  assert.ok([1, 2, 3, 4].includes(q.difficulty), `difficulty 없음: ${q.difficulty}`);
});

test("난이도 밴드: 어려움(3~4)은 쉬운 유형을 거의 안 낸다(폴백 허용)", () => {
  const hard = Object.assign({}, QCTX, { diffMin: 3, diffMax: 4 });
  let hardCount = 0, total = 0;
  for (const al of ALBUMS) {
    for (let i = 0; i < 8; i++) {
      const q = buildQuestion(al, hard);
      total++;
      if (q.difficulty >= 3) hardCount++;
    }
  }
  // 대부분 3+ (일부 앨범은 3+ 유형이 없어 폴백될 수 있음)
  assert.ok(hardCount / total > 0.6, `어려움 밴드 비율 낮음: ${hardCount}/${total}`);
});

test("자켓 번호 노출 방지: albumNumber는 기본 미출제(numOnCover 미확인)", () => {
  for (let i = 0; i < 2000; i++) {
    const al = ALBUMS[i % ALBUMS.length];
    const q = buildQuestion(al, QCTX);
    assert.notEqual(q.typeId, "albumNumber", `자켓에 번호가 있는데 '몇 집?' 출제됨: ${al.id}`);
  }
});

test("난이도 밴드: 쉬움(1~2)은 쉬운 유형 위주", () => {
  const easy = Object.assign({}, QCTX, { diffMin: 1, diffMax: 2 });
  let easyCount = 0, total = 0;
  for (const al of ALBUMS) {
    for (let i = 0; i < 8; i++) {
      const q = buildQuestion(al, easy);
      total++;
      if (q.difficulty <= 2) easyCount++;
    }
  }
  assert.ok(easyCount / total > 0.6, `쉬움 밴드 비율 낮음: ${easyCount}/${total}`);
});

test("questions: tracks 있는 앨범은 notInAlbum 가용", () => {
  const withTracks = ALBUMS.find((a) => a.tracks && a.tracks.length >= 3);
  assert.ok(availableTypes(withTracks, QCTX).some((t) => t.id === "notInAlbum"));
});

test("questions: unit 태그 있는 앨범은 unitSong 가용", () => {
  const withUnit = ALBUMS.find((a) => a.tracks && a.tracks.some((x) => x.unit));
  assert.ok(availableTypes(withUnit, QCTX).some((t) => t.id === "unitSong"));
});

test("questions: lyricist 정답은 크레딧 멤버, 오답은 비크레딧 멤버", () => {
  const al = ALBUMS.find((a) => a.titleLyricists && a.titleLyricists.length);
  const names = al.titleLyricists.map((id) => memberById[id].name);
  let sawLyricist = false;
  for (let i = 0; i < 300; i++) {
    const q = buildQuestion(al, QCTX);
    if (q.typeId !== "lyricist") continue;
    sawLyricist = true;
    assert.ok(names.includes(q.correct), `정답이 크레딧 멤버가 아님: ${q.correct}`);
    const distractors = q.choices.filter((c) => c !== q.correct);
    for (const d of distractors) assert.ok(!names.includes(d), `오답이 크레딧 멤버임: ${d}`);
  }
  assert.ok(sawLyricist, "lyricist 유형이 한 번도 안 나옴");
});

test("YouTube 솔로곡: 데이터 무결성 + 문제 정답/오답 사실성", () => {
  // 모든 YT 곡은 11자 영상 ID와 멤버 매핑을 가진다
  for (const s of YT_SONGS) {
    assert.match(s.yt, /^[\w-]{11}$/, `영상 ID 형식 오류: ${s.id}`);
    assert.ok(memberById[s.member], `멤버 매핑 없음: ${s.id}`);
    assert.ok(s.title && Number.isInteger(s.year));
  }
  const titles = new Set(YT_SONGS.map((s) => s.title));
  for (let i = 0; i < 800; i++) {
    const s = YT_SONGS[i % YT_SONGS.length];
    const q = buildYtQuestion(s, YTCTX);
    assert.ok(q.choices.includes(q.correct) && new Set(q.choices).size === q.choices.length);
    if (q.typeId === "ytSong") {
      assert.equal(q.correct, s.title, "곡 정답 불일치");
      // 오답에 정답과 같은 곡이 중복되지 않음
      assert.equal(q.choices.filter((c) => c === s.title).length, 1);
    }
    if (q.typeId === "ytYear") assert.equal(q.correct, String(s.year));
  }
  assert.ok(titles.size >= 4, "YT 곡이 4개 이상이어야 보기 구성이 안정적");
});

test("notInAlbum: 정답은 실제로 그 앨범 수록곡이 아님", () => {
  const al = ALBUMS.find((a) => a.tracks && a.tracks.length >= 3);
  const inTitles = al.tracks.map((x) => x.title);
  for (let i = 0; i < 300; i++) {
    const q = buildQuestion(al, QCTX);
    if (q.typeId !== "notInAlbum") continue;
    assert.ok(!inTitles.includes(q.correct), `정답이 수록곡임: ${q.correct}`);
    const distractors = q.choices.filter((c) => c !== q.correct);
    for (const d of distractors) assert.ok(inTitles.includes(d), `오답이 수록곡이 아님: ${d}`);
  }
});

test("검수 A: albumType/albumNumber/laterAlbum 정답·오답 사실성", () => {
  for (let i = 0; i < 3000; i++) {
    const al = ALBUMS[i % ALBUMS.length];
    const q = buildQuestion(al, QCTX);
    assert.ok(q.choices.includes(q.correct) && new Set(q.choices).size === q.choices.length);
    if (q.typeId === "albumType") assert.equal(q.correct, catOf(al.type));
    if (q.typeId === "albumNumber") { assert.equal(q.correct, al.type); assert.match(al.type, /(미니|정규)\s*\d+집/); }
    if (q.typeId === "laterAlbum") {
      const corr = ALBUMS.find((a) => a.title === q.correct);
      assert.ok(corr.year > al.year, "정답이 더 나중이 아님");
      for (const ch of q.choices.filter((c) => c !== q.correct)) {
        assert.ok(ALBUMS.find((a) => a.title === ch).year < al.year, "오답이 더 이전이 아님");
      }
    }
  }
});

test("검수 M: 멤버 유닛곡/작사/유닛 문제 사실성", () => {
  let sawL = false;
  for (let i = 0; i < 4000; i++) {
    const m = MEMBERS[i % MEMBERS.length];
    const q = buildMemberQuestion(m, MCTX);
    assert.ok(q.choices.includes(q.correct) && new Set(q.choices).size === q.choices.length);
    const mine = UNIT_SONGS[m.unit], others = otherUnits(m.unit);
    if (q.typeId === "memberUnitSong") {
      assert.ok(mine.includes(q.correct), "M1 정답이 유닛곡 아님");
      q.choices.filter((c) => c !== q.correct).forEach((c) => assert.ok(others.includes(c)));
    }
    if (q.typeId === "memberNotSong") {
      assert.ok(!mine.includes(q.correct), "M2 정답이 이 멤버 유닛곡임");
      q.choices.filter((c) => c !== q.correct).forEach((c) => assert.ok(mine.includes(c)));
    }
    if (q.typeId === "memberRoster") {
      assert.notEqual(memberById[Object.keys(memberById).find((id) => memberById[id].name === q.correct)].unit, m.unit);
    }
    if (q.typeId === "memberLyricist") {
      sawL = true;
      const wrote = ALBUMS.filter((a) => a.titleLyricists && a.titleLyricists.includes(m.id)).map((a) => a.titleTrack);
      assert.ok(wrote.includes(q.correct), "M5 정답을 이 멤버가 안 씀");
      const wroteAll = new Set(ALBUMS.filter((a) => a.titleLyricists).filter((a) => a.titleLyricists.includes(m.id)).map((a) => a.titleTrack));
      q.choices.filter((c) => c !== q.correct).forEach((c) => assert.ok(!wroteAll.has(c), "M5 오답을 이 멤버가 씀"));
    }
  }
  assert.ok(sawL, "memberLyricist 한 번도 안 나옴");
});

test("데이터 무결성: 앨범 id 고유", () => {
  const ids = ALBUMS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, "중복 id");
});

test("데이터 무결성: 필수 필드/타입", () => {
  for (const a of ALBUMS) {
    assert.ok(a.title, `${a.id} title 누락`);
    assert.ok(a.titleTrack, `${a.id} titleTrack 누락`);
    assert.ok(Number.isInteger(a.year), `${a.id} year 정수 아님`);
    assert.ok(a.year >= 2015 && a.year <= 2030, `${a.id} year 범위 이상`);
  }
});

test("데이터 무결성: 4지선다를 만들 만큼 후보가 충분", () => {
  assert.ok(new Set(ALBUMS.map((a) => a.title)).size >= 4);
  assert.ok(new Set(ALBUMS.map((a) => a.titleTrack)).size >= 4);
  assert.ok(new Set(ALBUM_YEARS).size >= 2);
});

// ── 검수: 한 항목의 모든 경우의 수(유형) 열거 ──
test("allAlbumCases: 출제 가능한 모든 유형을 유형별 1개씩(중복 없이) 반환", () => {
  const { allAlbumCases } = require(resolve(root, "js/questions.js"));
  const al = ALBUMS.find((a) => a.id === "attacca");
  const cases = allAlbumCases(al, QCTX);
  assert.ok(cases.length >= 4, "경우의 수가 너무 적음");
  const ids = cases.map((c) => c.typeId);
  assert.equal(new Set(ids).size, ids.length, "유형 중복");
  // 기본 유형(앨범/연도/타이틀곡)은 항상 포함
  ["album", "year", "titleTrack"].forEach((k) => assert.ok(ids.includes(k), `${k} 누락`));
  // 각 케이스는 정답 + 유효한 보기를 가져야 함(검수에서 바로 확인 가능)
  cases.forEach((c) => {
    assert.ok(c.correct != null, `${c.typeId} 정답 없음`);
    assert.ok(Array.isArray(c.choices) && c.choices.length >= 2, `${c.typeId} 보기 부족`);
    assert.ok(c.choices.includes(c.correct), `${c.typeId} 보기에 정답 없음`);
  });
});

// ── 신규 유형: 발매연도 타임라인 정렬 ──
test("timeline: 정답이 발매순 정렬이고 보기 4개가 서로 다르다", () => {
  const yearOf = Object.fromEntries(ALBUMS.map((a) => [a.title, a.year]));
  const al = ALBUMS.find((a) => a.id === "attacca");
  let seen = 0;
  for (let i = 0; i < 600 && seen < 5; i++) {
    const q = buildQuestion(al, QCTX);
    if (q.typeId !== "timeline") continue;
    seen++;
    assert.ok(q.choices.includes(q.correct), "보기에 정답 없음");
    assert.equal(new Set(q.choices).size, q.choices.length, "보기 중복");
    const yrs = q.correct.split(" → ").map((tt) => yearOf[tt]);
    assert.equal(yrs.length, 3, "3개 앨범이 아님");
    for (let k = 1; k < yrs.length; k++) assert.ok(yrs[k - 1] <= yrs[k], "정답이 발매순이 아님");
  }
  assert.ok(seen > 0, "timeline 유형 미출제");
});

// ── 신규 난이도: 자켓 크롭(확대) ──
test("albumCrop: 커버(art)가 있을 때만 출제 + crop 플래그 + 정답 포함", () => {
  const base = ALBUMS.find((a) => !a.titleOnCover && !a.artist);
  const withArt = Object.assign({}, base, { art: "https://example/cover.jpg" });
  let sawCrop = false;
  for (let i = 0; i < 400 && !sawCrop; i++) {
    const q = buildQuestion(withArt, QCTX);
    if (q.typeId === "albumCrop") {
      sawCrop = true;
      assert.equal(q.crop, true, "crop 플래그 없음");
      assert.equal(q.correct, withArt.title);
      assert.ok(q.choices.includes(withArt.title), "보기에 정답 없음");
    }
  }
  assert.ok(sawCrop, "art 있는 앨범인데 albumCrop 미출제");
  // art 없으면 절대 crop 출제 안 됨(플레이스홀더에 앨범명 노출 방지)
  const noArt = Object.assign({}, withArt, { art: null });
  for (let i = 0; i < 400; i++) assert.notEqual(buildQuestion(noArt, QCTX).typeId, "albumCrop");
});

// ── 신규 유형: 멤버 유닛(팀) 매칭 ──
test("memberUnit: 멤버의 유닛이 정답이고 보기에 포함된다", () => {
  const I18N = require(resolve(root, "js/i18n.js"));
  const U = I18N.t._unit; // { vocal, hiphop, performance }
  const hoshi = memberById["hoshi"]; // performance
  let seen = 0;
  for (let i = 0; i < 400 && seen < 5; i++) {
    const q = buildMemberQuestion(hoshi, MCTX);
    if (q.typeId !== "memberUnit") continue;
    seen++;
    assert.equal(q.correct, U[hoshi.unit], "정답이 멤버 유닛 라벨과 불일치");
    assert.ok(q.choices.includes(q.correct), "보기에 정답 없음");
    assert.ok(q.choices.length >= 2, "보기 수 부족");
    assert.equal(new Set(q.choices).size, q.choices.length, "보기 중복");
  }
  assert.ok(seen > 0, "memberUnit 유형이 한 번도 출제되지 않음");
});

// ── draft(테스트 문제) 분리 & 검수 게이트 ──
test("draft: splitDraft 가 live/draft 를 정확히 가른다", () => {
  const { live, draft } = splitDraft([
    { id: "a" }, { id: "b", draft: true }, { id: "c" }, { id: "d", draft: true },
  ]);
  assert.deepEqual(live.map((x) => x.id), ["a", "c"]);
  assert.deepEqual(draft.map((x) => x.id), ["b", "d"]);
});

test("draft: 공개 ALBUMS 에는 draft 문제가 절대 섞이지 않는다(프로덕션 보호)", () => {
  assert.ok(ALBUMS.every((a) => !isDraft(a)), "공개 목록에 draft 유입");
  // RAW(전체) 중 draft 만 DRAFTS 로 분리되어야 함
  const rawDraft = (RAW.ALBUMS || []).filter(isDraft).map((a) => a.id).sort();
  assert.deepEqual(DRAFTS.ALBUMS.map((a) => a.id).sort(), rawDraft);
});

test("draft 검수 게이트: 모든 draft 앨범은 필수 필드 + 4지선다 출제가 가능해야 한다", () => {
  // 신규 문제를 추가할 때 이 테스트가 CI에서 잘못된 데이터를 걸러낸다.
  for (const a of DRAFTS.ALBUMS) {
    ["id", "title", "titleTrack", "type"].forEach((k) => assert.ok(a[k], `draft ${a.id || "?"} ${k} 누락`));
    assert.ok(Number.isInteger(a.year), `draft ${a.id} year 정수 아님`);
    const q = buildQuestion(a, QCTX);
    assert.ok(q && Array.isArray(q.choices) && q.choices.length >= 2, `draft ${a.id} 출제 실패`);
    assert.ok(q.choices.includes(q.correct), `draft ${a.id} 보기에 정답 없음`);
  }
});

// ── season.js (KST 시즌 스케줄) ──
const SEASON_SRC = readFileSync(resolve(root, "js/season.js"), "utf8");
function loadSeason(nowMs) {
  const ctx = { window: { __SVT_NOW: nowMs }, Date, Math };
  vm.createContext(ctx);
  vm.runInContext(SEASON_SRC, ctx);
  return ctx.window.SVTSeason;
}
const UTC = Date.UTC;

test("시즌: 종료 경계는 KST 말일 자정(=다음 달 1일 00:00 KST)", () => {
  // 7/31 23:59:59 KST = 7/31 14:59:59 UTC → 아직 7월, 남은시간 > 0
  const s1 = loadSeason(UTC(2026, 6, 31, 14, 59, 59));
  assert.equal(s1.active().ym, "202607");
  assert.ok(s1.msLeft() > 0, "말일 자정 직전인데 이미 종료됨");
  // 8/1 00:00 KST = 7/31 15:00 UTC → 8월로 넘어감
  const s2 = loadSeason(UTC(2026, 6, 31, 15, 0, 0));
  assert.equal(s2.active().ym, "202608");
});

test("시즌: 공지(막판 강조)는 종료 2일 전부터, 3일 전엔 아직 아님", () => {
  const end = UTC(2026, 7, 1) - 9 * 3600000; // 7월 종료 순간(UTC)
  const d3 = loadSeason(end - 3 * 86400000 - 3600000); // 약 3일 전
  assert.equal(d3.isFinalPush(), false, "3일 전인데 벌써 막판 강조");
  const d2 = loadSeason(end - 1.5 * 86400000); // 약 1.5일 전(=D-2)
  assert.equal(d2.isFinalPush(), true, "2일 전인데 막판 강조 안 켜짐");
});

test("시즌: 종료 하루 이내 카운트다운, 1시간 이내 긴급 강조", () => {
  const end = UTC(2026, 7, 1) - 9 * 3600000; // 7월 종료 순간(UTC)
  const far = loadSeason(end - 26 * 3600000); // 26시간 전 → 카운트다운 아님
  assert.equal(far.isFinalCountdown(), false);
  assert.equal(far.isFinalUrgent(), false);
  const cd = loadSeason(end - 12 * 3600000); // 12시간 전 → 카운트다운 O, 긴급 X
  assert.equal(cd.isFinalCountdown(), true);
  assert.equal(cd.isFinalUrgent(), false);
  const urgent = loadSeason(end - (30 * 60000)); // 30분 전 → 긴급 O
  assert.equal(urgent.isFinalCountdown(), true);
  assert.equal(urgent.isFinalUrgent(), true);
});

test("시즌: hms() 는 H:MM:SS (하루 이내 시(hour) 두 자리 가능)", () => {
  const end = UTC(2026, 7, 1) - 9 * 3600000;
  const s = loadSeason(end - (3600000 + 2 * 60000 + 3000)); // 1시간 2분 3초 전
  assert.equal(s.hms(), "1:02:03");
  const s2 = loadSeason(end - (23 * 3600000 + 59 * 60000 + 5000)); // 23:59:05 전
  assert.equal(s2.hms(), "23:59:05");
});
