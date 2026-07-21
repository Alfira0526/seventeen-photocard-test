/**
 * i18n-lite — 게임 로직이 생성하는 UI 문자열을 한 곳에 모은다(B6).
 * 다국어가 필요해지면 LOCALES 에 언어를 추가하고 active 만 바꾸면 된다.
 * (index.html 의 정적 마크업 문구는 대상 아님 — 동적 문자열만 중앙화)
 */
(function (root) {
  "use strict";

  const LOCALES = {
    ko: {
      q: {
        album: "이 자켓의 앨범은?",
        year: "이 앨범의 발매 연도는?",
        track: "이 앨범의 타이틀곡은?",
      },
      feedback: {
        allCorrect: "🎉 3문제 모두 정답!",
        partial: (hit) => `이 자켓에서 ${hit} / 3 정답`,
      },
      next: { result: "결과 보기", more: "다음 자켓 →" },
      caption: {
        loaded: "© 저작권자 · Apple Music",
        error: "이미지 미로드 · 자켓 상상 모드",
        noArt: "이미지 미로드 · scripts/fetch-art.mjs 실행 시 표시",
      },
      hudMode: { normal: "🎲 일반", daily: "📅 데일리", review: "🔁 복습" },
      shareMode: { normal: "일반", daily: "데일리", review: "복습" },
      result: {
        detail: (tier, pct, hits, total) =>
          `<p class="tier">${tier}</p><p class="pct">정답률 ${pct}% (${hits}/${total})</p>`,
        score: (score, max) => `${score} / ${max} 점`,
      },
      share: {
        title: "SEVENTEEN 앨범 자켓 퀴즈",
        tweet: (tier, score, pct) =>
          `SEVENTEEN 앨범 자켓 퀴즈 결과\n${tier} · ${score}점 (정답률 ${pct}%)\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
      },
      start: {
        reviewReady: (n) => `직전 오답 ${n}개 다시 풀기`,
        reviewEmpty: "직전 판의 틀린 앨범(먼저 한 판 필요)",
        dailyDone: (pct, streak) =>
          `오늘 완료 · 정답률 ${pct}%${streak ? ` · 🔥${streak}일` : ""}`,
        dailyOpen: "오늘의 8장 · 하루 한 번 같은 문제",
      },
    },
  };

  const active = "ko";
  const api = { t: LOCALES[active], LOCALES, active };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.I18N = api;
})(typeof window !== "undefined" ? window : null);
