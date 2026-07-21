/**
 * 순수 로직 + 데이터 무결성 단위 테스트 (브라우저 불필요).
 * 실행:  node --test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { shuffle, buildChoices, buildYearChoices, buildAlbumChoices, tierFor } =
  require(resolve(root, "js/logic.js"));
const { ALBUMS, ALBUM_YEARS } = require(resolve(root, "js/data.js"));

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
  assert.match(tierFor(100), /마스터/);
  assert.match(tierFor(90), /마스터/);
  assert.match(tierFor(70), /진성/);
  assert.match(tierFor(40), /입덕/);
  assert.match(tierFor(0), /관심/);
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
