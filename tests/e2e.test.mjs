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
    // 업데이트 공지 팝업은 기본 억제(모드 버튼 클릭 방해 방지). 팝업 테스트만 opt-in.
    if (!opts.showAnnounce) {
      await page.addInitScript(() => { window.__SVT_NO_ANNOUNCE = true; });
    }
    // 시즌 계산 시각 고정(기본: 시즌2 초반). opts.now 로 막판 등 시뮬레이션.
    const nowMs = opts.now != null ? opts.now : Date.parse("2026-07-27T00:00:00Z");
    await page.addInitScript((t) => { window.__SVT_NOW = t; }, nowMs);
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
    // 테스트베드(검수 모드)용 임시 draft 문제 주입
    if (opts.testDrafts) {
      await page.addInitScript((rows) => { window.__SVT_TEST_DRAFTS = rows; }, opts.testDrafts);
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
    await page.goto(opts.preview ? pageUrl + "?preview=1" : pageUrl); // ?preview=1 → env.js가 스테이징으로 인식
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

// 언어는 이제 ⚙️ 설정 패널 안의 셀렉터로 고른다 → 모달을 열고 선택 후 닫는다.
async function openSettingsAndPick(page, code) {
  await page.click("#settings-open");
  await page.waitForSelector("#settings-modal:not([hidden]) #lang-select");
  await page.selectOption("#lang-select", code);
  await page.click("#settings-close");
  await page.waitForSelector("#settings-modal", { state: "hidden" });
}

test("일반 모드: 완주 → 결과·공유카드 렌더", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    const score = await page.textContent("#result-score");
    assert.match(score, /\d+/); // 노멀=난이도·속도·콤보 raw 점수(만점 천장 제거)
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
    // 자동은 병기였지만, 사용자가 한국어를 직접 고르면 영문 보조가 사라져야 함
    await openSettingsAndPick(page, "ko");
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
    await openSettingsAndPick(page, "en");
    // 유형 문제는 랜덤 출제라 한 판에 안 나올 수 있음 → 여러 판 반복(플래키 방지)
    let sawType = false;
    for (let game = 0; game < 12 && !sawType; game++) {
      await page.waitForSelector("#screen-start.active");
      await page.click('.mode-btn[data-mode="normal"]');
      await page.waitForSelector("#screen-play.active");
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
      if (!sawType) { await page.click("#btn-home"); } // 다음 판을 위해 시작화면 복귀
    }
    assert.ok(sawType, "유형 문제가 12판 내내 안 나옴");
  });
});

test("다국어: 영어 선택 시 단일 언어(병기 없음)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await openSettingsAndPick(page, "en");
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
    // 프로덕션에 보이는 모드(검수 버튼은 테스트베드 전용이라 숨김)
    const modes = await page.$$eval(".mode-btn", (els) =>
      els.filter((e) => !e.hidden).map((e) => e.dataset.mode));
    assert.deepEqual(modes.sort(), ["endless", "normal", "timeattack"]);
  });
});

test("명예의 전당: 이번 달 기록이 임계 이상이면 이번 달 순위로 표시", { skip: !chromium }, async () => {
  // 이번 달(2026-07) 저장키 = normal_202607
  const seed = [
    ...Array.from({ length: 6 }, (_, i) => ({ name: `julN${i}`, score: 300 - i * 7, mode: "normal_202607", season: "202607", ts: 1000 + i })),
  ];
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#hall:not([hidden])", { timeout: 4000 });
    const cols = await page.$$eval(".hall-col", (els) => els.length);
    assert.equal(cols, 3); // 3모드 한 화면
    const src = await page.textContent("#hall-src-normal");
    assert.match(src, /오픈베타|Open Beta/); // 2026-07 = 오픈베타 기간
    // 금색 1위 박제 = 이번 달 실제 1위(julN0, 최고점) — '지금 1위'와 일치
    const champTxt = await page.textContent("#hall-champ-normal");
    assert.ok(/julN0/.test(champTxt), "이번 달 실시간 1위가 박제되지 않음");
    // 리스트는 2위부터(1위는 위에 박제)
    const listTxt = await page.textContent("#hall-normal");
    assert.ok(/julN1/.test(listTxt) && !/julN0/.test(listTxt), "리스트가 2위부터가 아님");
  }, { seedRanking: seed, languages: ["ko-KR", "ko"] });
});

