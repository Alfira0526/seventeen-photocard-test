/**
 * audit-art.mjs — 리패키지 자켓 자동매칭 오류 점검(2026-07-27 리뷰 §5 제안).
 *
 * loveandletter 처럼 "원반 vs 리패키지반"이 iTunes에 유사한 이름으로 공존하면
 * scripts/fetch-art.mjs 의 유사도 매칭이 엉뚱한 릴리스를 골라올 수 있다.
 * 이 스크립트는 각 앨범의 iTunes 검색 결과에 "리패키지 애매성"이 있는지 점검하고,
 * 애매한데 fetch-art.mjs 의 OVERRIDE 로 고정돼 있지 않은 앨범을 경고한다.
 *
 * 실행:  node scripts/audit-art.mjs [--strict]
 *   · 기본: 경고만 출력(네트워크 실패 시에도 exit 0 — CI를 깨지 않음).
 *   · --strict: 미고정 애매 앨범이 하나라도 있으면 exit 1(게이트용).
 *
 * 네트워크(iTunes)가 필요하다. 오프라인/차단 환경에서는 점검을 건너뛰고 안내만 남긴다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { ALBUMS } = require(resolve(root, "js/data.js"));
const STRICT = process.argv.includes("--strict");
const COUNTRY = "KR";

// fetch-art.mjs 의 OVERRIDE(수동 고정된 앨범→collectionId)를 소스에서 추출 — import 부작용 회피
function overrideMap() {
  try {
    const src = readFileSync(resolve(root, "scripts/fetch-art.mjs"), "utf8");
    const m = src.match(/const OVERRIDE\s*=\s*\{([\s\S]*?)\};/);
    if (!m) return {};
    const map = {};
    for (const x of m[1].matchAll(/^\s*([a-zA-Z0-9_]+)\s*:\s*(\d+)/gm)) map[x[1]] = Number(x[2]);
    return map;
  } catch (e) { return {}; }
}
// 토큰 겹침 비율(0~1) — 정규화 전 원문 기준(공백 보존)
function tokenOverlap(aRaw, bRaw) {
  const toks = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z0-9가-힣]+/).filter((t) => t.length >= 2));
  const A = toks(aRaw), B = toks(bRaw);
  if (!A.size) return 0;
  let hit = 0; for (const t of A) if (B.has(t)) hit++;
  return hit / A.size;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
// 원반/리패키지 애매성: 한 결과 이름이 다른 결과 이름을 포함(부분집합)하거나, 리패키지 키워드 포함
const REPACK_HINT = /(repackage|repackaged|repack|리패키지|리패키지반|special edition|deluxe)/i;

async function search(term) {
  const url = "https://itunes.apple.com/search?" +
    new URLSearchParams({ term, entity: "album", country: COUNTRY, limit: "15" });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz-audit/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results || [];
}

// iTunes lookup: 고정한 collectionId 를 직접 조회해 정확히 그 릴리스를 얻는다.
async function lookup(id) {
  const url = "https://itunes.apple.com/lookup?" + new URLSearchParams({ id: String(id), country: COUNTRY });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz-audit/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results || [];
}

// OVERRIDE 로 고정한 collectionId 가 실제로 그 앨범(원반)을 가리키는지 lookup 으로 직접 대조.
// 이름 불일치(엉뚱한 릴리스로 고정)나, data 는 원반인데 조회 결과가 리패키지처럼 보이는 경우를 경고.
async function verifyOverrides(ovMap) {
  const keys = Object.keys(ovMap);
  if (!keys.length) return { ran: false, bad: [] };
  console.log(`▶ OVERRIDE 아트워크 ID 직접 대조 — ${keys.length}개 (iTunes lookup)\n`);
  const bad = [];
  let ran = false;
  for (const key of keys) {
    const id = ovMap[key];
    const album = ALBUMS.find((a) => a.id === key);
    let results;
    try { results = await lookup(id); ran = true; }
    catch (e) { console.warn(`  · ${key}: lookup 실패(${e.message}) — 건너뜀`); continue; }
    const rec = results.find((r) => (r.wrapperType === "collection") || r.collectionName) || results[0];
    if (!rec) { console.log(`  ⚠ ${key}: id=${id} 조회 결과 없음(삭제/지역 미판매 가능)`); bad.push(key); continue; }
    const got = rec.collectionName || "";
    const term = (album && album.itunes) || (album && album.title) || key;
    const expTitle = (album && album.title) || key;
    const gotN = norm(got), termN = norm(term);
    const nameOk = (gotN && termN && (gotN.includes(termN) || termN.includes(gotN))) || tokenOverlap(term, got) >= 0.5;
    const repackMismatch = REPACK_HINT.test(got) && !/리패키지/.test((album && album.type) || "");
    if (!nameOk || repackMismatch) {
      const why = [
        !nameOk ? `이름 불일치(고정 id=${id} → "${got}", 기대 "${expTitle}")` : "",
        repackMismatch ? `조회 결과가 리패키지처럼 보임("${got}") — data 는 원반` : "",
      ].filter(Boolean).join(", ");
      console.log(`  ⚠ ${key}: ${why}`);
      bad.push(key);
    } else {
      console.log(`  ✅ ${key}: id=${id} → "${got}" 일치`);
    }
  }
  return { ran, bad };
}

function ambiguity(albumTitle, results) {
  const names = results.map((r) => ({ raw: r.collectionName || "", n: norm(r.collectionName) })).filter((x) => x.n);
  const reasons = [];
  // (1) 리패키지 키워드가 결과에 섞여 있음
  if (results.some((r) => REPACK_HINT.test(r.collectionName || ""))) reasons.push("리패키지 키워드");
  // (2) 서로 부분집합인 이름 쌍 존재(원반 vs "First '…'"/"… (Repackage)")
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (i === j) continue;
      const a = names[i].n, b = names[j].n;
      if (a !== b && a.length >= 4 && b.includes(a) && b.length > a.length + 2) {
        reasons.push(`유사 이름쌍("${names[i].raw}" ⊂ "${names[j].raw}")`);
        i = names.length; break;
      }
    }
  }
  return [...new Set(reasons)];
}

async function main() {
  const ovMap = overrideMap();
  const ov = new Set(Object.keys(ovMap));
  // Apple Music 미수록(믹스테이프 등)·검색 힌트 없는 항목은 제외
  const targets = ALBUMS.filter((a) => a.itunes && !/믹스테이프/.test(a.type || ""));
  console.log(`▶ 리패키지 자켓 매칭 점검 — 대상 ${targets.length}개 (OVERRIDE 고정 ${ov.size}개)\n`);

  const flagged = [];
  let netOk = false;
  for (const a of targets) {
    let results;
    try { results = await search(a.itunes); netOk = true; }
    catch (e) { console.warn(`  · ${a.id}: 검색 실패(${e.message}) — 건너뜀`); continue; }
    const reasons = ambiguity(a.title, results);
    if (!reasons.length) continue;
    const pinned = ov.has(a.id);
    const mark = pinned ? "✅ 고정됨" : "⚠ 미고정";
    console.log(`  ${mark}  ${a.id} (${a.title}) — ${reasons.join(", ")}`);
    if (!pinned) flagged.push(a.id);
  }

  console.log("");
  // 2차: OVERRIDE 로 고정한 collectionId 를 lookup 으로 직접 대조
  const { ran: verifyRan, bad } = await verifyOverrides(ovMap);
  console.log("");

  if (!netOk && !verifyRan) {
    console.log("ℹ iTunes 조회가 전혀 되지 않았습니다(오프라인/차단). 점검을 건너뜁니다.");
    process.exit(0);
  }
  let problem = false;
  if (flagged.length) {
    console.log(`⚠ 애매하지만 OVERRIDE로 고정되지 않은 앨범 ${flagged.length}개: ${flagged.join(", ")}`);
    console.log("  → scripts/fetch-art.mjs 의 OVERRIDE 에 확인된 원반 collectionId 를 추가하세요(loveandletter 참고).");
    problem = true;
  }
  if (bad.length) {
    console.log(`⚠ OVERRIDE 고정 id 가 의심스러운 앨범 ${bad.length}개: ${bad.join(", ")}`);
    console.log("  → 위 lookup 결과를 확인하고 fetch-art.mjs 의 OVERRIDE collectionId 를 올바른 원반으로 교정하세요.");
    problem = true;
  }
  if (!problem) console.log("✅ 리패키지 애매성·OVERRIDE id 대조 모두 이상 없음.");
  process.exit(STRICT && problem ? 1 : 0);
}

main().catch((e) => { console.error("점검 오류:", e); process.exit(0); });
