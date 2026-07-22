/**
 * i18n-lite — 게임 로직이 생성하는 UI 문자열을 한 곳에 모은다(B6).
 * 다국어가 필요해지면 LOCALES 에 언어를 추가하고 active 만 바꾸면 된다.
 * (index.html 의 정적 마크업 문구는 대상 아님 — 동적 문자열만 중앙화)
 */
(function (root) {
  "use strict";

  // 한글 받침 여부 → 조사 자동 선택(이/가, 와/과)
  function hasBatchim(s) {
    const c = String(s).charCodeAt(s.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return null; // 한글 아님
    return (c - 0xac00) % 28 !== 0;
  }
  const ig = (s) => (hasBatchim(s) == null ? "가" : hasBatchim(s) ? "이" : "가");
  const wg = (s) => (hasBatchim(s) == null ? "와" : hasBatchim(s) ? "과" : "와");

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
        unitSong: (name) => `<b>${name}</b>${ig(name)} 부른 <b>유닛곡</b>은?`,
        notSong: (name) => `<b>${name}</b>${ig(name)} 부르지 <b>않은</b> 곡은?`,
        roster: (name) => `<b>${name}</b>${wg(name)} <b>다른 유닛</b>인 멤버는?`,
        lyricist: (name) => `<b>${name}</b>${ig(name)} <b>작사</b>한 타이틀곡은?`,
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
        over: "여기까지예요! 수고했어요 🫠",
      },
      rank: {
        saved: "랭킹에 올렸어요! 🏆",
        empty: "아직 기록이 없어요 · 1등의 주인공이 되어봐요",
      },
      next: { result: "결과 보러 가기", more: "다음 문제 →" },
      caption: {
        loaded: "© 저작권자 · Apple Music",
        error: "자켓을 못 불러왔어요 · 상상해서 맞혀봐요",
        noArt: "자켓을 못 불러왔어요 · 인터넷을 확인해 주세요",
      },
      hudMode: { normal: "🎲 일반", endless: "♾️ 무한", timeattack: "⏱️ 타임어택" },
      shareMode: { normal: "일반", endless: "무한", timeattack: "타임어택" },
      share: {
        title: "SEVENTEEN 앨범 자켓 퀴즈",
        tweet: (tier, line) =>
          `나 세븐틴 앨범 자켓 퀴즈에서 ${tier} 나왔어요!\n${line}\n너도 한번 해볼래?\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
        native: (tier, line) =>
          `SEVENTEEN 앨범 자켓 퀴즈 결과\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
        saved: "이미지를 저장했어요 🖼️",
        fallback: "이미지를 저장했어요! SNS 앱에서 올려주세요 😊",
        insta: "이미지를 저장했어요! 인스타 스토리·피드에 올려주세요 📷",
        kakao: "이미지를 저장했어요! 카카오톡에 올려주세요 💬",
      },
    },
  };

  const active = "ko";
  const api = { t: LOCALES[active], LOCALES, active };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.I18N = api;
})(typeof window !== "undefined" ? window : null);