test("명예의 전당: 이번 달이 적으면 오픈베타(구) 순위 노출 + 챔피언 상시 박제", { skip: !chromium }, async () => {
  // 오픈베타 6건(old0=1위) + 이번 달 1건(임계 3 미만) → 오픈베타 데이터 노출, old0 챔피언 박제
  const seed = [
    ...Array.from({ length: 6 }, (_, i) => ({ name: `old${i}`, score: 100 - i * 5, mode: "normal", ts: i })),
    { name: "newbie", score: 250, mode: "normal_202607", season: "202607", ts: 900 },
  ];
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#hall:not([hidden])", { timeout: 4000 });
    // 챔피언(오픈베타 1위 = old0) 상시 박제
    const champHidden = await page.$eval("#hall-champ-normal", (e) => e.hidden);
    assert.ok(!champHidden, "챔피언 박제가 숨겨짐");
    const champTxt = await page.textContent("#hall-champ-normal");
    assert.ok(/old0/.test(champTxt), "오픈베타 1위가 챔피언으로 안 뜸");
    // 라이브 리스트는 오픈베타(구) 데이터
    const src = await page.textContent("#hall-src-normal");
    assert.match(src, /오픈베타|Open Beta|オープン|公测|Beta/);
    // 챔피언(1위)은 리스트에서 제외되고 2위부터 노출
    const listTxt = await page.textContent("#hall-normal");
    assert.ok(/old1/.test(listTxt) && !/old0/.test(listTxt), "리스트가 2위부터가 아님");
  }, { seedRanking: seed, languages: ["ko-KR", "ko"] });
});

test("명예의 전당: 기록이 전혀 없으면 숨김", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForTimeout(500);
    const hidden = await page.$eval("#hall", (e) => e.hidden);
    assert.ok(hidden, "기록이 없는데 명예의 전당이 보임");
  }, { seedRanking: [] });
});

test("지난 시즌 토글: 결과 화면에서 구 랭킹을 별도로 표기", { skip: !chromium }, async () => {
  // 구 시즌(접미사 없음) 기록만 시드 → 현재 시즌 목록은 비어 있고, 토글 시 구 기록 노출
  const seed = Array.from({ length: 3 }, (_, i) => ({ name: `legacy${i}`, score: 90 - i, mode: "normal", ts: i }));
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await playThrough(page);
    await page.waitForSelector("#screen-result.active");
    // 현재 시즌: 구 기록 안 보임
    const before = await page.textContent("#rank-list");
    assert.ok(!/legacy0/.test(before), "현재 시즌에 구 기록이 섞임");
    // 지난 시즌 토글
    await page.click("#btn-legacy");
    await page.waitForFunction(() => /legacy0/.test(document.getElementById("rank-list").textContent), null, { timeout: 3000 });
    const after = await page.textContent("#rank-list");
    assert.ok(/legacy0/.test(after), "지난 시즌 기록이 안 뜸");
  }, { seedRanking: seed });
});

test("난이도 선택: 어려움 칩으로 일반 모드 원탭 시작", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    const chips = await page.$$eval(".diff-chip", (els) => els.map((e) => e.dataset.diff));
    assert.deepEqual(chips.sort(), ["easy", "hard", "normal"]);
    await page.click('.diff-chip[data-diff="hard"]');
    await page.waitForSelector("#screen-play.active"); // 일반 모드 시작
    const progress = await page.textContent("#progress");
    assert.match(progress, /1 \/ 20/); // 일반 모드 20문제
  }, { languages: ["ko-KR", "ko"] });
});

test("시즌 배너: 시작화면에 이번 달 종료 카운트다운(D-N) 노출", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#season-banner:not([hidden])", { timeout: 3000 });
    const txt = await page.textContent("#season-banner");
    assert.match(txt, /오픈베타|Open Beta/); // 2026-07 = 오픈베타
    assert.match(txt, /종료 D-\d+|ends in/);
    const isFinal = await page.$eval("#season-banner", (e) => e.classList.contains("final"));
    assert.ok(!isFinal, "초반인데 막판 강조가 켜짐");
  }, { languages: ["ko-KR", "ko"] });
});

test("시즌 배너: 말일 임박(D-3 이내)엔 '막판 순위 굳히기' 강조", { skip: !chromium }, async () => {
  // 2026-07-30 → 7월 종료(8/1)까지 이틀
  const now = Date.parse("2026-07-30T00:00:00Z");
  await withPage(async (page) => {
    await page.waitForSelector("#season-banner:not([hidden])", { timeout: 3000 });
    const isFinal = await page.$eval("#season-banner", (e) => e.classList.contains("final"));
    assert.ok(isFinal, "막판인데 강조가 안 켜짐");
    const txt = await page.textContent("#season-banner");
    assert.match(txt, /마지막|Final|ラスト|最后|Últimos/);
  }, { now, languages: ["ko-KR", "ko"] });
});

