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

async function withPage(fn, opts = {}) {
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, acceptDownloads: true });
    if (opts.languages) {
      await page.addInitScript((langs) => {
        Object.defineProperty(navigator, "languages", { get: () => langs });
        Object.defineProperty(navigator, "language", { get: () => langs[0] });
      }, opts.languages);
    }
    if (opts.seedRanking) {
      await page.addInitScript((rows) => {
        try { localStorage.setItem("svt-ranking", JSON.stringify(rows)); } catch (e) {}
      }, opts.seedRanking);
    }
    if (opts.mockShare) {
      await page.addInitScript(() => {
        window.__shared = null;
        navigator.canShare = () => true;
        navigator.share = async (d) => {
          window.__shared = {
            hasFiles: !!(d.files && d.files.length),
            fileType: d.files && d.files[0] && d.files[0].type,
            text: d.text || "",
            url: d.url || null,
          };
        };
      });
    }
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
    await page.click("#btn-home");
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

test("공유하기: 이미지(파일) + 링크(캡션)를 함께 전송, url 필드로 파일공유 깨지지 않음", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    await page.click("#btn-share");
    await page.waitForTimeout(400);
    const shared = await page.evaluate(() => window.__shared);
    const href = await page.evaluate(() => location.href);
    assert.ok(shared, "navigator.share가 호출되지 않음");
    assert.ok(shared.hasFiles && shared.fileType === "image/png", "이미지 파일이 공유에 없음");
    assert.ok(shared.text.includes(href), "링크가 캡션에 포함되지 않음");
    assert.equal(shared.url, null, "files와 함께 url 필드가 들어가 파일 공유가 깨질 수 있음");
  }, { mockShare: true });
});

test("무한 모드: 시작 시 목숨 표시 + 자동 진행(다음 버튼 숨김)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="endless"]');
    await page.waitForSelector("#screen-play.active");
    const mode = await page.textContent("#hud-mode");
    assert.match(mode, /♾️/); // 로케일 무관(이모지)
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

test("다국어: 자동 감지(한국어권) → 영문 병기 표시", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    // 수동 선택 없이 자동 감지 상태에서 병기(영문 보조) 노출 확인
    await page.waitForSelector('[data-i18n="tagline"]');
    const tagHtml = await page.$eval('[data-i18n="tagline"]', (e) => e.innerHTML);
    assert.match(tagHtml, /i18n-sub/, "자동 감지 시 영문 병기가 없음");
    await page.click('.mode-btn[data-mode="normal"]');
    await page.waitForSelector("#screen-play.active");
    const q = await page.$eval(".q-label", (e) => e.innerHTML);
    assert.match(q, /i18n-sub/, "문제 라벨에 영문 병기가 없음");
  }, { languages: ["ko-KR", "ko"] });
});

test("다국어: 특정 언어 직접 선택 시 병기 사라짐(단독 표기)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#lang-select");
    // 자동은 병기였지만, 사용자가 한국어를 직접 고르면 영문 보조가 사라져야 함
    await page.selectOption("#lang-select", "ko");
    const tagHtml = await page.$eval('[data-i18n="tagline"]', (e) => e.innerHTML);
    assert.doesNotMatch(tagHtml, /i18n-sub/, "직접 선택했는데 영문 병기가 남아있음");
    await page.click('.mode-btn[data-mode="normal"]');
    await page.waitForSelector("#screen-play.active");
    const q = await page.$eval(".q-label", (e) => e.innerHTML);
    assert.doesNotMatch(q, /i18n-sub/, "직접 선택 후 문제 라벨에 병기가 남음");
  }, { languages: ["ko-KR", "ko"] });
});

test("다국어: 영어 선택 시 앨범 유형 보기도 영어로(한글 미노출)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#lang-select");
    await page.selectOption("#lang-select", "en");
    await page.click('.mode-btn[data-mode="normal"]');
    await page.waitForSelector("#screen-play.active");
    let sawType = false;
    for (let r = 0; r < 20; r++) {
      const label = await page.$eval(".q-label", (e) => e.textContent);
      if (/type of release|numbered album/i.test(label)) {
        sawType = true;
        const choices = await page.$$eval("#question .choice", (els) => els.map((e) => e.textContent));
        for (const ch of choices) assert.doesNotMatch(ch, /[가-힣]/, `유형 보기에 한글: ${ch}`);
      }
      await page.click("#question .choice:first-child");
      await page.waitForSelector("#btn-next:not([disabled])");
      await page.click("#btn-next");
      if (await page.$("#screen-result.active")) break;
    }
    assert.ok(sawType, "유형 문제가 한 번도 안 나옴(20문제)");
  });
});

test("다국어: 영어 선택 시 단일 언어(병기 없음)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#lang-select");
    await page.selectOption("#lang-select", "en");
    const tagHtml = await page.$eval('[data-i18n="tagline"]', (e) => e.innerHTML);
    assert.doesNotMatch(tagHtml, /i18n-sub/, "영어 단일인데 병기 스팬이 있음");
    const modeT = await page.textContent('[data-i18n="modeNormalT"]');
    assert.match(modeT, /Quick Round/);
  });
});

test("한 판 더: 방금 한 모드로 바로 재시작(플레이 화면)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    await page.click("#btn-restart");
    await page.waitForSelector("#screen-play.active"); // 시작화면이 아니라 곧장 재시작
    const progress = await page.textContent("#progress");
    assert.match(progress, /1 \/ 20/);
  });
});

test("처음으로: 결과에서 시작화면으로 복귀 + 모드 3개", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    await page.click("#btn-home");
    await page.waitForSelector("#screen-start.active");
    const modes = await page.$$eval(".mode-btn", (els) => els.map((e) => e.dataset.mode));
    assert.deepEqual(modes.sort(), ["endless", "normal", "timeattack"]);
  });
});

test("명예의 전당: 모드 기록 10건 이상이면 시작화면에 롤링 노출", { skip: !chromium }, async () => {
  const seed = Array.from({ length: 12 }, (_, i) => ({
    name: `caret${i}`, score: 100 - i * 3, mode: "normal", ts: 1000 + i,
  }));
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#hall:not([hidden])", { timeout: 4000 });
    const items = await page.$$eval("#hall-list li", (els) => els.length);
    assert.ok(items >= 10, `롤링 목록이 비었음(${items})`);
    const hallMode = await page.textContent("#hall-mode");
    assert.match(hallMode, /일반|Normal|通常|普通|Normal/);
  }, { seedRanking: seed, languages: ["ko-KR", "ko"] });
});

test("명예의 전당: 기록 10건 미만이면 숨김", { skip: !chromium }, async () => {
  const seed = Array.from({ length: 5 }, (_, i) => ({ name: `x${i}`, score: 50, mode: "normal", ts: i }));
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForTimeout(500);
    const hidden = await page.$eval("#hall", (e) => e.hidden);
    assert.ok(hidden, "기록이 적은데 명예의 전당이 보임");
  }, { seedRanking: seed });
});
