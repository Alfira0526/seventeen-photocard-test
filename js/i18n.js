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
        album: "이 자켓, 어떤 앨범일까요?",
        year: "언제 나온 앨범일까요?",
        track: "타이틀곡, 뭐였죠?",
        notInAlbum: "이 중에 이 앨범 수록곡이 <b>아닌</b> 건?",
        lyricist: (track) => `‘${track}’ 작사에 참여한 멤버는 누구일까요?`,
        unitSong: (unit) => `이 앨범에서 <b>${unit} 유닛</b>이 부른 곡, 뭘까요?`,
        albumType: "이 앨범, 어떤 유형일까요?",
        albumNumber: "이 앨범, 몇 집일까요?",
        laterAlbum: "이 앨범보다 <b>나중에</b> 나온 건?",
      },
      // 멤버 사진 라운드
      qm: {
        unitSong: (name) => `<b>${name}</b>가 부른 <b>유닛곡</b>은?`,
        notSong: (name) => `<b>${name}</b>가 부르지 <b>않은</b> 곡은?`,
        roster: (name) => `<b>${name}</b>와 <b>다른 유닛</b>인 멤버는?`,
        lyricist: (name) => `<b>${name}</b>가 <b>작사</b>한 타이틀곡은?`,
      },
      unit: { vocal: "보컬", hiphop: "힙합", performance: "퍼포먼스" },
      difficulty: {
        1: { label: "쉬움", stars: "★" },
        2: { label: "보통", stars: "★★" },
        3: { label: "어려움", stars: "★★★" },
        4: { label: "최상", stars: "★★★★" },
      },
      note: {
        notInAlbum: "살짝 힌트! 나머지 셋은 이 앨범에 담긴 곡이에요.",
        lyricist: "살짝 힌트! 세븐틴은 멤버가 직접 작사에 참여해요.",
        unitSong: "살짝 힌트! 유닛곡은 앨범 안에 숨어 있어요.",
        laterAlbum: "살짝 힌트! 나머지 셋은 이 앨범보다 먼저 나왔어요.",
        memberNot: "살짝 힌트! 유닛곡은 그 유닛 멤버만 불러요.",
        roster: "살짝 힌트! 보컬·힙합·퍼포먼스 유닛으로 나뉘어요.",
        mlyric: "살짝 힌트! 나머지 셋은 이 멤버가 작사에 참여하지 않았어요.",
      },
      feedback: {
        correct: "딩동댕, 맞았어요! 🎉",
        wrong: "앗, 아쉬워요 🥲",
      },
      next: { result: "결과 보러 가기", more: "다음 문제 →" },
      caption: {
        loaded: "© 저작권자 · Apple Music",
        error: "자켓을 못 불러왔어요 · 상상해서 맞혀봐요",
        noArt: "자켓을 못 불러왔어요 · 인터넷을 확인해 주세요",
      },
      hudMode: { normal: "🎲 일반", daily: "📅 데일리", review: "🔁 복습" },
      shareMode: { normal: "일반", daily: "데일리", review: "복습" },
      result: {
        detail: (tier, pct, hits, total) =>
          `<p class="tier">${tier}</p><p class="pct">${total}문제 중 ${hits}개 맞혔어요 · 정답률 ${pct}%</p>`,
        score: (score, max) => `${score}<span class="score-max"> / ${max}점</span>`,
      },
      share: {
        title: "SEVENTEEN 앨범 자켓 퀴즈",
        tweet: (tier, score, pct) =>
          `나 세븐틴 앨범 자켓 퀴즈에서 ${tier} 나왔어요!\n${score}점 · 정답률 ${pct}%\n너도 한번 해볼래?\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
      },
      start: {
        dailyDone: (pct, streak) =>
          `오늘은 벌써 풀었어요! 정답률 ${pct}%${streak ? ` · 🔥${streak}일 연속` : ""}`,
        dailyOpen: "오늘의 20문제, 준비해뒀어요",
      },
    },
  };

  const active = "ko";
  const api = { t: LOCALES[active], LOCALES, active };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.I18N = api;
})(typeof window !== "undefined" ? window : null);
