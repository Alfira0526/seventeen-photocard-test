#!/usr/bin/env node
/**
 * fetch-art.mjs — iTunes(Apple) Search API 로 세븐틴 앨범 자켓 URL을 수집해
 * js/albumArt.js 로 베이크한다.  (이미지 파일은 저장하지 않고 CDN URL만 저장)
 *
 * 사용법:
 *   node scripts/fetch-art.mjs
 *
 * 동작:
 *   1) js/data.js 에서 ALBUMS 목록을 읽는다.
 *   2) 앨범별 itunes 검색 힌트로 Search API 를 호출한다.
 *   3) artistName === 'SEVENTEEN' 결과 중 제목이 가장 잘 맞는 것을 고른다.
 *   4) artworkUrl100 의 100x100 → 600x600 으로 치환해 고해상도 URL 확보.
 *   5) window.SVTArt = { albumId: url, ... } 형태로 js/albumArt.js 생성.
 *
 * 매칭 실패한 앨범은 콘솔에 경고로 남기며, 그 앨범은 게임에서 플레이스홀더로 표시된다.
 * (data.js 는 건드리지 않으므로 몇 번을 다시 돌려도 안전하다.)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// data.js 를 CommonJS 로 로드(파일 끝에 module.exports 있음)
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const { ALBUMS } = require(resolve(root, "js/data.js"));

const COUNTRY = process.env.ITUNES_COUNTRY || "kr";

/**
 * 수동 오버라이드 맵 (B1 대응).
 * 자동 매칭이 틀리거나 실패한 앨범을 사람이 직접 고정한다. 두 형태 지원:
 *   - 문자열(URL): 그 URL을 그대로 사용 (예: Apple/기타 CDN의 자켓 URL)
 *   - 숫자(collectionId): iTunes lookup API로 해당 앨범 아트워크를 가져옴
 * 미스가 나면 아래 콘솔 로그의 "후보"를 보고 여기에 채워 넣으면 된다.
 */
const OVERRIDE = {
  // 예) goingseventeen: 1160457959,
  // 예) happyburstday: "https://is1-ssl.mzstatic.com/image/thumb/.../600x600bb.jpg",
};

async function lookupById(collectionId) {
  const url = "https://itunes.apple.com/lookup?" +
    new URLSearchParams({ id: String(collectionId), country: COUNTRY });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0" } });
  if (!res.ok) throw new Error(`lookup HTTP ${res.status}`);
  const json = await res.json();
  const r = (json.results || []).find((x) => x.artworkUrl100);
  return r ? r.artworkUrl100 : null;
}

// 문자열 정규화(대소문자/기호 제거) 후 겹치는 정도로 유사도 측정
const norm = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");

function similarity(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  // 공통 문자 비율(간이)
  const setB = new Set(b);
  let hit = 0;
  for (const ch of new Set(a)) if (setB.has(ch)) hit++;
  return hit / new Set(a + b).size;
}

async function search(term) {
  const url =
    "https://itunes.apple.com/search?" +
    new URLSearchParams({
      term,
      entity: "album",
      country: COUNTRY,
      limit: "25",
    });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for "${term}"`);
  const json = await res.json();
  return json.results || [];
}

// 아티스트 정확 매칭(오매칭 방지): 정확일치 또는 접두만 허용
function artistMatch(album, results) {
  const artist = norm(album.artist || "SEVENTEEN");
  return results.filter((r) => {
    const a = norm(r.artistName || "");
    return a === artist || a.startsWith(artist);
  });
}

function pickBest(album, results) {
  const matched = artistMatch(album, results);
  if (!matched.length) return null; // 아티스트 불일치 → 매칭 실패
  let best = null;
  let bestScore = 0;
  for (const r of matched) {
    let score = similarity(album.title, r.collectionName);
    const year = (r.releaseDate || "").slice(0, 4);
    if (year === String(album.year)) score += 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

function hi(url) {
  // .../100x100bb.jpg → .../600x600bb.jpg
  return url ? url.replace(/\/\d+x\d+bb\.(jpg|png)/, "/600x600bb.$1") : null;
}

// 미스 시 사람이 판단할 수 있게 상위 후보를 함께 반환
function topCandidates(album, results, k = 3) {
  const matched = artistMatch(album, results);
  const pool = matched.length ? matched : results;
  return pool
    .map((r) => ({
      name: r.collectionName,
      id: r.collectionId,
      year: (r.releaseDate || "").slice(0, 4),
      score: +(similarity(album.title, r.collectionName) +
        ((r.releaseDate || "").slice(0, 4) === String(album.year) ? 0.25 : 0)).toFixed(2),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const out = {};
const misses = [];

for (const album of ALBUMS) {
  // 1) 수동 오버라이드 우선
  const ov = OVERRIDE[album.id];
  if (ov !== undefined) {
    try {
      const url = typeof ov === "number" ? await lookupById(ov) : ov;
      if (url) {
        out[album.id] = hi(url);
        console.log(`◎ ${album.id.padEnd(14)} → (오버라이드) ${typeof ov === "number" ? ov : "URL"}`);
        continue;
      }
      console.warn(`✗ ${album.id.padEnd(14)} 오버라이드 실패`);
      misses.push(album.id);
      continue;
    } catch (e) {
      console.warn(`✗ ${album.id.padEnd(14)} 오버라이드 오류: ${e.message}`);
      misses.push(album.id);
      continue;
    }
  }
  // 2) 자동 검색 매칭
  try {
    const results = await search(`${album.artist || "SEVENTEEN"} ${album.itunes}`);
    const match = pickBest(album, results);
    if (match && match.artworkUrl100) {
      out[album.id] = hi(match.artworkUrl100);
      console.log(`✓ ${album.id.padEnd(14)} → ${match.collectionName} (${(match.releaseDate||"").slice(0,4)})`);
    } else {
      misses.push(album.id);
      console.warn(`✗ ${album.id.padEnd(14)} 매칭 실패 — 후보:`);
      topCandidates(album, results).forEach((c) =>
        console.warn(`    · ${c.name} [${c.year}] id=${c.id} score=${c.score}  → OVERRIDE.${album.id} = ${c.id}`));
    }
  } catch (e) {
    misses.push(album.id);
    console.warn(`✗ ${album.id.padEnd(14)} ${e.message}`);
  }
  // 레이트리밋 예방(약 3 req/s)
  await new Promise((r) => setTimeout(r, 350));
}

const banner =
  "// 자동 생성 파일 — scripts/fetch-art.mjs 로 갱신. 직접 편집 금지.\n" +
  "// iTunes(Apple) 아트워크 CDN URL. 이미지 저작권은 각 저작권자에게 있음.\n";
const body =
  "window.SVTArt = " + JSON.stringify(out, null, 2) + ";\n";
writeFileSync(resolve(root, "js/albumArt.js"), banner + body);

console.log(
  `\n완료: ${Object.keys(out).length}/${ALBUMS.length} 개 자켓 URL 저장 → js/albumArt.js`
);
if (misses.length) console.log("플레이스홀더로 남는 앨범:", misses.join(", "));
