/**
 * i18n — 다국어 + 병기(영문 + 접속지역 언어) 엔진.
 *
 * 지원 로케일: ko(한국어) · en(English) · ja(日本語) · zh(简体中文) · es(Español)
 * 영문(en)을 기준(anchor)으로 두고, 감지된 지역 언어를 주(主)로, 영문을 보조로 병기한다.
 *   - I18N.t         : 현재 로케일의 "병기 HTML" 문자열/함수 트리 (DOM innerHTML 용, 안정 참조)
 *   - I18N.raw(code) : 특정 로케일의 단일언어 원본(캔버스·공유텍스트 등 평문 용)
 *   - I18N.locale    : 현재 로케일 코드
 *   - I18N.setLocale(code) : 로케일 변경(내용을 t 객체에 in-place 반영 → 캡처된 참조 유지)
 *   - I18N.onChange(cb)    : 로케일 변경 콜백
 *
 * 로케일 변경은 시작화면에서만 일어나므로(플레이 중 문제 재생성 방지) t 를 in-place 로 갱신한다.
 */
(function (root) {
  "use strict";

  // ── 한글 받침 → 조사 자동 선택(이/가, 와/과) ──
  function hasBatchim(s) {
    s = String(s);
    const c = s.charCodeAt(s.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return null; // 한글 아님
    return (c - 0xac00) % 28 !== 0;
  }
  const ig = (s) => (hasBatchim(s) == null ? "가" : hasBatchim(s) ? "이" : "가");
  const wg = (s) => (hasBatchim(s) == null ? "와" : hasBatchim(s) ? "과" : "와");

  // 이름 인자는 문자열 또는 {loc,en} 객체 모두 허용 → 로케일에 맞는 표기 선택
  const nm = (n, key) => (n && typeof n === "object" ? (n[key] || n.loc || n.en) : n);

  // 유닛 명칭(로케일별) — q.unitSong 라벨에서 사용
  const U = {
    ko: { vocal: "보컬", hiphop: "힙합", performance: "퍼포먼스" },
    en: { vocal: "Vocal", hiphop: "Hip-hop", performance: "Performance" },
    ja: { vocal: "ボーカル", hiphop: "ヒップホップ", performance: "パフォーマンス" },
    zh: { vocal: "声乐", hiphop: "嘻哈", performance: "表演" },
    es: { vocal: "Vocal", hiphop: "Hip-hop", performance: "Performance" },
  };

  // ── 로케일별 원본(단일언어) 문자열 트리 ──
  const LOCALES = {
    ko: {
      _unit: U.ko,
      q: {
        album: "이 자켓, 어떤 앨범일까요?",
        albumCrop: "🔍 확대된 자켓, 어떤 앨범일까요?",
        year: "언제 나온 앨범일까요?",
        track: "타이틀곡, 뭐였죠?",
        notInAlbum: "이 중에 이 앨범 수록곡이 <b>아닌</b> 건?",
        lyricist: (track) => `‘${track}’ 작사에 참여한 멤버는 누구일까요?`,
        unitSong: (u) => `이 앨범에서 <b>${U.ko[u] || u} 유닛</b>이 부른 곡, 뭘까요?`,
        albumType: "이 앨범, 어떤 유형일까요?",
        albumNumber: "이 앨범, 몇 집일까요?",
        laterAlbum: "이 앨범보다 <b>나중에</b> 나온 건?",
        timeline: "발매가 <b>빠른 순서</b>로 올바른 것은?",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} 부른 <b>유닛곡</b>은?`,
        notSong: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} 부르지 <b>않은</b> 곡은?`,
        roster: (n) => `<b>${nm(n, "loc")}</b>${wg(nm(n, "loc"))} <b>다른 유닛</b>인 멤버는?`,
        lyricist: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} <b>작사</b>한 타이틀곡은?`,
        unit: (n) => `<b>${nm(n, "loc")}</b>, 어느 <b>유닛(팀)</b>일까요?`,
      },
      qyt: { song: "이 뮤직비디오, 어떤 <b>솔로곡</b>일까요?", year: "이 솔로곡, 언제 나왔을까요?" },
      note: {
        notInAlbum: "살짝 힌트! 나머지 셋은 이 앨범에 담긴 곡이에요.",
        lyricist: "살짝 힌트! 세븐틴은 멤버가 직접 작사에 참여해요.",
        unitSong: "살짝 힌트! 유닛곡은 앨범 안에 숨어 있어요.",
        laterAlbum: "살짝 힌트! 나머지 셋은 이 앨범보다 먼저 나왔어요.",
        timeline: "살짝 힌트! 왼쪽이 먼저 나온 앨범이에요.",
        memberNot: "살짝 힌트! 유닛곡은 그 유닛 멤버만 불러요.",
        roster: "살짝 힌트! 보컬·힙합·퍼포먼스 유닛으로 나뉘어요.",
        mlyric: "살짝 힌트! 나머지 셋은 이 멤버가 작사에 참여하지 않았어요.",
        yt: "살짝 힌트! 멤버 솔로 유튜브 뮤직비디오예요.",
      },
      feedback: { correct: "딩동댕, 맞았어요! 🎉", wrong: "앗, 아쉬워요 🥲", over: "여기까지예요! 수고했어요 🫠" },
      rank: { saved: "랭킹에 올렸어요! 🏆", empty: "아직 기록이 없어요 · 1등의 주인공이 되어봐요" },
      next: { result: "결과 보러 가기", more: "다음 문제 →" },
      caption: { loaded: "© 저작권자 · Apple Music", error: "자켓을 못 불러왔어요 · 상상해서 맞혀봐요", noArt: "자켓을 못 불러왔어요 · 인터넷을 확인해 주세요" },
      difficulty: { 1: { label: "쉬움", stars: "★" }, 2: { label: "보통", stars: "★★" }, 3: { label: "어려움", stars: "★★★" }, 4: { label: "최상", stars: "★★★★" } },
      hudMode: { normal: "🎲 일반", endless: "♾️ 무한", timeattack: "⏱️ 타임어택", review: "🧪 검수" },
      review: { title: "🧪 검수 모드", sub: (n) => `신규 문제 ${n}개 · 테스트베드 전용`, empty: "검수할 신규 문제가 없어요" },
      trivia: {
        "lyricist__album_al1": "사실 '울고 싶지 않아'는 우지·버논·호시·정한 4명이 함께 썼어요!",
        "titleTrack__album_fml": "FML은 '손오공(Super)'과 'F*ck My Life' 더블 타이틀곡이에요.",
      },
      shareMode: { normal: "일반", endless: "무한", timeattack: "타임어택" },
      season: { beta: "오픈베타", firstChamp: "시즌 첫 챔피언", month: (m) => `${m}월`, quarter: (q) => `${q}분기`,
        champ: (nm) => `${nm} 1위`, endsIn: (d) => `종료 D-${d}`, final: (d) => `⏰ 마지막 ${d}일! 순위 굳히기`,
        countdown: (t) => `⏰ 종료까지 ${t}`,
        endTitle: (name) => `🏁 ${name} 시즌 종료!`, endIntro: "각 분야 1위를 발표합니다 🎉",
        endNone: "기록 없음", endClose: "닫기", endCta: "이번 시즌 도전하기",
        tabMonth: "이번 달", tabQuarter: "분기 누적" },
      diffChip: { easy: "쉬움", normal: "보통", hard: "어려움", label: "난이도 골라 바로 시작" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 찐 캐럿, 인정!" : pct >= 70 ? "💎 진성 캐럿이네요" : pct >= 40 ? "🌱 입덕 준비 완료" : "👀 이제 입덕각이에요"),
        count: (n) => (n >= 20 ? "🏆 찐 캐럿, 인정!" : n >= 12 ? "💎 진성 캐럿이네요" : n >= 6 ? "🌱 입덕 준비 완료" : "👀 이제 입덕각이에요"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> 점</span>`,
        endless: (n) => `${n}<span class="score-max"> 연속</span>`,
        time: (n) => `${n}<span class="score-max"> 개</span>`,
      },
      resLine: { normal: (s) => `${s}점`, endless: (n) => `${n}연속 정답`, time: (n) => `${n}개 정답` },
      resSub: {
        normal: (total, hits, pct) => `${total}문제 중 ${hits}개 맞혔어요 · 정답률 ${pct}%`,
        endless: (hits) => `무한 모드 · ${hits}문제 연속으로 맞혔어요`,
        time: (sec, hits) => `타임어택 ${sec}초 · ${hits}개 맞혔어요`,
      },
      share: {
        title: "SEVENTEEN 앨범 자켓 퀴즈",
        tags: "#SEVENTEEN #세븐틴 #CARAT #캐럿 #앨범자켓퀴즈",
        tweet: (tier, line) => `나 세븐틴 앨범 자켓 퀴즈에서 ${tier} 나왔어요!\n${line}\n너도 한번 해볼래?\n#SEVENTEEN #세븐틴 #CARAT #캐럿 #앨범자켓퀴즈`,
        native: (tier, line) => `SEVENTEEN 앨범 자켓 퀴즈 결과\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #CARAT #캐럿 #앨범자켓퀴즈`,
        saved: "이미지를 저장했어요 🖼️",
        fallback: "이미지를 저장했어요! SNS 앱에서 올려주세요 😊",
        insta: "이미지를 저장했어요! 인스타 스토리·피드에 올려주세요 📷",
        kakao: "이미지를 저장했어요! 카카오톡에 올려주세요 💬",
        copied: "링크·태그를 복사했어요! 붙여넣기만 하면 돼요 📋",
      },
      ui: {
        tagline: "앨범 자켓·멤버 사진·유튜브 MV까지 — 세븐틴, 얼마나 알아요? 진짜 캐럿인지 지금 가려봐요.",
        rule1: "자켓·멤버·MV 썸네일 보고 <b>앨범·연도·타이틀곡·멤버곡</b>까지 맞혀요",
        rule2: "매번 <b>랜덤</b> 출제 · 문제마다 <b>난이도(쉬움~최상)</b>를 미리 알려줘요",
        rule3: "다 풀면 <b>캐럿 등급</b> · 이름 걸고 <b>랭킹</b>·명예의 전당에 도전 😎",
        modeNormalT: "🎲 가볍게 한 판", modeNormalS: "랜덤 20문제 · 속도·난이도·콤보 점수",
        modeEndlessT: "♾️ 무한 모드", modeEndlessS: "한 번 틀리면 끝! 어디까지 가볼까요?",
        modeTimeT: "⏱️ 타임어택", modeTimeS: "60초 스피드런 · 봐주는 기회 3번",
        resultHeading: "자, 결과 나왔어요",
        rankPlaceholder: "이름 정하고 랭킹에 새기기",
        rankBtn: "등록",
        shareBtn: "📤 공유하기", restartBtn: "한 판 더!", homeBtn: "처음으로",
        saveBtn: "이미지 저장", tweetBtn: "트위터", instaBtn: "인스타", kakaoBtn: "카카오톡",
        shareHint: "‘공유하기’ 한 번이면 결과 이미지가 인스타·카톡·트위터로 쏙 (모바일).",
        footer: "팬메이드 비영리 데모 · 앨범 자켓 이미지의 저작권은 각 저작권자(플레디스 등)에게 있으며, 식별 목적으로 Apple Music CDN에서 로드합니다.",
        themeTitle: "라이트/다크 전환",
        langLabel: "언어",
        hallTitle: "🏆 명예의 전당",
        hallHint: "칸을 탭하면 전체 순위를 크게 봐요",
        reportTitle: "🐞 오류 제보하기",
        reportDesc: "이 문제, 뭐가 이상한가요? 알려주시면 바로 확인할게요.",
        reportPlaceholder: "예: 정답이 실제와 달라요 / 이미지가 안 떠요",
        reportSubmit: "제보 보내기", reportCancel: "닫기",
        reportThanks: "제보 감사합니다! 교차검증 후 반영할게요 🙌",
        reportCtxLabel: "지금 문제", reportFabTitle: "오류 제보",
        reportFab: "오류 제보", reportResultLink: "🐞 문제에 오류가 있었나요? 제보하기",
        quitTitle: "나가기", quitConfirm: "지금 나가면 이 판 기록이 사라져요. 처음으로 돌아갈까요?",
        annTitle: "🎉 업데이트 소식", annIntro: "더 재밌게 즐기시라고 몇 가지 바뀌었어요!",
        annItem1: "⚡ 새 점수 방식(속도·난이도·콤보) — 🏆 시즌2 랭킹 새로 오픈!",
        annItem2: "🏠 게임 중 언제든 나가기 버튼 추가",
        annItem3: "🐞 문제에 오류가 있으면 바로 제보하기",
        annCta: "지금 한 판 해보기", annClose: "나중에",
        legacyShow: "🕐 지난 시즌 기록 보기", legacyHide: "↩︎ 현재 시즌으로",
      },
    },

    en: {
      _unit: U.en,
      atype: {
        "미니 앨범": "Mini Album", "정규 앨범": "Studio Album", "스페셜 앨범": "Special Album",
        "유닛 싱글": "Unit Single", "믹스테이프": "Mixtape", "디지털 싱글": "Digital Single",
        "베스트 앨범": "Best Album", "리패키지": "Repackage",
        num: (kind, n) => {
          const s = ["th", "st", "nd", "rd"], v = n % 100;
          return `${n}${s[(v - 20) % 10] || s[v] || s[0]} ${kind === "미니" ? "Mini Album" : "Studio Album"}`;
        },
      },
      q: {
        album: "Which album is this cover?",
        albumCrop: "🔍 Zoomed-in cover — which album?",
        year: "When did this album come out?",
        track: "What was the title track?",
        notInAlbum: "Which one is <b>NOT</b> on this album?",
        lyricist: (track) => `Who helped write ‘${track}’?`,
        unitSong: (u) => `Which song did the <b>${U.en[u] || u} unit</b> sing on this album?`,
        albumType: "What type of release is this?",
        albumNumber: "Which numbered album is this?",
        laterAlbum: "Which one came out <b>later</b> than this album?",
        timeline: "Correct order from <b>earliest</b> release?",
      },
      qm: {
        unitSong: (n) => `Which <b>unit song</b> did <b>${nm(n, "en")}</b> sing?`,
        notSong: (n) => `Which song did <b>${nm(n, "en")}</b> <b>NOT</b> sing?`,
        roster: (n) => `Who is in a <b>different unit</b> from <b>${nm(n, "en")}</b>?`,
        lyricist: (n) => `Which title track did <b>${nm(n, "en")}</b> help <b>write</b>?`,
        unit: (n) => `Which <b>unit (team)</b> is <b>${nm(n, "en")}</b> in?`,
      },
      qyt: { song: "Which <b>solo song</b> is this music video?", year: "When did this solo song come out?" },
      note: {
        notInAlbum: "Hint! The other three are on this album.",
        lyricist: "Hint! SEVENTEEN members write their own songs.",
        unitSong: "Hint! The unit song is hidden on the album.",
        laterAlbum: "Hint! The other three came out earlier.",
        timeline: "Hint! Left = released earlier.",
        memberNot: "Hint! A unit song is sung only by that unit.",
        roster: "Hint! They split into Vocal, Hip-hop and Performance units.",
        mlyric: "Hint! The other three weren't written by this member.",
        yt: "Hint! It's a member's solo music video on YouTube.",
      },
      feedback: { correct: "Ding ding — correct! 🎉", wrong: "Aw, so close 🥲", over: "That's a wrap! Nicely done 🫠" },
      rank: { saved: "Added to the leaderboard! 🏆", empty: "No scores yet · be the first!" },
      next: { result: "See results", more: "Next question →" },
      caption: { loaded: "© rights holder · Apple Music", error: "Couldn't load the cover · guess from memory", noArt: "Couldn't load the cover · check your connection" },
      difficulty: { 1: { label: "Easy", stars: "★" }, 2: { label: "Normal", stars: "★★" }, 3: { label: "Hard", stars: "★★★" }, 4: { label: "Expert", stars: "★★★★" } },
      hudMode: { normal: "🎲 Normal", endless: "♾️ Endless", timeattack: "⏱️ Time Attack", review: "🧪 Review" },
      review: { title: "🧪 Review mode", sub: (n) => `${n} new items · testbed only`, empty: "No new items to review" },
      trivia: {
        "lyricist__album_al1": "Actually 'Don't Wanna Cry' was co-written by Woozi, Vernon, Hoshi & Jeonghan!",
        "titleTrack__album_fml": "FML has double title tracks: 'Super' and 'F*ck My Life'.",
      },
      shareMode: { normal: "Normal", endless: "Endless", timeattack: "Time Attack" },
      season: { beta: "Open Beta", firstChamp: "First Champion",
        month: (m) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1],
        quarter: (q) => `Q${q}`, champ: (nm) => `${nm} #1`,
        endsIn: (d) => `ends in ${d}d`, final: (d) => `⏰ Final ${d} days! Lock your rank`,
        countdown: (t) => `⏰ Ends in ${t}`,
        endTitle: (name) => `🏁 ${name} season closed!`, endIntro: "Announcing the #1 of each mode 🎉",
        endNone: "No records", endClose: "Close", endCta: "Play this season",
        tabMonth: "This month", tabQuarter: "Quarter" },
      diffChip: { easy: "Easy", normal: "Normal", hard: "Hard", label: "Pick a difficulty & play" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 Certified CARAT!" : pct >= 70 ? "💎 True CARAT" : pct >= 40 ? "🌱 Getting hooked" : "👀 On the way in"),
        count: (n) => (n >= 20 ? "🏆 Certified CARAT!" : n >= 12 ? "💎 True CARAT" : n >= 6 ? "🌱 Getting hooked" : "👀 On the way in"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> pts</span>`,
        endless: (n) => `${n}<span class="score-max"> in a row</span>`,
        time: (n) => `${n}<span class="score-max"> correct</span>`,
      },
      resLine: { normal: (s) => `${s} pts`, endless: (n) => `${n} in a row`, time: (n) => `${n} correct` },
      resSub: {
        normal: (total, hits, pct) => `${hits} of ${total} correct · ${pct}% accuracy`,
        endless: (hits) => `Endless · ${hits} correct in a row`,
        time: (sec, hits) => `Time Attack ${sec}s · ${hits} correct`,
      },
      share: {
        title: "SEVENTEEN Album Cover Quiz",
        tags: "#SEVENTEEN #세븐틴 #CARAT #AlbumCoverQuiz",
        tweet: (tier, line) => `I got ${tier} on the SEVENTEEN Album Cover Quiz!\n${line}\nThink you can beat me?\n#SEVENTEEN #세븐틴 #CARAT #AlbumCoverQuiz`,
        native: (tier, line) => `SEVENTEEN Album Cover Quiz result\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #CARAT #AlbumCoverQuiz`,
        saved: "Image saved 🖼️",
        fallback: "Image saved! Post it from your favorite app 😊",
        insta: "Image saved! Post it to your Instagram story or feed 📷",
        kakao: "Image saved! Share it on KakaoTalk 💬",
        copied: "Link & tags copied! Just paste them 📋",
      },
      ui: {
        tagline: "Album covers, member photos, even YouTube MVs — how well do you know SEVENTEEN? Prove you're a real CARAT.",
        rule1: "From covers, members & MV thumbnails, name the <b>album, year, title track & member songs</b>",
        rule2: "Always <b>random</b> · every question shows its <b>difficulty (Easy–Expert)</b> up front",
        rule3: "Finish for your <b>CARAT tier</b> · put your name on the <b>leaderboard</b> & Hall of Fame 😎",
        modeNormalT: "🎲 Quick Round", modeNormalS: "20 random · speed·difficulty·combo score",
        modeEndlessT: "♾️ Endless", modeEndlessS: "One miss and it's over. How far can you go?",
        modeTimeT: "⏱️ Time Attack", modeTimeS: "60-sec speedrun · 3 free passes",
        resultHeading: "And… here's your result",
        rankPlaceholder: "Pick a name, claim your spot",
        rankBtn: "Add",
        shareBtn: "📤 Share", restartBtn: "One more!", homeBtn: "Home",
        saveBtn: "Save image", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "One tap on ‘Share’ drops your result straight into Instagram, KakaoTalk or Twitter (mobile).",
        footer: "Fan-made non-commercial demo · Album cover copyrights belong to their owners (Pledis, etc.); loaded from the Apple Music CDN for identification.",
        themeTitle: "Light/Dark",
        langLabel: "Language",
        hallTitle: "🏆 Hall of Fame",
        hallHint: "Tap a column for the full ranking",
        reportTitle: "🐞 Report an issue",
        reportDesc: "Something wrong with this question? Tell us and we'll check.",
        reportPlaceholder: "e.g. the answer is wrong / image won't load",
        reportSubmit: "Send report", reportCancel: "Close",
        reportThanks: "Thanks! We'll verify and fix it 🙌",
        reportCtxLabel: "This question", reportFabTitle: "Report an issue",
        reportFab: "Report", reportResultLink: "🐞 Spotted a wrong answer? Report it",
        quitTitle: "Quit", quitConfirm: "Leave now and this run's progress is lost. Go back home?",
        annTitle: "🎉 What's new", annIntro: "A few things changed to make it more fun!",
        annItem1: "⚡ New scoring (speed·difficulty·combo) — 🏆 Season 2 leaderboard is live!",
        annItem2: "🏠 Quit button added — leave mid-game anytime",
        annItem3: "🐞 Spotted a wrong answer? Report it instantly",
        annCta: "Play a round now", annClose: "Later",
        legacyShow: "🕐 View last season", legacyHide: "↩︎ Back to this season",
      },
    },

    ja: {
      _unit: U.ja,
      atype: {
        "미니 앨범": "ミニアルバム", "정규 앨범": "正規アルバム", "스페셜 앨범": "スペシャルアルバム",
        "유닛 싱글": "ユニットシングル", "믹스테이프": "ミックステープ", "디지털 싱글": "デジタルシングル",
        "베스트 앨범": "ベストアルバム", "리패키지": "リパッケージ",
        num: (kind, n) => `第${n}${kind === "미니" ? "ミニアルバム" : "正規アルバム"}`,
      },
      q: {
        album: "このジャケット、どのアルバム？",
        albumCrop: "🔍 拡大ジャケット、どのアルバム？",
        year: "いつ出たアルバム？",
        track: "タイトル曲は何だっけ？",
        notInAlbum: "この中でこのアルバムに<b>入っていない</b>曲は？",
        lyricist: (track) => `‘${track}’ の作詞に参加したメンバーは？`,
        unitSong: (u) => `このアルバムで<b>${U.ja[u] || u}ユニット</b>が歌った曲は？`,
        albumType: "このアルバム、どのタイプ？",
        albumNumber: "このアルバム、第何弾？",
        laterAlbum: "このアルバムより<b>あとに</b>出たのは？",
        timeline: "<b>発売が早い順</b>に正しい並びは？",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "en")}</b>が歌った<b>ユニット曲</b>は？`,
        notSong: (n) => `<b>${nm(n, "en")}</b>が<b>歌っていない</b>曲は？`,
        roster: (n) => `<b>${nm(n, "en")}</b>と<b>別ユニット</b>のメンバーは？`,
        lyricist: (n) => `<b>${nm(n, "en")}</b>が<b>作詞</b>したタイトル曲は？`,
        unit: (n) => `<b>${nm(n, "en")}</b>はどの<b>ユニット(チーム)</b>？`,
      },
      qyt: { song: "このMV、どの<b>ソロ曲</b>？", year: "このソロ曲、いつ出た？" },
      note: {
        notInAlbum: "ヒント！ 残りの3つはこのアルバム収録曲です。",
        lyricist: "ヒント！ SEVENTEENはメンバー自ら作詞に参加します。",
        unitSong: "ヒント！ ユニット曲はアルバムの中に隠れています。",
        laterAlbum: "ヒント！ 残りの3つはこれより前に出ました。",
        timeline: "ヒント！ 左が先に出たアルバムです。",
        memberNot: "ヒント！ ユニット曲はそのユニットのメンバーだけが歌います。",
        roster: "ヒント！ ボーカル・ヒップホップ・パフォーマンスに分かれます。",
        mlyric: "ヒント！ 残りの3つはこのメンバーが作詞していません。",
        yt: "ヒント！ メンバーのソロYouTube MVです。",
      },
      feedback: { correct: "ピンポン、正解！ 🎉", wrong: "あぁ、惜しい 🥲", over: "ここまで！ お疲れさま 🫠" },
      rank: { saved: "ランキングに登録しました！ 🏆", empty: "まだ記録がありません · 1位を目指そう" },
      next: { result: "結果を見る", more: "次の問題 →" },
      caption: { loaded: "© 権利者 · Apple Music", error: "ジャケットを読み込めませんでした · 想像で当ててね", noArt: "ジャケットを読み込めませんでした · 通信環境を確認してね" },
      difficulty: { 1: { label: "やさしい", stars: "★" }, 2: { label: "ふつう", stars: "★★" }, 3: { label: "むずかしい", stars: "★★★" }, 4: { label: "最上級", stars: "★★★★" } },
      hudMode: { normal: "🎲 通常", endless: "♾️ 無限", timeattack: "⏱️ タイムアタック", review: "🧪 検収" },
      review: { title: "🧪 検収モード", sub: (n) => `新規 ${n}問 · テストベッド専用`, empty: "検収する新規問題がありません" },
      trivia: {
        "lyricist__album_al1": "実は「Don't Wanna Cry」はウジ・バーノン・ホシ・ジョンハンの4人共作！",
        "titleTrack__album_fml": "FMLは「Super(孫悟空)」と「F*ck My Life」のダブルタイトル曲。",
      },
      shareMode: { normal: "通常", endless: "無限", timeattack: "タイムアタック" },
      season: { beta: "オープンβ", firstChamp: "初代チャンピオン", month: (m) => `${m}月`, quarter: (q) => `Q${q}`,
        champ: (nm) => `${nm} 1位`, endsIn: (d) => `終了 D-${d}`, final: (d) => `⏰ ラスト${d}日！ 順位を固めろ`,
        countdown: (t) => `⏰ 終了まで ${t}`,
        endTitle: (name) => `🏁 ${name} シーズン終了！`, endIntro: "各モードの1位を発表 🎉",
        endNone: "記録なし", endClose: "閉じる", endCta: "今シーズンに挑戦",
        tabMonth: "今月", tabQuarter: "四半期" },
      diffChip: { easy: "やさしい", normal: "普通", hard: "むずかしい", label: "難易度を選んで開始" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 本物のCARAT！" : pct >= 70 ? "💎 ガチCARAT" : pct >= 40 ? "🌱 沼入り間近" : "👀 沼への入口"),
        count: (n) => (n >= 20 ? "🏆 本物のCARAT！" : n >= 12 ? "💎 ガチCARAT" : n >= 6 ? "🌱 沼入り間近" : "👀 沼への入口"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> 点</span>`,
        endless: (n) => `${n}<span class="score-max"> 連続</span>`,
        time: (n) => `${n}<span class="score-max"> 問</span>`,
      },
      resLine: { normal: (s) => `${s}点`, endless: (n) => `${n}問連続`, time: (n) => `${n}問正解` },
      resSub: {
        normal: (total, hits, pct) => `${total}問中 ${hits}問正解 · 正答率 ${pct}%`,
        endless: (hits) => `無限モード · ${hits}問連続正解`,
        time: (sec, hits) => `タイムアタック ${sec}秒 · ${hits}問正解`,
      },
      share: {
        title: "SEVENTEEN アルバムジャケットクイズ",
        tags: "#SEVENTEEN #세븐틴 #CARAT #アルバムクイズ",
        tweet: (tier, line) => `SEVENTEENのジャケットクイズで${tier}だった！\n${line}\n君も挑戦してみて？\n#SEVENTEEN #세븐틴 #CARAT #アルバムクイズ`,
        native: (tier, line) => `SEVENTEEN アルバムジャケットクイズ結果\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #CARAT #アルバムクイズ`,
        saved: "画像を保存しました 🖼️",
        fallback: "画像を保存しました！ アプリから投稿してね 😊",
        insta: "画像を保存しました！ インスタのストーリーやフィードに投稿してね 📷",
        kakao: "画像を保存しました！ カカオトークで共有してね 💬",
        copied: "リンク·タグをコピーしました！ 貼り付けるだけ 📋",
      },
      ui: {
        tagline: "ジャケット・メンバー写真・YouTube MVまで — SEVENTEEN、どれだけ知ってる？ 本物のCARATか今チェック。",
        rule1: "ジャケット・メンバー・MVサムネで<b>アルバム・年・タイトル曲・メンバー曲</b>まで当てる",
        rule2: "毎回<b>ランダム</b>出題 · 各問の<b>難易度（やさしい〜最上級）</b>を先に表示",
        rule3: "解き切ると<b>CARAT等級</b> · 名前を懸けて<b>ランキング</b>・殿堂に挑戦 😎",
        modeNormalT: "🎲 サクッと一戦", modeNormalS: "ランダム20問 · スピード·難易度·コンボ点",
        modeEndlessT: "♾️ 無限モード", modeEndlessS: "1問ミスで終了！ どこまでいける？",
        modeTimeT: "⏱️ タイムアタック", modeTimeS: "60秒スピードラン · 見逃し3回",
        resultHeading: "さあ、結果です",
        rankPlaceholder: "名前を決めてランキングに刻む",
        rankBtn: "登録",
        shareBtn: "📤 シェア", restartBtn: "もう一戦！", homeBtn: "最初へ",
        saveBtn: "画像保存", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "カカオトーク",
        shareHint: "「シェア」を押すだけで結果画像がインスタ・カカオ・Twitterへ（モバイル）。",
        footer: "ファンメイド非営利デモ · アルバムジャケット画像の著作権は各権利者（PLEDISなど）にあり、識別目的でApple Music CDNから読み込みます。",
        themeTitle: "ライト/ダーク切替",
        langLabel: "言語",
        hallTitle: "🏆 殿堂",
        hallHint: "列をタップで全順位を大きく表示",
        reportTitle: "🐞 不具合を報告",
        reportDesc: "この問題、何かおかしいですか？ 教えてください、確認します。",
        reportPlaceholder: "例: 正解が実際と違う / 画像が出ない",
        reportSubmit: "報告する", reportCancel: "閉じる",
        reportThanks: "ありがとうございます！ 確認して直します 🙌",
        reportCtxLabel: "この問題", reportFabTitle: "不具合を報告",
        reportFab: "不具合報告", reportResultLink: "🐞 問題に間違いが？ 報告する",
        quitTitle: "終了", quitConfirm: "今抜けると今回の記録が消えます。最初に戻りますか？",
        annTitle: "🎉 アップデート情報", annIntro: "もっと楽しめるよういくつか変わりました！",
        annItem1: "⚡ 新スコア(速さ・難易度・コンボ) — 🏆 シーズン2ランキング開始！",
        annItem2: "🏠 プレイ中に抜けられる終了ボタンを追加",
        annItem3: "🐞 問題の間違いはその場で報告",
        annCta: "今すぐ一戦", annClose: "あとで",
        legacyShow: "🕐 前シーズンを見る", legacyHide: "↩︎ 今シーズンへ",
      },
    },

    zh: {
      _unit: U.zh,
      atype: {
        "미니 앨범": "迷你专辑", "정규 앨범": "正规专辑", "스페셜 앨범": "特别专辑",
        "유닛 싱글": "小分队单曲", "믹스테이프": "Mixtape", "디지털 싱글": "数字单曲",
        "베스트 앨범": "精选专辑", "리패키지": "改版专辑",
        num: (kind, n) => `${kind === "미니" ? "迷你" : "正规"}${n}辑`,
      },
      q: {
        album: "这张封面是哪张专辑？",
        albumCrop: "🔍 放大的封面是哪张专辑？",
        year: "这张专辑是哪一年发行的？",
        track: "主打歌是哪首来着？",
        notInAlbum: "以下<b>不属于</b>这张专辑的是？",
        lyricist: (track) => `参与创作《${track}》歌词的成员是谁？`,
        unitSong: (u) => `这张专辑里<b>${U.zh[u] || u}小分队</b>演唱的歌曲是？`,
        albumType: "这张专辑属于什么类型？",
        albumNumber: "这是第几张专辑？",
        laterAlbum: "哪张比这张专辑<b>更晚</b>发行？",
        timeline: "按<b>发行先后</b>正确排列的是？",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "en")}</b>演唱的<b>小分队歌曲</b>是？`,
        notSong: (n) => `<b>${nm(n, "en")}</b><b>没有</b>演唱的歌曲是？`,
        roster: (n) => `谁和<b>${nm(n, "en")}</b>在<b>不同小分队</b>？`,
        lyricist: (n) => `<b>${nm(n, "en")}</b>参与<b>作词</b>的主打歌是？`,
        unit: (n) => `<b>${nm(n, "en")}</b>属于哪个<b>小组(队)</b>？`,
      },
      qyt: { song: "这支MV是哪首<b>solo曲</b>？", year: "这首solo曲哪年发行？" },
      note: {
        notInAlbum: "小提示！ 其余三首都收录在这张专辑里。",
        lyricist: "小提示！ SEVENTEEN 成员会亲自参与作词。",
        unitSong: "小提示！ 小分队歌曲就藏在专辑里。",
        laterAlbum: "小提示！ 其余三张都比它更早发行。",
        timeline: "小提示！ 左边是更早发行的专辑。",
        memberNot: "小提示！ 小分队歌曲只由该小分队成员演唱。",
        roster: "小提示！ 分为声乐、嘻哈、表演三个小分队。",
        mlyric: "小提示！ 其余三首这位成员没有参与作词。",
        yt: "小提示！ 这是成员的solo YouTube MV。",
      },
      feedback: { correct: "叮咚，答对了！ 🎉", wrong: "啊，差一点 🥲", over: "到此为止！ 辛苦啦 🫠" },
      rank: { saved: "已加入排行榜！ 🏆", empty: "还没有记录 · 来当第一名吧" },
      next: { result: "查看结果", more: "下一题 →" },
      caption: { loaded: "© 版权方 · Apple Music", error: "封面加载失败 · 凭印象猜猜看", noArt: "封面加载失败 · 请检查网络" },
      difficulty: { 1: { label: "简单", stars: "★" }, 2: { label: "普通", stars: "★★" }, 3: { label: "困难", stars: "★★★" }, 4: { label: "顶级", stars: "★★★★" } },
      hudMode: { normal: "🎲 普通", endless: "♾️ 无限", timeattack: "⏱️ 限时", review: "🧪 审核" },
      review: { title: "🧪 审核模式", sub: (n) => `${n} 道新题 · 仅测试台`, empty: "暂无待审核的新题" },
      trivia: {
        "lyricist__album_al1": "其实《Don't Wanna Cry》由 Woozi·Vernon·Hoshi·Jeonghan 四人共同作词！",
        "titleTrack__album_fml": "FML 是《Super(孙悟空)》与《F*ck My Life》双主打。",
      },
      shareMode: { normal: "普通", endless: "无限", timeattack: "限时" },
      season: { beta: "公测", firstChamp: "首季冠军", month: (m) => `${m}月`, quarter: (q) => `第${q}季度`,
        champ: (nm) => `${nm}冠军`, endsIn: (d) => `距结束 ${d}天`, final: (d) => `⏰ 最后${d}天！ 锁定排名`,
        countdown: (t) => `⏰ 距结束 ${t}`,
        endTitle: (name) => `🏁 ${name} 赛季结束！`, endIntro: "公布各模式第一名 🎉",
        endNone: "暂无记录", endClose: "关闭", endCta: "挑战本赛季",
        tabMonth: "本月", tabQuarter: "本季度" },
      diffChip: { easy: "简单", normal: "普通", hard: "困难", label: "选难度直接开始" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 认证CARAT！" : pct >= 70 ? "💎 真·CARAT" : pct >= 40 ? "🌱 即将入坑" : "👀 入坑在即"),
        count: (n) => (n >= 20 ? "🏆 认证CARAT！" : n >= 12 ? "💎 真·CARAT" : n >= 6 ? "🌱 即将入坑" : "👀 入坑在即"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> 分</span>`,
        endless: (n) => `${n}<span class="score-max"> 连续</span>`,
        time: (n) => `${n}<span class="score-max"> 题</span>`,
      },
      resLine: { normal: (s) => `${s}分`, endless: (n) => `连续${n}题`, time: (n) => `答对${n}题` },
      resSub: {
        normal: (total, hits, pct) => `${total}题中答对 ${hits}题 · 正确率 ${pct}%`,
        endless: (hits) => `无限模式 · 连续答对 ${hits}题`,
        time: (sec, hits) => `限时 ${sec}秒 · 答对 ${hits}题`,
      },
      share: {
        title: "SEVENTEEN 专辑封面测验",
        tags: "#SEVENTEEN #세븐틴 #CARAT #专辑封面测验",
        tweet: (tier, line) => `我在 SEVENTEEN 专辑封面测验里拿到了${tier}！\n${line}\n你也来挑战一下？\n#SEVENTEEN #세븐틴 #CARAT #专辑封面测验`,
        native: (tier, line) => `SEVENTEEN 专辑封面测验结果\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #CARAT #专辑封面测验`,
        saved: "已保存图片 🖼️",
        fallback: "已保存图片！ 在你喜欢的应用里发出来吧 😊",
        insta: "已保存图片！ 发到 Instagram 故事或动态吧 📷",
        kakao: "已保存图片！ 在 KakaoTalk 分享吧 💬",
        copied: "已复制链接和标签！ 粘贴即可 📋",
      },
      ui: {
        tagline: "专辑封面·成员照片·YouTube MV — 你有多懂SEVENTEEN？ 是不是真CARAT，现在见分晓。",
        rule1: "看封面·成员·MV缩略图，猜<b>专辑·年份·主打歌·成员歌曲</b>",
        rule2: "每次<b>随机</b>出题 · 每题<b>难度（简单~顶级）</b>提前告诉你",
        rule3: "答完拿<b>CARAT等级</b> · 用名字冲<b>排行榜</b>和名人堂 😎",
        modeNormalT: "🎲 轻松一局", modeNormalS: "随机20题 · 速度·难度·连击计分",
        modeEndlessT: "♾️ 无限模式", modeEndlessS: "错一题就结束！ 能走多远？",
        modeTimeT: "⏱️ 限时挑战", modeTimeS: "60秒速通 · 3次容错",
        resultHeading: "来，结果出炉",
        rankPlaceholder: "取个名字，刻上排行榜",
        rankBtn: "登记",
        shareBtn: "📤 分享", restartBtn: "再来一局！", homeBtn: "回首页",
        saveBtn: "保存图片", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "点一下「分享」，结果图直接进 Instagram·KakaoTalk·Twitter（移动端）。",
        footer: "粉丝制作非商业演示 · 专辑封面版权归各版权方（PLEDIS 等）所有，仅为识别用途从 Apple Music CDN 加载。",
        themeTitle: "浅色/深色切换",
        langLabel: "语言",
        hallTitle: "🏆 名人堂",
        hallHint: "点按某列查看完整排名",
        reportTitle: "🐞 报告问题",
        reportDesc: "这道题有什么问题吗？ 告诉我们，马上核查。",
        reportPlaceholder: "例如：答案不对 / 图片加载不出来",
        reportSubmit: "提交报告", reportCancel: "关闭",
        reportThanks: "谢谢！ 我们会核实并修正 🙌",
        reportCtxLabel: "当前题目", reportFabTitle: "报告问题",
        reportFab: "报告问题", reportResultLink: "🐞 发现错误了吗？ 报告一下",
        quitTitle: "退出", quitConfirm: "现在退出会丢失本局记录。要回到首页吗？",
        annTitle: "🎉 更新公告", annIntro: "为了更好玩，做了一些调整！",
        annItem1: "⚡ 全新计分(速度·难度·连击) — 🏆 第2赛季排行榜开启！",
        annItem2: "🏠 新增退出按钮，游戏中随时可回首页",
        annItem3: "🐞 发现错误？ 立即报告",
        annCta: "立即玩一局", annClose: "以后再说",
        legacyShow: "🕐 查看上赛季", legacyHide: "↩︎ 返回本赛季",
      },
    },

    es: {
      _unit: U.es,
      atype: {
        "미니 앨범": "Mini Álbum", "정규 앨범": "Álbum de Estudio", "스페셜 앨범": "Álbum Especial",
        "유닛 싱글": "Single de Unit", "믹스테이프": "Mixtape", "디지털 싱글": "Single Digital",
        "베스트 앨범": "Álbum Recopilatorio", "리패키지": "Reedición",
        num: (kind, n) => `${n}º ${kind === "미니" ? "Mini Álbum" : "Álbum"}`,
      },
      q: {
        album: "Esta portada, ¿de qué álbum es?",
        albumCrop: "🔍 Portada ampliada, ¿qué álbum es?",
        year: "¿Cuándo salió este álbum?",
        track: "¿Cuál era la canción principal?",
        notInAlbum: "¿Cuál <b>NO</b> está en este álbum?",
        lyricist: (track) => `¿Qué miembro ayudó a escribir ‘${track}’?`,
        unitSong: (u) => `¿Qué canción cantó la <b>unit de ${U.es[u] || u}</b> en este álbum?`,
        albumType: "¿Qué tipo de lanzamiento es este?",
        albumNumber: "¿Qué número de álbum es este?",
        laterAlbum: "¿Cuál salió <b>después</b> de este álbum?",
        timeline: "¿Orden correcto del <b>más antiguo</b>?",
      },
      qm: {
        unitSong: (n) => `¿Qué <b>canción de unit</b> cantó <b>${nm(n, "en")}</b>?`,
        notSong: (n) => `¿Qué canción <b>NO</b> cantó <b>${nm(n, "en")}</b>?`,
        roster: (n) => `¿Quién está en una <b>unit distinta</b> a <b>${nm(n, "en")}</b>?`,
        lyricist: (n) => `¿Qué canción principal ayudó a <b>escribir</b> <b>${nm(n, "en")}</b>?`,
        unit: (n) => `¿En qué <b>unidad (equipo)</b> está <b>${nm(n, "en")}</b>?`,
      },
      qyt: { song: "¿De qué <b>canción solista</b> es este videoclip?", year: "¿Cuándo salió esta canción solista?" },
      note: {
        notInAlbum: "¡Pista! Las otras tres sí están en este álbum.",
        lyricist: "¡Pista! Los miembros de SEVENTEEN escriben sus propias canciones.",
        unitSong: "¡Pista! La canción de unit está escondida en el álbum.",
        laterAlbum: "¡Pista! Las otras tres salieron antes.",
        timeline: "¡Pista! Izquierda = salió antes.",
        memberNot: "¡Pista! Una canción de unit solo la canta esa unit.",
        roster: "¡Pista! Se dividen en units de Vocal, Hip-hop y Performance.",
        mlyric: "¡Pista! Las otras tres no las escribió este miembro.",
        yt: "¡Pista! Es el videoclip solista de un miembro en YouTube.",
      },
      feedback: { correct: "¡Din din, correcto! 🎉", wrong: "Ay, casi 🥲", over: "¡Hasta aquí! Bien hecho 🫠" },
      rank: { saved: "¡Añadido a la clasificación! 🏆", empty: "Aún no hay marcas · ¡sé el primero!" },
      next: { result: "Ver resultados", more: "Siguiente →" },
      caption: { loaded: "© titular de derechos · Apple Music", error: "No se pudo cargar la portada · adivina de memoria", noArt: "No se pudo cargar la portada · revisa tu conexión" },
      difficulty: { 1: { label: "Fácil", stars: "★" }, 2: { label: "Normal", stars: "★★" }, 3: { label: "Difícil", stars: "★★★" }, 4: { label: "Experto", stars: "★★★★" } },
      hudMode: { normal: "🎲 Normal", endless: "♾️ Infinito", timeattack: "⏱️ Contrarreloj", review: "🧪 Revisión" },
      review: { title: "🧪 Modo revisión", sub: (n) => `${n} ítems nuevos · solo testbed`, empty: "No hay ítems nuevos para revisar" },
      trivia: {
        "lyricist__album_al1": "¡'Don't Wanna Cry' la coescribieron Woozi, Vernon, Hoshi y Jeonghan!",
        "titleTrack__album_fml": "FML tiene doble sencillo: 'Super' y 'F*ck My Life'.",
      },
      shareMode: { normal: "Normal", endless: "Infinito", timeattack: "Contrarreloj" },
      season: { beta: "Beta abierta", firstChamp: "Primer campeón",
        month: (m) => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1],
        quarter: (q) => `T${q}`, champ: (nm) => `${nm} #1`,
        endsIn: (d) => `termina en ${d}d`, final: (d) => `⏰ ¡Últimos ${d} días! Asegura tu puesto`,
        countdown: (t) => `⏰ Termina en ${t}`,
        endTitle: (name) => `🏁 ¡Temporada ${name} cerrada!`, endIntro: "Presentamos al #1 de cada modo 🎉",
        endNone: "Sin registros", endClose: "Cerrar", endCta: "Jugar esta temporada",
        tabMonth: "Este mes", tabQuarter: "Trimestre" },
      diffChip: { easy: "Fácil", normal: "Normal", hard: "Difícil", label: "Elige dificultad y juega" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 ¡CARAT de verdad!" : pct >= 70 ? "💎 CARAT auténtico" : pct >= 40 ? "🌱 Cayendo en el pozo" : "👀 A punto de caer"),
        count: (n) => (n >= 20 ? "🏆 ¡CARAT de verdad!" : n >= 12 ? "💎 CARAT auténtico" : n >= 6 ? "🌱 Cayendo en el pozo" : "👀 A punto de caer"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> pts</span>`,
        endless: (n) => `${n}<span class="score-max"> seguidas</span>`,
        time: (n) => `${n}<span class="score-max"> correctas</span>`,
      },
      resLine: { normal: (s) => `${s} pts`, endless: (n) => `${n} seguidas`, time: (n) => `${n} correctas` },
      resSub: {
        normal: (total, hits, pct) => `${hits} de ${total} correctas · ${pct}% de acierto`,
        endless: (hits) => `Infinito · ${hits} seguidas`,
        time: (sec, hits) => `Contrarreloj ${sec}s · ${hits} correctas`,
      },
      share: {
        title: "SEVENTEEN Quiz de Portadas",
        tags: "#SEVENTEEN #세븐틴 #CARAT #QuizDePortadas",
        tweet: (tier, line) => `¡Saqué ${tier} en el Quiz de Portadas de SEVENTEEN!\n${line}\n¿Puedes superarme?\n#SEVENTEEN #세븐틴 #CARAT #QuizDePortadas`,
        native: (tier, line) => `Resultado del Quiz de Portadas de SEVENTEEN\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #CARAT #QuizDePortadas`,
        saved: "Imagen guardada 🖼️",
        fallback: "¡Imagen guardada! Publícala desde tu app favorita 😊",
        insta: "¡Imagen guardada! Súbela a tu historia o feed de Instagram 📷",
        kakao: "¡Imagen guardada! Compártela en KakaoTalk 💬",
        copied: "¡Enlace y etiquetas copiados! Solo pégalos 📋",
      },
      ui: {
        tagline: "Portadas, fotos de miembros y hasta MVs de YouTube — ¿cuánto sabes de SEVENTEEN? Demuestra que eres un CARAT de verdad.",
        rule1: "Con portadas, miembros y miniaturas de MV, acierta <b>álbum, año, canción principal y canciones de miembros</b>",
        rule2: "Siempre <b>aleatorio</b> · cada pregunta muestra su <b>dificultad (Fácil–Experto)</b> por adelantado",
        rule3: "Termina por tu <b>nivel CARAT</b> · pon tu nombre en la <b>clasificación</b> y el Salón de la fama 😎",
        modeNormalT: "🎲 Partida rápida", modeNormalS: "20 al azar · puntos por velocidad·dificultad·combo",
        modeEndlessT: "♾️ Modo infinito", modeEndlessS: "¡Un fallo y se acabó! ¿Hasta dónde llegas?",
        modeTimeT: "⏱️ Contrarreloj", modeTimeS: "Speedrun de 60s · 3 vidas",
        resultHeading: "Y… aquí está tu resultado",
        rankPlaceholder: "Elige un nombre y reclama tu puesto",
        rankBtn: "Añadir",
        shareBtn: "📤 Compartir", restartBtn: "¡Otra vez!", homeBtn: "Inicio",
        saveBtn: "Guardar imagen", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "Un toque en ‘Compartir’ y tu resultado va directo a Instagram, KakaoTalk o Twitter (móvil).",
        footer: "Demo sin fines de lucro hecha por fans · Los derechos de las portadas pertenecen a sus dueños (Pledis, etc.); se cargan desde el CDN de Apple Music con fines de identificación.",
        themeTitle: "Claro/Oscuro",
        langLabel: "Idioma",
        hallTitle: "🏆 Salón de la fama",
        hallHint: "Toca una columna para ver el ranking completo",
        reportTitle: "🐞 Reportar un error",
        reportDesc: "¿Algo va mal con esta pregunta? Cuéntanos y lo revisamos.",
        reportPlaceholder: "ej: la respuesta es incorrecta / no carga la imagen",
        reportSubmit: "Enviar reporte", reportCancel: "Cerrar",
        reportThanks: "¡Gracias! Lo verificamos y lo corregimos 🙌",
        reportCtxLabel: "Esta pregunta", reportFabTitle: "Reportar un error",
        reportFab: "Reportar", reportResultLink: "🐞 ¿Viste un error? Repórtalo",
        quitTitle: "Salir", quitConfirm: "Si sales ahora perderás el progreso de esta partida. ¿Volver al inicio?",
        annTitle: "🎉 Novedades", annIntro: "¡Cambiamos algunas cosas para que sea más divertido!",
        annItem1: "⚡ Nueva puntuación (velocidad·dificultad·combo) — 🏆 ¡Temporada 2 en marcha!",
        annItem2: "🏠 Botón para salir en cualquier momento de la partida",
        annItem3: "🐞 ¿Viste un error? Repórtalo al instante",
        annCta: "Jugar una ronda", annClose: "Luego",
        legacyShow: "🕐 Ver temporada anterior", legacyHide: "↩︎ Volver a esta temporada",
      },
    },
  };

  const SUPPORTED = ["ko", "en", "ja", "zh", "es"];
  const LANG_NAMES = { ko: "한국어", en: "English", ja: "日本語", zh: "中文", es: "Español" };

  // 국가 코드 → 로케일(감지 보조). 없으면 언어태그로 폴백.
  const COUNTRY_LOCALE = {
    KR: "ko",
    JP: "ja",
    CN: "zh", TW: "zh", HK: "zh", MO: "zh", SG: "zh",
    ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
  };

  // 언어 태그(navigator.language 등) → 지원 로케일
  function localeFromLang(tag) {
    if (!tag) return null;
    const s = String(tag).toLowerCase();
    if (s.startsWith("ko")) return "ko";
    if (s.startsWith("ja")) return "ja";
    if (s.startsWith("zh")) return "zh";
    if (s.startsWith("es")) return "es";
    if (s.startsWith("en")) return "en";
    return null;
  }
  function localeFromCountry(cc) {
    if (!cc) return null;
    return COUNTRY_LOCALE[String(cc).toUpperCase()] || null;
  }

  // ── 병기 렌더 헬퍼 ──
  const MAIN = (s) => `<span class="i18n-main">${s}</span>`;
  const SUB = (s) => `<span class="i18n-sub">${s}</span>`;
  // 병기 제외(단일언어) 상위 키: 평문/캔버스/컴팩트 칩 등에서 쓰임
  // (tier·resSub 는 화면에 병기, resScore/resLine 은 숫자 위주라 단일언어 유지)
  const PLAIN_KEYS = { _unit: 1, atype: 1, difficulty: 1, hudMode: 1, shareMode: 1, share: 1, resScore: 1, resLine: 1, season: 1, diffChip: 1, review: 1, trivia: 1 };

  function biStr(loc, en, bi) { return bi && en != null && en !== loc ? MAIN(loc) + SUB(en) : loc; }
  function biFn(locFn, enFn, bi) {
    if (!bi || typeof enFn !== "function") return function () { return locFn.apply(null, arguments); };
    return function () { return MAIN(locFn.apply(null, arguments)) + SUB(enFn.apply(null, arguments)); };
  }
  function mergeNode(locNode, enNode, bi) {
    const out = {};
    for (const k of Object.keys(locNode)) {
      const lv = locNode[k], ev = enNode ? enNode[k] : undefined;
      if (typeof lv === "function") out[k] = biFn(lv, ev, bi);
      else if (lv && typeof lv === "object") out[k] = mergeNode(lv, ev || {}, bi);
      else out[k] = biStr(lv, ev, bi);
    }
    return out;
  }
  function build(code, bilingual) {
    const loc = LOCALES[code] || LOCALES.en;
    const en = LOCALES.en;
    const bi = bilingual !== false && code !== "en";
    const t = {};
    for (const k of Object.keys(loc)) {
      if (PLAIN_KEYS[k]) { t[k] = loc[k]; continue; } // 평문(단일언어) 유지
      t[k] = mergeNode(loc[k], en[k] || {}, bi);
    }
    return t;
  }

  // ── 공개 API(안정 참조 t 를 in-place 갱신) ──
  const api = {
    t: {},
    locale: "en",
    bilingual: false, // 현재 병기(영문 보조) 표시 여부
    SUPPORTED,
    LANG_NAMES,
    raw: (code) => LOCALES[code] || LOCALES.en,
    // 앨범 유형("미니 5집"·"정규 앨범" 등)을 현재 로케일로 표기. 매핑 없으면(ko 등) 원문 유지.
    localizeType(str) {
      if (str == null) return str;
      const A = (LOCALES[api.locale] || {}).atype;
      if (!A) return str;
      const m = /^\s*(미니|정규)\s*(\d+)\s*집\s*$/.exec(str);
      if (m) return A.num ? A.num(m[1], parseInt(m[2], 10)) : str;
      return A[str] != null ? A[str] : str;
    },
    localeFromLang,
    localeFromCountry,
    _cbs: [],
    onChange(cb) { if (typeof cb === "function") api._cbs.push(cb); },
    // bilingual=false 면 해당 언어 단독 표기(영문 병기 없음).
    // 기본(자동 감지)은 병기, 사용자가 언어를 직접 고르면 단독으로 호출한다.
    setLocale(code, bilingual) {
      if (!LOCALES[code]) code = "en";
      const built = build(code, bilingual);
      for (const k in api.t) delete api.t[k];
      Object.assign(api.t, built);
      api.locale = code;
      api.bilingual = bilingual !== false && code !== "en";
      api._cbs.forEach((cb) => { try { cb(code); } catch (e) {} });
      return code;
    },
  };

  // 초기 로케일: (브라우저) navigator.language → 기본 ko / (노드) ko
  let initial = "ko";
  try {
    if (root && root.navigator) {
      const langs = root.navigator.languages || [root.navigator.language];
      for (const l of langs) { const m = localeFromLang(l); if (m) { initial = m; break; } }
    }
  } catch (e) {}
  api.setLocale(initial);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.I18N = api;
})(typeof window !== "undefined" ? window : null);
