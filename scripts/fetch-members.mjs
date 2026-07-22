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

// 특정 멤버는 대표(lead) 이미지 대신 페이지 이미지 목록에서 "다른" 솔로 사진을 고른다.
//  - exclude: 현재 쓰던 사진 등 제외 패턴 / prefer: 우선 선택 패턴
const ALT_PICK = {
  wonwoo: { name: "Wonwoo", exclude: /happy.?burstday/i, prefer: /concept|profile|teaser/i },
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

// 페이지 이미지 목록에서 조건에 맞는 "다른" 파일을 골라 Special:FilePath 로 핫링크
async function pageImageAlt(query, cfg) {
  const url = API + "?" + new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: query, gsrlimit: "1", gsrnamespace: "0",
    prop: "images", imlimit: "80",
  });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0 (fan quiz)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const imgs = (pages[0] && pages[0].images ? pages[0].images : [])
    .map((x) => x.title.replace(/^File:/, ""))
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .filter((f) => new RegExp(cfg.name, "i").test(f))
    .filter((f) => !cfg.exclude || !cfg.exclude.test(f))
    .filter((f) => !/logo|icon|award|signature|thumb|banner/i.test(f));
  console.log(`   후보 ${imgs.length}개: ${imgs.slice(0, 8).join(" | ")}`);
  const preferred = imgs.find((f) => cfg.prefer && cfg.prefer.test(f)) || imgs[0];
  if (!preferred) return null;
  const fileUrl = `${SITE}/wiki/Special:FilePath/${encodeURIComponent(preferred)}`;
  return { title: preferred, url: fileUrl };
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
    if (ALT_PICK[m.id]) picked = await pageImageAlt(SEARCH[m.id] || `${m.name} Seventeen`, ALT_PICK[m.id]);
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