test("시즌 배너: 종료 하루 이내엔 실시간 카운트다운(H:MM:SS), 1시간 전엔 긴급 강조", { skip: !chromium }, async () => {
  // 7월 종료 = 8/1 00:00 KST = 7/31 15:00 UTC.
  // (1) 12시간 전 → 카운트다운 O, 긴급(urgent) X
  await withPage(async (page) => {
    await page.waitForSelector("#season-banner.countdown", { timeout: 3000 });
    const txt = await page.textContent("#season-banner");
    assert.match(txt, /종료까지|Ends in|終了まで|距结束|Termina/);
    assert.match(txt, /\d:\d\d:\d\d/, "H:MM:SS 카운트다운 형식 아님");
    const urgent = await page.$eval("#season-banner", (e) => e.classList.contains("urgent"));
    assert.ok(!urgent, "12시간 전인데 긴급 강조가 켜짐");
  }, { now: Date.parse("2026-07-31T03:00:00Z"), languages: ["ko-KR", "ko"] });
  // (2) 30분 전 → 긴급 강조 O
  await withPage(async (page) => {
    await page.waitForSelector("#season-banner.countdown.urgent", { timeout: 3000 });
    const txt = await page.textContent("#season-banner");
    assert.match(txt, /\d:\d\d:\d\d/);
  }, { now: Date.parse("2026-07-31T14:30:00Z"), languages: ["ko-KR", "ko"] });
});

test("시즌 종료 팝업: 새 시즌 초반에 직전 시즌 각 분야 1위 발표", { skip: !chromium }, async () => {
  // 8/2 → 8월 시즌 초반. 직전(7월) 데이터 시드 → 각 모드 1위 발표 팝업.
  const now = Date.parse("2026-08-02T00:00:00Z");
  const seed = [
    { name: "julNormalKing", score: 99999, mode: "normal_202607", season: "202607", ts: 10 },
    { name: "julEndlessKing", score: 88888, mode: "endless_202607", season: "202607", ts: 11 },
    { name: "julTAKing", score: 77777, mode: "timeattack_202607", season: "202607", ts: 12 },
  ];
  await withPage(async (page) => {
    await page.waitForSelector("#season-result-modal:not([hidden])", { timeout: 5000 });
    const txt = await page.textContent("#season-result-modal");
    assert.match(txt, /시즌 종료|season closed/);
    assert.ok(/julNormalKing/.test(txt), "일반 1위가 발표에 없음");
    // 닫으면 사라지고, 재방문(reload) 시 다시 뜨지 않아야 함(최초 1회)
    await page.click("#season-result-close");
    assert.equal(await page.isVisible("#season-result-modal"), false);
    await page.reload();
    await page.waitForSelector("#screen-start.active");
    await page.waitForTimeout(600);
    assert.equal(await page.isVisible("#season-result-modal"), false, "이미 본 시즌인데 또 뜸");
  }, { now, seedRanking: seed, languages: ["ko-KR", "ko"] });
});

test("검수 모드: 프로덕션에선 버튼이 숨겨진다", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    assert.equal(await page.isVisible("#mode-review"), false, "프로덕션에 검수 버튼이 노출됨");
  }, { languages: ["ko-KR", "ko"] });
});

test("검수 모드: 테스트베드에선 신규(draft) 문제만 모아 출제", { skip: !chromium }, async () => {
  const draft = [{ id: "__test_draft_al", title: "테스트앨범", year: 2026, type: "미니 5집", titleTrack: "테스트곡" }];
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#mode-review:not([hidden])", { timeout: 3000 });
    // 실제 draft 개수(주입분 포함)를 페이지에서 직접 계산
    const nDraft = await page.evaluate(() => {
      const D = window.SVTData.DRAFTS;
      return D.ALBUMS.length + D.MEMBERS.length + D.YT_SONGS.length;
    });
    assert.ok(nDraft >= 1, "주입 draft 가 반영되지 않음");
    const sub = await page.textContent("#mode-review");
    assert.match(sub, new RegExp(`신규 문제 ${nDraft}개|${nDraft} new`)); // 버튼은 '항목' 수
    await page.click("#mode-review");
    await page.waitForSelector("#screen-play.active", { timeout: 3000 });
    const hud = await page.textContent("#hud-mode");
    assert.match(hud, /검수|Review/);
    // 덱은 '각 draft가 만들 수 있는 모든 유형(경우의 수)'으로 확장됨 → 항목 수보다 많다
    const progress = await page.textContent("#progress");
    const m = progress.match(/1 \/ (\d+)/);
    assert.ok(m, "진행 표시 형식 오류");
    const total = Number(m[1]);
    assert.ok(total > nDraft, `경우의 수 열거가 항목 수(${nDraft})보다 많아야 하는데 ${total}`);
    assert.ok(total < 200, "검수 덱에 일반 문제가 섞임(격리 실패로 과다)");
    // 검수 정보줄: 현재 항목·유형·정답 노출
    await page.waitForSelector("#review-info:not([hidden])", { timeout: 2000 });
    const ri = await page.textContent("#review-info");
    assert.match(ri, /정답:/);
    // 첫 draft 항목의 여러 유형이 실제로 덱에 있는지: 몇 문제 넘겨보며 typeId가 바뀌는지 확인
    const types = new Set();
    for (let i = 0; i < 5; i++) {
      const t = await page.$eval("#review-info .ri-type", (e) => e.textContent).catch(() => "");
      if (t) types.add(t);
      const ch = await page.$(".choice:not([disabled])");
      if (ch) await ch.click();
      const nx = await page.$("#btn-next:not([hidden]):not([disabled])");
      if (nx) await nx.click(); else break;
      await page.waitForTimeout(80);
    }
    assert.ok(types.size >= 2, "여러 유형이 열거되지 않음(경우의 수 미확장)");
  }, { preview: true, testDrafts: draft, languages: ["ko-KR", "ko"] });
});

