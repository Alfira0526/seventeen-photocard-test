#!/usr/bin/env node
/**
 * detect-title.mjs — 앨범 자켓에 "앨범명"이 인쇄돼 있는지 OCR로 판정.
 *
 * 자켓에 제목이 적혀 있으면 '앨범 맞히기' 문제는 읽으면 답이 나와 무의미하므로,
 * 그런 앨범은 titleOnCover=true 로 표시해 questions.js 가 album 유형을 제외한다.
 *
 * 동작:
 *   1) js/albumArt.js + js/data.js 로 앨범과 커버 URL을 읽는다.
 *   2) 각 커버를 내려받아 tesseract(eng+kor) 로 텍스트를 추출.
 *   3) 앨범 제목이 OCR 텍스트에 나타나면 titleOnCover=true.
 *   4) js/coverMeta.js 생성: window.SVTCoverMeta = { id: { titleOnCover, ocr } }.
 *
 * 필요: tesseract-ocr (+kor). CI 워크플로에서 apt 설치.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 앨범 + 아트 URL 로드(브라우저 전역을 흉내)
globalThis.window = {};
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
try { require(resolve(root, "js/albumArt.js")); } catch (e) { console.warn("albumArt.js 없음"); }
const { ALBUMS } = require(resolve(root, "js/data.js"));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
const words = (s) =>
  String(s).toLowerCase().split(/[^a-z0-9가-힣]+/).map((w) => w.trim()).filter((w) => w.length >= 2);

// OCR 텍스트에 제목이 있는지 판정
function titleAppears(title, ocr) {
  const nOcr = norm(ocr);
  if (!nOcr) return false;
  const nTitle = norm(title);
  if (nTitle.length >= 3 && nOcr.includes(nTitle)) return true; // 제목 통째로 등장
  const ws = words(title).map(norm).filter((w) => w.length >= 2);
  if (!ws.length) return false;
  const hit = ws.filter((w) => nOcr.includes(w)).length;
  const hasLong = ws.some((w) => w.length >= 3 && nOcr.includes(w));
  return hasLong && hit / ws.length >= 0.6; // 핵심 단어(3+자) 포함 + 60% 이상
}

const tmp = mkdtempSync(join(tmpdir(), "svt-ocr-"));
const out = {};
let onCover = 0, checked = 0;

for (const a of ALBUMS) {
  if (!a.art) continue;
  checked++;
  try {
    const res = await fetch(a.art);
    if (!res.ok) { console.warn(`✗ ${a.id} download HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const img = join(tmp, `${a.id}.jpg`);
    writeFileSync(img, buf);
    let text = "";
    try { text = execFileSync("tesseract", [img, "stdout", "-l", "eng+kor", "--psm", "11"], { encoding: "utf8" }); }
    catch (e) { text = ""; }
    const flag = titleAppears(a.title, text);
    if (flag) onCover++;
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 70);
    out[a.id] = { titleOnCover: flag, ocr: snippet };
    console.log(`${flag ? "📛" : "  "} ${a.id.padEnd(16)} title="${a.title}"  OCR="${snippet}"`);
  } catch (e) {
    console.warn(`✗ ${a.id} ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 120));
}

const banner =
  "// 자동 생성 파일 — scripts/detect-title.mjs (OCR) 로 갱신. 직접 편집 금지.\n" +
  "// titleOnCover: 자켓에 앨범명이 인쇄되어 있으면 true (앨범 맞히기 문제 제외).\n";
const body =
  "window.SVTCoverMeta = " +
  JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { titleOnCover: v.titleOnCover }])), null, 2) +
  ";\n";
writeFileSync(resolve(root, "js/coverMeta.js"), banner + body);

console.log(`\n완료: ${checked}개 검사 · 앨범명 포함(제외 대상) ${onCover}개 → js/coverMeta.js`);
