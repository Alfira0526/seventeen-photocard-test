#!/usr/bin/env node
/**
 * fetch-members.mjs — 멤버별 사진을 Wikimedia Commons(자유 라이선스)에서 수집.
 *
 * 앨범 커버와 달리 멤버 컨셉샷은 공개 API가 없어, 저작권이 깨끗한 Commons에서
 * 멤버 이름으로 검색해 대표 이미지 1장씩 수집한다(부정확 감수 — 사용자 승인).
 * 결과: js/memberPhotos.js  →  window.SVTMemberPhotos = { memberId: {url, source} }
 *
 * ⚠️ Commons 검색은 오매칭 가능(동명이인/그룹샷). 파일명을 로그로 남겨 사람이 검수/오버라이드.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const { MEMBERS } = require(resolve(root, "js/data.js"));

// 검색용 영문 표기(스테이지명). Commons에서 잘 잡히도록.
const SEARCH = {
  scoups: "S.Coups Seventeen", jeonghan: "Jeonghan Seventeen", joshua: "Joshua Hong Seventeen",
  jun: "Jun Wen Junhui Seventeen", hoshi: "Hoshi Seventeen", wonwoo: "Wonwoo Seventeen",
  woozi: "Woozi Seventeen", dk: "Dokyeom DK Seventeen", mingyu: "Mingyu Seventeen",
  the8: "The8 Xu Minghao Seventeen", seungkwan: "Seungkwan Seventeen", vernon: "Vernon Seventeen",
  dino: "Dino Lee Chan Seventeen",
};

// 사람이 지정한 정확한 Commons 파일명(오매칭 교정용). 예: hoshi: "File:....jpg"
const OVERRIDE = {};

async function commonsSearch(query) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: query + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "8",
    prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "600",
  });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0 (fan quiz; contact via repo)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
  // 그룹샷/로고 배제: 파일명에 멤버 단서가 있고 이미지(jpg/png)인 것 우선
  return pages
    .filter((p) => p.imageinfo && p.imageinfo[0] && /image\/(jpe?g|png)/.test(p.imageinfo[0].mime || ""))
    .map((p) => ({ title: p.title, url: p.imageinfo[0].thumburl || p.imageinfo[0].url }));
}

const out = {};
for (const m of MEMBERS) {
  try {
    let picked = null;
    if (OVERRIDE[m.id]) {
      picked = { title: OVERRIDE[m.id], url: null }; // TODO: lookup by title if needed
    } else {
      const results = await commonsSearch(SEARCH[m.id] || (m.name + " Seventeen"));
      picked = results[0] || null;
    }
    if (picked && picked.url) {
      out[m.id] = { url: picked.url, source: picked.title };
      console.log(`✓ ${m.id.padEnd(10)} ${picked.title}`);
    } else {
      console.warn(`✗ ${m.id.padEnd(10)} (검색 결과 없음)`);
    }
  } catch (e) {
    console.warn(`✗ ${m.id.padEnd(10)} ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

const banner =
  "// 자동 생성 파일 — scripts/fetch-members.mjs (Wikimedia Commons) 로 갱신. 직접 편집 금지.\n" +
  "// 자유 라이선스 이미지. Commons 검색 기반이라 오매칭 가능(파일명 확인 후 OVERRIDE 교정).\n";
writeFileSync(
  resolve(root, "js/memberPhotos.js"),
  banner + "window.SVTMemberPhotos = " + JSON.stringify(out, null, 2) + ";\n"
);
console.log(`\n완료: ${Object.keys(out).length}/${MEMBERS.length} 명 사진 확보 → js/memberPhotos.js`);
