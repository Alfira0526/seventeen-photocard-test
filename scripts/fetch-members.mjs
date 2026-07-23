#!/usr/bin/env node
/**
 * fetch-members.mjs — 멤버 대표 이미지를 kpop.fandom(Wikia) MediaWiki API로 수집.
 *
 * Commons/나무위키는 오매칭·핫링크 차단 문제가 커서, kpop 전용 위키의 각 멤버 페이지
 * 대표 이미지(pageimage)를 가져온다. 이미지는 static.wikia.nocookie.net(핫링크 허용) 호스팅.
 * 결과: js/memberPhotos.js  →  window.SVTMemberPhotos = { memberId: {url, source} }
 *
 * ⚠️ 위키 검색이라 오매칭 가능 → 파일명/페이지명을 로그로 남겨 검수, OVERRIDE로 교정.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const { MEMBERS } = require(resolve(root, "js/data.js"));
// 기존 사진을 보존(다른 멤버는 그대로 두고 지정 멤버만 교체)
let existing = {};
try { require(resolve(root, "js/memberPhotos.js")); existing = globalThis.window.SVTMemberPhotos || {}; } catch (e) {}

const API = "https://kpop.fandom.com/api.php";
const SITE = "https://kpop.fandom.com";

// 특정 멤버는 대표(lead) 이미지 대신 위키 파일 목록(prefix 검색)에서 "다른" 솔로 사진을 고른다.
//  - prefix: 파일명 접두(예: "SEVENTEEN Wonwoo") / exclude: 제외 패턴 / prefer: 우선 패턴
const ALT_PICK = {
  wonwoo: {
    prefix: "SEVENTEEN Wonwoo",
    exclude: /happy.?burstday|season|greeting|christmas|halloween/i,
    prefer: /concept photo|profile|teaser/i,
  },
};
// 이번 실행에서 새로 교체할 멤버(나머지는 기존 URL 보존)
const REFRESH = new Set(Object.keys(ALT_PICK));
// "SEVENTEEN" 문맥으로 검색해 동명이인 충돌을 줄인다.
const SEARCH = {
  scoups: "S.Coups Seventeen", jeonghan: "Jeonghan Seventeen", joshua: "Joshua Seventeen",
  jun: "Jun Seventeen", hoshi: "Hoshi Seventeen", wonwoo: "Wonwoo Seventeen",
  woozi: "Woozi Seventeen", dk: "DK Seventeen", mingyu: "Mingyu Seventeen",
  the8: "The8 Seventeen", seungkwan: "Seungkwan Seventeen", vernon: "Vernon Seventeen",
  dino: "Dino Seventeen",
};
// 검수 후 정확한 페이지 이미지 URL을 직접 지정(오매칭 교정).
const OVERRIDE = {};

async function pageImage(query) {
  const url = API + "?" + new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: query, gsrlimit: "1", gsrnamespace: "0",
    prop: "pageimages", piprop: "original",
  });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0 (fan quiz)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const p = pages.find((x) => x.original && x.original.source);
  return p ? { title: p.title, url: p.original.source } : null;
}

// 위키 전체 파일 목록에서 접두(prefix)로 솔로 파일을 찾아 조건에 맞는 "다른" 사진을 고른다.
// list=allimages 는 페이지 임베드와 무관하게 파일명으로 직접 검색 → 후보가 풍부.
async function fileByPrefix(cfg) {
  async function query(prefix) {
    const url = API + "?" + new URLSearchParams({
      action: "query", format: "json", list: "allimages",
      aiprefix: prefix, ailimit: "200", aiprop: "url", aisort: "name",
    });
    const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0 (fan quiz)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.query && json.query.allimages) || [];
  }
  let raw = await query(cfg.prefix);
  if (!raw.length && cfg.prefix.includes(" ")) raw = await query(cfg.prefix.split(" ").pop()); // 폴백: 이름만
  const imgs = raw
    .map((x) => ({ name: x.name, url: x.url }))
    .filter((x) => /\.(png|jpe?g)$/i.test(x.name))
    .filter((x) => !cfg.exclude || !cfg.exclude.test(x.name))
    .filter((x) => !/logo|icon|award|signature|banner|scan|fake|weibo|instagram|twitter|logo|sticker/i.test(x.name));
  console.log(`   후보 ${imgs.length}개: ${imgs.slice(0, 10).map((i) => i.name).join(" | ")}`);
  const pick = imgs.find((x) => cfg.prefer && cfg.prefer.test(x.name)) || imgs[0];
  return pick ? { title: pick.name, url: pick.url } : null;
}

const out = {};
for (const m of MEMBERS) {
  // 교체 대상이 아니고 기존 URL이 있으면 그대로 보존
  if (!REFRESH.has(m.id) && existing[m.id] && existing[m.id].url) {
    out[m.id] = existing[m.id];
    console.log(`= ${m.id.padEnd(10)} (기존 유지) ${existing[m.id].url}`);
    continue;
  }
  try {
    let picked;
    if (ALT_PICK[m.id]) picked = await fileByPrefix(ALT_PICK[m.id]);
    else if (OVERRIDE[m.id]) picked = { title: "(override)", url: OVERRIDE[m.id] };
    else picked = await pageImage(SEARCH[m.id] || `${m.name} Seventeen`);
    if (picked && picked.url) {
      out[m.id] = { url: picked.url, source: picked.title };
      console.log(`✓ ${m.id.padEnd(10)} ${picked.title}  ${picked.url}`);
    } else if (existing[m.id]) {
      out[m.id] = existing[m.id]; // 실패 시 기존 유지
      console.warn(`! ${m.id.padEnd(10)} 새 이미지 못 찾음 → 기존 유지`);
    } else {
      console.warn(`✗ ${m.id.padEnd(10)} (이미지 없음)`);
    }
  } catch (e) {
    if (existing[m.id]) out[m.id] = existing[m.id];
    console.warn(`✗ ${m.id.padEnd(10)} ${e.message}${existing[m.id] ? " → 기존 유지" : ""}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

const banner =
  "// 자동 생성 파일 — scripts/fetch-members.mjs (kpop.fandom) 로 갱신.\n" +
  "// 위키 검색 기반이라 오매칭 가능. 비어 있으면 게임은 유닛 컬러 '이름 아바타'로 표시.\n";
writeFileSync(
  resolve(root, "js/memberPhotos.js"),
  banner + "window.SVTMemberPhotos = " + JSON.stringify(out, null, 2) + ";\n"
);
console.log(`\n완료: ${Object.keys(out).length}/${MEMBERS.length} 명 → js/memberPhotos.js`);
