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

const API = "https://kpop.fandom.com/api.php";
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

const out = {};
for (const m of MEMBERS) {
  try {
    const picked = OVERRIDE[m.id]
      ? { title: "(override)", url: OVERRIDE[m.id] }
      : await pageImage(SEARCH[m.id] || `${m.name} Seventeen`);
    if (picked && picked.url) {
      out[m.id] = { url: picked.url, source: picked.title };
      console.log(`✓ ${m.id.padEnd(10)} ${picked.title}  ${picked.url}`);
    } else {
      console.warn(`✗ ${m.id.padEnd(10)} (이미지 없음)`);
    }
  } catch (e) {
    console.warn(`✗ ${m.id.padEnd(10)} ${e.message}`);
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
