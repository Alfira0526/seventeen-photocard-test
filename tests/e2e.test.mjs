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
  for (let r = 0; r < 22; r++) {
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

test("무한 모드: 시작 시 목숨 표시 + 자동 진행(다음 버튼 숨김)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="endless"]');
    await page.waitForSelector("#screen-play.active");
    const mode = await page.textContent("#hud-mode");
    assert.match(mode, /무한/);
    // 무한/타임어택은 '다음 문제' 버튼을 숨기고 자동 진행
    const nextHidden = await page.$eval("#btn-next", (b) => b.hidden);
    assert.ok(nextHidden, "무한 모드에선 다음 버튼이 숨겨져야 함");
  });
});

test("타임어택 모드: 타이머와 목숨(❤️) 표시", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="timeattack"]');
    await page.waitForSelector("#screen-play.active");
    const progress = await page.textContent("#progress");
    assert.match(progress, /\d+s/);
    const lives = await page.textContent("#hud-lives");
    assert.match(lives, /❤️/);
  });
});

test("다시 하기: 결과에서 시작화면으로 복귀", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    await page.click("#btn-restart");
    await page.waitForSelector("#screen-start.active");
    // 모드 버튼은 3개(일반/무한/타임어택)여야 함
    const modes = await page.$$eval(".mode-btn", (els) => els.map((e) => e.dataset.mode));
    assert.deepEqual(modes.sort(), ["endless", "normal", "timeattack"]);
  });
});
