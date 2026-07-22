/**
 * 브라우저 E2E 테스트 (node:test + Playwright).
 * 실행:  node --test tests/e2e.test.mjs
 *
 * - Playwright 미설치 시 전체 skip (유닛 테스트만으로도 CI 통과 가능).
 * - 브라우저 바이너리 경로가 특수한 환경은 SVT_CHROMIUM_PATH 로 지정 가능.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pageUrl = pathToFileURL(resolve(root, "index.html")).href;

let chromium = null;
try { ({ chromium } = await import("playwright")); } catch { /* 미설치 → skip */ }

const launchOpts = process.env.SVT_CHROMIUM_PATH
  ? { executablePath: process.env.SVT_CHROMIUM_PATH }
  : {};

async function withPage(fn) {
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, acceptDownloads: true });
    await page.goto(pageUrl);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function playThrough(page, pick = "first-child") {
  await page.waitForSelector("#screen-play.active");
  for (let r = 0; r < 12; r++) {
    await page.click(`#question .choice:${pick}`); // 카드당 1문제
    await page.waitForSelector("#btn-next:not([disabled])");
    await page.click("#btn-next");
    if (await page.$("#screen-result.active")) break;
  }
  await page.waitForSelector("#screen-result.active");
}

test("일반 모드: 완주 → 결과·공유카드 렌더", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    const score = await page.textContent("#result-score");
    assert.match(score, /\d+\s*\/\s*\d+/);
    const drawn = await page.evaluate(() => {
      const cv = document.getElementById("result-canvas");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return true;
      return false;
    });
    assert.ok(drawn, "공유 카드가 비어 있음");
    // 다시하기 → 시작화면 복귀
    await page.click("#btn-restart");
    await page.waitForSelector("#screen-start.active");
  });
});

test("트위터 공유: 인텐트 URL을 새 탭으로 연다(팝업 아님)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    const [popup] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 8000 }),
      page.click("#btn-tweet"),
    ]);
    // 새 탭이 열리면 성공(팝업 창이 아니라 정상 탭 흐름). 최종 URL은 네트워크 환경에 따라 다름
    // (오프라인 샌드박스에선 twitter 로드가 막혀 chrome-error가 될 수 있음).
    assert.ok(popup, "공유 시 새 탭이 열리지 않음");
  });
});

test("데일리 모드: 동일 날짜엔 결정론적(같은 덱/보기)", { skip: !chromium }, async () => {
  async function firstChoices() {
    return withPage(async (page) => {
      await page.click('.mode-btn[data-mode="daily"]');
      await page.waitForSelector("#screen-play.active");
      const label = await page.textContent(".q-label");
      const choices = await page.$$eval("#question .choice", (e) => e.map((x) => x.textContent).join("|"));
      return label + "::" + choices;
    });
  }
  assert.equal(await firstChoices(), await firstChoices());
});

test("오답 복습: 오답 발생 후 복습 모드 활성화", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page, "last-child"); // 마지막 보기만 골라 오답 유도
    assert.ok(await page.isVisible("#btn-review"), "결과의 복습 버튼 미표시");
    await page.click("#btn-restart");
    await page.waitForSelector("#screen-start.active");
    const enabled = await page.$eval("#mode-review", (b) => !b.disabled);
    assert.ok(enabled, "시작화면 복습 모드 비활성");
  });
});
