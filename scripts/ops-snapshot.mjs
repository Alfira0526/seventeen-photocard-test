#!/usr/bin/env node
/**
 * ops-snapshot.mjs — Firebase 텔레메트리/제보를 스냅샷해 리포지토리에 커밋(주간 GitHub Actions).
 *
 * 샌드박스는 Firebase 접근이 막혀 있어 리뷰 루틴이 직접 못 읽는다. 그래서 GitHub Actions
 * (열린 네트워크)에서 /stats · /reports 를 GET 해 docs/ops/ 에 저장한다.
 *   docs/ops/stats-latest.json   : 원본 통계
 *   docs/ops/reports-latest.json : 원본 제보
 *   docs/ops/SNAPSHOT.md         : 사람이 읽는 집계(모드 이용률·유형별 정답률·이상문제·미처리 제보)
 * 이후 주간 리뷰 루틴(Claude)이 이 파일들을 읽어 5인 페르소나 리뷰를 수행한다.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
require(resolve(root, "js/ranking-config.js"));
const fb = ((globalThis.window.SVTRankingConfig || {}).firebase || "").replace(/\/$/, "");
if (!fb) { console.log("Firebase 미설정 → 스냅샷 생략"); process.exit(0); }

async function get(path) {
  const res = await fetch(`${fb}${path}.json`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return await res.json();
}

const stats = (await get("/stats").catch((e) => { console.warn("stats:", e.message); return null; })) || {};
const reportsObj = (await get("/reports").catch((e) => { console.warn("reports:", e.message); return null; })) || {};
const reports = Object.keys(reportsObj).map((k) => ({ id: k, ...reportsObj[k] }));

const outDir = resolve(root, "docs/ops");
mkdirSync(outDir, { recursive: true });
// 리뷰 루틴이 처리한 제보 id 목록(리포지토리로 관리 → Firebase는 append-only 유지)
let handled = [];
try { if (existsSync(resolve(outDir, "handled.json"))) handled = JSON.parse(readFileSync(resolve(outDir, "handled.json"), "utf8")); } catch (e) {}
const handledSet = new Set(Array.isArray(handled) ? handled : []);
writeFileSync(resolve(outDir, "stats-latest.json"), JSON.stringify(stats, null, 2));
writeFileSync(resolve(outDir, "reports-latest.json"), JSON.stringify(reports, null, 2));

const pct = (o, t) => (t ? Math.round((o / t) * 1000) / 10 : 0);
const modes = stats.modes || {};
const types = stats.types || {};
const items = stats.items || {};
const open = reports.filter((r) => (r.status || "open") === "open" && !handledSet.has(r.id));

// 모드 이용률
const modeRows = Object.keys(modes).map((m) => ({ m, plays: modes[m].plays || 0, games: modes[m].games || 0 }));
const totalPlays = modeRows.reduce((a, b) => a + b.plays, 0) || 1;

// 유형별 정답률
const typeRows = Object.keys(types)
  .map((k) => ({ k, ok: types[k].ok || 0, total: types[k].total || 0, pct: pct(types[k].ok || 0, types[k].total || 0) }))
  .sort((a, b) => a.pct - b.pct);

// 이상문제 후보: "전체 정답률 낮은 순"이 아니라 "같은 유형 평균 대비 이탈폭(%p)"으로 판정.
//  → year/ytYear 처럼 유형 자체가 어려운 항목과, loveandletter 처럼 유형 내에서 홀로 튀는
//    진짜 이상치를 구분한다(2026-07-27 리뷰 §3 제안 반영).
const SAMPLE_MIN = 8;
const DEV_FLAG = -15; // 유형평균 대비 이 이상(%p) 하회하면 데이터 오류 의심으로 플래그
const typePct = Object.fromEntries(typeRows.map((r) => [r.k, r.pct]));
const itemRows = Object.keys(items)
  .map((k) => {
    const ok = items[k].ok || 0, total = items[k].total || 0, p = pct(ok, total);
    const typeId = k.split("__")[0];
    const typeAvg = typePct[typeId] != null ? typePct[typeId] : null;
    const dev = typeAvg == null ? null : p - typeAvg; // 음수 = 유형평균보다 낮음
    return { k, ok, total, pct: p, typeId, typeAvg, dev };
  })
  .filter((r) => r.total >= SAMPLE_MIN)
  .sort((a, b) => (a.dev == null ? 0 : a.dev) - (b.dev == null ? 0 : b.dev)) // 이탈폭 큰(가장 낮은) 순
  .slice(0, 20);
const flagged = itemRows.filter((r) => r.dev != null && r.dev <= DEV_FLAG);

const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + "Z";
const md = [];
md.push(`# 운영 스냅샷 (${stamp})`);
md.push("");
md.push("> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.");
md.push("");
md.push("## 1) 모드 이용률");
md.push("| 모드 | 시작(plays) | 완료(games) | 비중 |");
md.push("|---|---:|---:|---:|");
if (modeRows.length) modeRows.forEach((r) => md.push(`| ${r.m} | ${r.plays} | ${r.games} | ${pct(r.plays, totalPlays)}% |`));
else md.push("| (데이터 없음) | | | |");
md.push("");
md.push("## 2) 문제 유형별 정답률 (낮은 순)");
md.push("| 유형 | 정답 | 응답 | 정답률 |");
md.push("|---|---:|---:|---:|");
if (typeRows.length) typeRows.forEach((r) => md.push(`| ${r.k} | ${r.ok} | ${r.total} | ${r.pct}% |`));
else md.push("| (데이터 없음) | | | |");
md.push("");
md.push(`## 3) 이상문제 후보 (표본 ${SAMPLE_MIN}+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)`);
md.push(`> ⚠ = 유형평균보다 ${-DEV_FLAG}%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 ${flagged.length}건.`);
md.push("| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |");
md.push("|---|---:|---:|---:|---:|:--:|");
if (itemRows.length) itemRows.forEach((r) => {
  const avg = r.typeAvg == null ? "-" : `${r.typeAvg}%`;
  const dev = r.dev == null ? "-" : `${r.dev > 0 ? "+" : ""}${r.dev}`;
  const flag = r.dev != null && r.dev <= DEV_FLAG ? "⚠" : "";
  md.push(`| \`${r.k}\` | ${r.pct}% | ${avg} | ${dev} | ${r.total} | ${flag} |`);
});
else md.push("| (표본 충분한 문제 없음) | | | | | |");
md.push("");
md.push(`## 4) 미처리 오류 제보 (${open.length}건)`);
if (open.length) {
  md.push("| 시각 | 로케일 | 문제 맥락 | 내용 |");
  md.push("|---|---|---|---|");
  open.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 50).forEach((r) => {
    const when = r.ts ? new Date(r.ts).toISOString().slice(0, 10) : "?";
    const ctx = r.ctx ? `${r.ctx.typeId || ""} / ${r.ctx.cardKind || ""}:${r.ctx.cardId || ""} / ✔${r.ctx.correct != null ? r.ctx.correct : "?"}` : "-";
    const text = String(r.text || "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 120);
    md.push(`| ${when} | ${r.locale || ""} | ${ctx} | ${text} |`);
  });
} else {
  md.push("접수된 미처리 제보가 없습니다.");
}
md.push("");
writeFileSync(resolve(outDir, "SNAPSHOT.md"), md.join("\n"));
console.log(`완료: 모드 ${modeRows.length} · 유형 ${typeRows.length} · 이상후보 ${itemRows.length}(플래그 ${flagged.length}) · 미처리제보 ${open.length} → docs/ops/`);
