#!/usr/bin/env node
/**
 * fetch-members.mjs — 멤버별 솔로 사진을 kpop.fandom(Wikia)에서 수집(멤버당 최대 5종).
 *
 * list=allimages(aiprefix="SEVENTEEN <이름>") 로 각 멤버 솔로 파일을 폭넓게 찾은 뒤,
 * 잡파일을 걸러 시대(파일명 순)로 고르게 5장을 선택한다. 이미지는 static.wikia.nocookie.net
 * (핫링크 허용) 호스팅. 결과: js/memberPhotos.js → window.SVTMemberPhotos = { id: {urls:[...], source} }
 *
 * 게임은 멤버 카드가 나올 때마다 urls 중 하나를 랜덤으로 골라 다양하게 보여준다.
 * ⚠️ 위키 파일명 기반이라 간혹 컨셉/화보가 섞일 수 있음 → 로그의 파일명으로 검수.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const { MEMBERS } = require(resolve(root, "js/data.js"));
// 실패 시 폴백을 위해 기존 파일을 읽어둔다.
let existing = {};
try { require(resolve(root, "js/memberPhotos.js")); existing = globalThis.window.SVTMemberPhotos || {}; } catch (e) {}

const API = "https://kpop.fandom.com/api.php";
const N = 5; // 멤버당 목표 사진 수
// 파일명 접두(대개 "SEVENTEEN <로마자이름>"). 필요 시 여기서 교정.
const PREFIX = {};
// 잡파일(로고/포스터/스캔/SNS/굿즈 등) 제외
const JUNK = /logo|icon|award|signature|banner|scan|fake|weibo|instagram|twitter|sticker|poster|wallpaper|font|symbol|album|single|light\s?stick|merch/i;
// 솔로 컷으로 볼 만한 파일 우선
const SOLO = /concept photo|profile|teaser|photoshoot|photo \d|jacket|behind|scene/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function allImages(prefix) {
  const url = API + "?" + new URLSearchParams({
    action: "query", format: "json", list: "allimages",
    aiprefix: prefix, ailimit: "500", aiprop: "url", aisort: "name",
  });
  const res = await fetch(url, { headers: { "User-Agent": "svt-quiz/1.0 (fan quiz)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.query && json.query.allimages) || [];
}

// 배열에서 n개를 고르게(등간격) 뽑아 시대가 겹치지 않게 한다.
function pickSpread(arr, n) {
  if (arr.length <= n) return arr.slice();
  const step = arr.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

async function memberPhotos(m) {
  const prefix = PREFIX[m.id] || `SEVENTEEN ${m.en || m.name}`;
  let raw = await allImages(prefix);
  if (raw.length < 2) {
    const alt = await allImages(m.en || m.name); // 폴백: 이름만
    if (alt.length > raw.length) raw = alt;
  }
  const imgs = raw
    .map((x) => ({ name: x.name, url: x.url }))
    .filter((x) => /\.(png|jpe?g)$/i.test(x.name))
    .filter((x) => !JUNK.test(x.name));
  const solo = imgs.filter((x) => SOLO.test(x.name));
  const pool = solo.length >= N ? solo : solo.concat(imgs.filter((x) => !solo.includes(x)));
  const chosen = pickSpread(pool, N);
  return { urls: chosen.map((x) => x.url), names: chosen.map((x) => x.name) };
}

// 기존 데이터를 새 스키마(urls 배열)로 정규화
function normalizeExisting(e) {
  if (!e) return null;
  if (Array.isArray(e.urls) && e.urls.length) return e;
  if (e.url) return { urls: [e.url], source: e.source || "" };
  return null;
}

const out = {};
for (const m of MEMBERS) {
  try {
    const r = await memberPhotos(m);
    if (r.urls.length) {
      out[m.id] = { urls: r.urls, source: `SEVENTEEN ${m.en || m.name}` };
      console.log(`✓ ${m.id.padEnd(10)} ${r.urls.length}컷: ${r.names.join(" | ")}`);
    } else {
      const keep = normalizeExisting(existing[m.id]);
      if (keep) { out[m.id] = keep; console.warn(`! ${m.id.padEnd(10)} 새 이미지 없음 → 기존 유지`); }
      else console.warn(`✗ ${m.id.padEnd(10)} 이미지 없음`);
    }
  } catch (e) {
    const keep = normalizeExisting(existing[m.id]);
    if (keep) out[m.id] = keep;
    console.warn(`✗ ${m.id.padEnd(10)} ${e.message}${keep ? " → 기존 유지" : ""}`);
  }
  await sleep(250);
}

const banner =
  "// 자동 생성 파일 — scripts/fetch-members.mjs (kpop.fandom) 로 갱신.\n" +
  "// 멤버당 solo 사진 최대 5종(urls). 비어 있으면 게임은 유닛 컬러 '이름 아바타'로 표시.\n";
writeFileSync(
  resolve(root, "js/memberPhotos.js"),
  banner + "window.SVTMemberPhotos = " + JSON.stringify(out, null, 2) + ";\n"
);
const counts = Object.values(out).map((x) => x.urls.length);
console.log(`\n완료: ${Object.keys(out).length}/${MEMBERS.length} 명 · 총 ${counts.reduce((a, b) => a + b, 0)}장 → js/memberPhotos.js`);