test("명예의 전당: '분기 누적' 탭은 그 분기 월간 데이터를 합산해 표시", { skip: !chromium }, async () => {
  // 2026 Q3 = 7·8·9월. 7월·8월에 각각 시드 → 분기 탭에서 둘 다 합산
  const seed = [
    ...Array.from({ length: 3 }, (_, i) => ({ name: `jul${i}`, score: 200 - i, mode: "normal_202607", season: "202607", ts: 100 + i })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `aug${i}`, score: 260 - i, mode: "normal_202608", season: "202608", ts: 200 + i })),
  ];
  await withPage(async (page) => {
    await page.waitForSelector("#hall:not([hidden])", { timeout: 4000 });
    await page.click("#hall-tab-quarter");
    await page.waitForFunction(() => /aug0/.test(document.getElementById("hall-normal").textContent), null, { timeout: 3000 });
    const listTxt = await page.textContent("#hall-normal");
    assert.ok(/jul0/.test(listTxt) && /aug0/.test(listTxt), "분기 누적에 7·8월이 합쳐지지 않음");
    const src = await page.textContent("#hall-src-normal");
    assert.match(src, /분기|Q3|Quarter/);
  }, { seedRanking: seed, languages: ["ko-KR", "ko"] });
});

test("업데이트 공지: 최초 1회 노출 → 닫으면 재방문 시 미노출", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.waitForSelector("#screen-start.active");
    await page.waitForSelector("#announce-modal:not([hidden])", { timeout: 3000 });
    // CTA 로 닫으면 노멀 모드 시작(기능 체감)
    await page.click("#announce-cta");
    await page.waitForSelector("#announce-modal", { state: "hidden" });
    await page.waitForSelector("#screen-play.active");
    // 재방문(reload) 시 공지 미노출
    await page.reload();
    await page.waitForSelector("#screen-start.active");
    await page.waitForTimeout(700);
    const shown = await page.$eval("#announce-modal", (e) => !e.hidden);
    assert.ok(!shown, "재방문인데 공지가 다시 뜸");
  }, { showAnnounce: true });
});

test("초창기 모드: 🕰️ 칩으로 일반 모드 시작(2015~17 자켓 집중)", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.era-chip[data-era="early"]');
    await page.waitForSelector("#screen-play.active");
    // era 칩은 난이도 칩과 분리 → .diff-chip 셀렉터에 섞이지 않아야 함
    const diffs = await page.$$eval(".diff-chip", (els) => els.map((e) => e.dataset.diff));
    assert.deepEqual([...diffs].sort(), ["easy", "hard", "normal"], "era 칩이 .diff-chip 로 잡힘");
  });
});

test("제보: 플레이 중 아직 안 푼 문제는 정답(✔) 미노출, 답한 뒤엔 노출", { skip: !chromium }, async () => {
  await withPage(async (page) => {
    await page.click('.mode-btn[data-mode="normal"]');
    await page.waitForSelector("#screen-play.active");
    await page.click("#btn-report-play");
    await page.waitForSelector("#report-modal:not([hidden])");
    const before = await page.textContent("#report-ctx");
    assert.doesNotMatch(before, /✔/, "안 푼 문제인데 정답(✔)이 노출됨");
    await page.click("#report-cancel");
    await page.click("#question .choice:first-child");
    await page.waitForSelector("#btn-next:not([disabled])");
    await page.click("#btn-report-play");
    await page.waitForSelector("#report-modal:not([hidden])");
    const after = await page.textContent("#report-ctx");
    assert.match(after, /✔/, "답한 뒤엔 정답이 표기돼야 함");
  });
});
