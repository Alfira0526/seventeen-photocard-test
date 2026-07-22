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
        year: "언제 나온 앨범일까요?",
        track: "타이틀곡, 뭐였죠?",
        notInAlbum: "이 중에 이 앨범 수록곡이 <b>아닌</b> 건?",
        lyricist: (track) => `‘${track}’ 작사에 참여한 멤버는 누구일까요?`,
        unitSong: (u) => `이 앨범에서 <b>${U.ko[u] || u} 유닛</b>이 부른 곡, 뭘까요?`,
        albumType: "이 앨범, 어떤 유형일까요?",
        albumNumber: "이 앨범, 몇 집일까요?",
        laterAlbum: "이 앨범보다 <b>나중에</b> 나온 건?",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} 부른 <b>유닛곡</b>은?`,
        notSong: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} 부르지 <b>않은</b> 곡은?`,
        roster: (n) => `<b>${nm(n, "loc")}</b>${wg(nm(n, "loc"))} <b>다른 유닛</b>인 멤버는?`,
        lyricist: (n) => `<b>${nm(n, "loc")}</b>${ig(nm(n, "loc"))} <b>작사</b>한 타이틀곡은?`,
      },
      qyt: { song: "이 뮤직비디오, 어떤 <b>솔로곡</b>일까요?", year: "이 솔로곡, 언제 나왔을까요?" },
      note: {
        notInAlbum: "살짝 힌트! 나머지 셋은 이 앨범에 담긴 곡이에요.",
        lyricist: "살짝 힌트! 세븐틴은 멤버가 직접 작사에 참여해요.",
        unitSong: "살짝 힌트! 유닛곡은 앨범 안에 숨어 있어요.",
        laterAlbum: "살짝 힌트! 나머지 셋은 이 앨범보다 먼저 나왔어요.",
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
      hudMode: { normal: "🎲 일반", endless: "♾️ 무한", timeattack: "⏱️ 타임어택" },
      shareMode: { normal: "일반", endless: "무한", timeattack: "타임어택" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 찐 캐럿, 인정!" : pct >= 70 ? "💎 진성 캐럿이네요" : pct >= 40 ? "🌱 입덕 준비 완료" : "👀 이제 입덕각이에요"),
        count: (n) => (n >= 20 ? "🏆 찐 캐럿, 인정!" : n >= 12 ? "💎 진성 캐럿이네요" : n >= 6 ? "🌱 입덕 준비 완료" : "👀 이제 입덕각이에요"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> / 100점</span>`,
        endless: (n) => `${n}<span class="score-max"> 연속</span>`,
        time: (n) => `${n}<span class="score-max"> 개</span>`,
      },
      resLine: { normal: (s) => `${s} / 100점`, endless: (n) => `${n}연속 정답`, time: (n) => `${n}개 정답` },
      resSub: {
        normal: (total, hits, pct) => `${total}문제 중 ${hits}개 맞혔어요 · 정답률 ${pct}%`,
        endless: (hits) => `무한 모드 · ${hits}문제 연속으로 맞혔어요`,
        time: (sec, hits) => `타임어택 ${sec}초 · ${hits}개 맞혔어요`,
      },
      share: {
        title: "SEVENTEEN 앨범 자켓 퀴즈",
        tweet: (tier, line) => `나 세븐틴 앨범 자켓 퀴즈에서 ${tier} 나왔어요!\n${line}\n너도 한번 해볼래?\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
        native: (tier, line) => `SEVENTEEN 앨범 자켓 퀴즈 결과\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #앨범자켓퀴즈`,
        saved: "이미지를 저장했어요 🖼️",
        fallback: "이미지를 저장했어요! SNS 앱에서 올려주세요 😊",
        insta: "이미지를 저장했어요! 인스타 스토리·피드에 올려주세요 📷",
        kakao: "이미지를 저장했어요! 카카오톡에 올려주세요 💬",
      },
      ui: {
        tagline: "자켓만 보고 <b>앨범 · 연도 · 타이틀곡</b>까지, 다 맞힐 수 있어요?",
        rule1: "한 문제씩, 총 <b>20문제</b>를 풀어요",
        rule2: "문제마다 <b>난이도(쉬움~최상)</b>가 표시돼요",
        rule3: "다 풀면 <b>캐럿 등급</b>이 나와요 · 결과는 자랑해도 좋아요 😎",
        modeNormalT: "🎲 그냥 한 판", modeNormalS: "랜덤 20문제 · 100점 만점",
        modeEndlessT: "♾️ 무한 모드", modeEndlessS: "틀리면 끝! 몇 개까지 갈까요?",
        modeTimeT: "⏱️ 타임어택", modeTimeS: "60초 안에 최대한 · 목숨 3개",
        resultHeading: "오늘의 결과예요",
        rankPlaceholder: "이름을 정해 랭킹에 올려요",
        rankBtn: "등록",
        shareBtn: "📤 공유하기", restartBtn: "한 판 더!",
        saveBtn: "이미지 저장", tweetBtn: "트위터", instaBtn: "인스타", kakaoBtn: "카카오톡",
        shareHint: "‘공유하기’를 누르면 결과 이미지를 인스타·카톡·트위터 어디든 바로 올릴 수 있어요 (모바일).",
        footer: "팬메이드 비영리 데모 · 앨범 자켓 이미지의 저작권은 각 저작권자(플레디스 등)에게 있으며, 식별 목적으로 Apple Music CDN에서 로드합니다.",
        themeTitle: "라이트/다크 전환",
        langLabel: "언어",
      },
    },

    en: {
      _unit: U.en,
      q: {
        album: "Which album is this cover?",
        year: "When did this album come out?",
        track: "What was the title track?",
        notInAlbum: "Which one is <b>NOT</b> on this album?",
        lyricist: (track) => `Who helped write ‘${track}’?`,
        unitSong: (u) => `Which song did the <b>${U.en[u] || u} unit</b> sing on this album?`,
        albumType: "What type of release is this?",
        albumNumber: "Which numbered album is this?",
        laterAlbum: "Which one came out <b>later</b> than this album?",
      },
      qm: {
        unitSong: (n) => `Which <b>unit song</b> did <b>${nm(n, "en")}</b> sing?`,
        notSong: (n) => `Which song did <b>${nm(n, "en")}</b> <b>NOT</b> sing?`,
        roster: (n) => `Who is in a <b>different unit</b> from <b>${nm(n, "en")}</b>?`,
        lyricist: (n) => `Which title track did <b>${nm(n, "en")}</b> help <b>write</b>?`,
      },
      qyt: { song: "Which <b>solo song</b> is this music video?", year: "When did this solo song come out?" },
      note: {
        notInAlbum: "Hint! The other three are on this album.",
        lyricist: "Hint! SEVENTEEN members write their own songs.",
        unitSong: "Hint! The unit song is hidden on the album.",
        laterAlbum: "Hint! The other three came out earlier.",
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
      hudMode: { normal: "🎲 Normal", endless: "♾️ Endless", timeattack: "⏱️ Time Attack" },
      shareMode: { normal: "Normal", endless: "Endless", timeattack: "Time Attack" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 Certified CARAT!" : pct >= 70 ? "💎 True CARAT" : pct >= 40 ? "🌱 Getting hooked" : "👀 On the way in"),
        count: (n) => (n >= 20 ? "🏆 Certified CARAT!" : n >= 12 ? "💎 True CARAT" : n >= 6 ? "🌱 Getting hooked" : "👀 On the way in"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> / 100</span>`,
        endless: (n) => `${n}<span class="score-max"> in a row</span>`,
        time: (n) => `${n}<span class="score-max"> correct</span>`,
      },
      resLine: { normal: (s) => `${s} / 100`, endless: (n) => `${n} in a row`, time: (n) => `${n} correct` },
      resSub: {
        normal: (total, hits, pct) => `${hits} of ${total} correct · ${pct}% accuracy`,
        endless: (hits) => `Endless · ${hits} correct in a row`,
        time: (sec, hits) => `Time Attack ${sec}s · ${hits} correct`,
      },
      share: {
        title: "SEVENTEEN Album Cover Quiz",
        tweet: (tier, line) => `I got ${tier} on the SEVENTEEN Album Cover Quiz!\n${line}\nThink you can beat me?\n#SEVENTEEN #세븐틴 #AlbumCoverQuiz`,
        native: (tier, line) => `SEVENTEEN Album Cover Quiz result\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #AlbumCoverQuiz`,
        saved: "Image saved 🖼️",
        fallback: "Image saved! Post it from your favorite app 😊",
        insta: "Image saved! Post it to your Instagram story or feed 📷",
        kakao: "Image saved! Share it on KakaoTalk 💬",
      },
      ui: {
        tagline: "Just the cover — <b>album · year · title track</b>. Can you get them all?",
        rule1: "You'll answer <b>20 questions</b>, one at a time",
        rule2: "Each question shows a <b>difficulty (Easy–Expert)</b>",
        rule3: "Finish to earn your <b>CARAT tier</b> · feel free to flex 😎",
        modeNormalT: "🎲 One Round", modeNormalS: "Random 20 · out of 100",
        modeEndlessT: "♾️ Endless", modeEndlessS: "One miss and it's over. How far can you go?",
        modeTimeT: "⏱️ Time Attack", modeTimeS: "As many as you can in 60s · 3 lives",
        resultHeading: "Here's your result",
        rankPlaceholder: "Pick a name for the leaderboard",
        rankBtn: "Add",
        shareBtn: "📤 Share", restartBtn: "One more!",
        saveBtn: "Save image", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "Tap ‘Share’ to post your result image straight to Instagram, KakaoTalk or Twitter — anywhere (mobile).",
        footer: "Fan-made non-commercial demo · Album cover copyrights belong to their owners (Pledis, etc.); loaded from the Apple Music CDN for identification.",
        themeTitle: "Light/Dark",
        langLabel: "Language",
      },
    },

    ja: {
      _unit: U.ja,
      q: {
        album: "このジャケット、どのアルバム？",
        year: "いつ出たアルバム？",
        track: "タイトル曲は何だっけ？",
        notInAlbum: "この中でこのアルバムに<b>入っていない</b>曲は？",
        lyricist: (track) => `‘${track}’ の作詞に参加したメンバーは？`,
        unitSong: (u) => `このアルバムで<b>${U.ja[u] || u}ユニット</b>が歌った曲は？`,
        albumType: "このアルバム、どのタイプ？",
        albumNumber: "このアルバム、第何弾？",
        laterAlbum: "このアルバムより<b>あとに</b>出たのは？",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "en")}</b>が歌った<b>ユニット曲</b>は？`,
        notSong: (n) => `<b>${nm(n, "en")}</b>が<b>歌っていない</b>曲は？`,
        roster: (n) => `<b>${nm(n, "en")}</b>と<b>別ユニット</b>のメンバーは？`,
        lyricist: (n) => `<b>${nm(n, "en")}</b>が<b>作詞</b>したタイトル曲は？`,
      },
      qyt: { song: "このMV、どの<b>ソロ曲</b>？", year: "このソロ曲、いつ出た？" },
      note: {
        notInAlbum: "ヒント！ 残りの3つはこのアルバム収録曲です。",
        lyricist: "ヒント！ SEVENTEENはメンバー自ら作詞に参加します。",
        unitSong: "ヒント！ ユニット曲はアルバムの中に隠れています。",
        laterAlbum: "ヒント！ 残りの3つはこれより前に出ました。",
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
      hudMode: { normal: "🎲 通常", endless: "♾️ 無限", timeattack: "⏱️ タイムアタック" },
      shareMode: { normal: "通常", endless: "無限", timeattack: "タイムアタック" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 本物のCARAT！" : pct >= 70 ? "💎 ガチCARAT" : pct >= 40 ? "🌱 沼入り間近" : "👀 沼への入口"),
        count: (n) => (n >= 20 ? "🏆 本物のCARAT！" : n >= 12 ? "💎 ガチCARAT" : n >= 6 ? "🌱 沼入り間近" : "👀 沼への入口"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> / 100点</span>`,
        endless: (n) => `${n}<span class="score-max"> 連続</span>`,
        time: (n) => `${n}<span class="score-max"> 問</span>`,
      },
      resLine: { normal: (s) => `${s} / 100点`, endless: (n) => `${n}問連続`, time: (n) => `${n}問正解` },
      resSub: {
        normal: (total, hits, pct) => `${total}問中 ${hits}問正解 · 正答率 ${pct}%`,
        endless: (hits) => `無限モード · ${hits}問連続正解`,
        time: (sec, hits) => `タイムアタック ${sec}秒 · ${hits}問正解`,
      },
      share: {
        title: "SEVENTEEN アルバムジャケットクイズ",
        tweet: (tier, line) => `SEVENTEENのジャケットクイズで${tier}だった！\n${line}\n君も挑戦してみて？\n#SEVENTEEN #세븐틴 #アルバムクイズ`,
        native: (tier, line) => `SEVENTEEN アルバムジャケットクイズ結果\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #アルバムクイズ`,
        saved: "画像を保存しました 🖼️",
        fallback: "画像を保存しました！ アプリから投稿してね 😊",
        insta: "画像を保存しました！ インスタのストーリーやフィードに投稿してね 📷",
        kakao: "画像を保存しました！ カカオトークで共有してね 💬",
      },
      ui: {
        tagline: "ジャケットだけで<b>アルバム・年・タイトル曲</b>まで、全部当てられる？",
        rule1: "1問ずつ、全<b>20問</b>を解きます",
        rule2: "問題ごとに<b>難易度（やさしい〜最上級）</b>が表示されます",
        rule3: "解き切ると<b>CARAT等級</b>が出ます · 結果は自慢してOK 😎",
        modeNormalT: "🎲 ふつうに一戦", modeNormalS: "ランダム20問 · 100点満点",
        modeEndlessT: "♾️ 無限モード", modeEndlessS: "間違えたら終わり！ どこまでいける？",
        modeTimeT: "⏱️ タイムアタック", modeTimeS: "60秒でできるだけ · ライフ3個",
        resultHeading: "今回の結果です",
        rankPlaceholder: "名前を決めてランキングに登録",
        rankBtn: "登録",
        shareBtn: "📤 シェア", restartBtn: "もう一戦！",
        saveBtn: "画像保存", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "カカオトーク",
        shareHint: "「シェア」を押すと結果画像をインスタ・カカオ・Twitterどこへでもすぐ投稿できます（モバイル）。",
        footer: "ファンメイド非営利デモ · アルバムジャケット画像の著作権は各権利者（PLEDISなど）にあり、識別目的でApple Music CDNから読み込みます。",
        themeTitle: "ライト/ダーク切替",
        langLabel: "言語",
      },
    },

    zh: {
      _unit: U.zh,
      q: {
        album: "这张封面是哪张专辑？",
        year: "这张专辑是哪一年发行的？",
        track: "主打歌是哪首来着？",
        notInAlbum: "以下<b>不属于</b>这张专辑的是？",
        lyricist: (track) => `参与创作《${track}》歌词的成员是谁？`,
        unitSong: (u) => `这张专辑里<b>${U.zh[u] || u}小分队</b>演唱的歌曲是？`,
        albumType: "这张专辑属于什么类型？",
        albumNumber: "这是第几张专辑？",
        laterAlbum: "哪张比这张专辑<b>更晚</b>发行？",
      },
      qm: {
        unitSong: (n) => `<b>${nm(n, "en")}</b>演唱的<b>小分队歌曲</b>是？`,
        notSong: (n) => `<b>${nm(n, "en")}</b><b>没有</b>演唱的歌曲是？`,
        roster: (n) => `谁和<b>${nm(n, "en")}</b>在<b>不同小分队</b>？`,
        lyricist: (n) => `<b>${nm(n, "en")}</b>参与<b>作词</b>的主打歌是？`,
      },
      qyt: { song: "这支MV是哪首<b>solo曲</b>？", year: "这首solo曲哪年发行？" },
      note: {
        notInAlbum: "小提示！ 其余三首都收录在这张专辑里。",
        lyricist: "小提示！ SEVENTEEN 成员会亲自参与作词。",
        unitSong: "小提示！ 小分队歌曲就藏在专辑里。",
        laterAlbum: "小提示！ 其余三张都比它更早发行。",
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
      hudMode: { normal: "🎲 普通", endless: "♾️ 无限", timeattack: "⏱️ 限时" },
      shareMode: { normal: "普通", endless: "无限", timeattack: "限时" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 认证CARAT！" : pct >= 70 ? "💎 真·CARAT" : pct >= 40 ? "🌱 即将入坑" : "👀 入坑在即"),
        count: (n) => (n >= 20 ? "🏆 认证CARAT！" : n >= 12 ? "💎 真·CARAT" : n >= 6 ? "🌱 即将入坑" : "👀 入坑在即"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> / 100分</span>`,
        endless: (n) => `${n}<span class="score-max"> 连续</span>`,
        time: (n) => `${n}<span class="score-max"> 题</span>`,
      },
      resLine: { normal: (s) => `${s} / 100分`, endless: (n) => `连续${n}题`, time: (n) => `答对${n}题` },
      resSub: {
        normal: (total, hits, pct) => `${total}题中答对 ${hits}题 · 正确率 ${pct}%`,
        endless: (hits) => `无限模式 · 连续答对 ${hits}题`,
        time: (sec, hits) => `限时 ${sec}秒 · 答对 ${hits}题`,
      },
      share: {
        title: "SEVENTEEN 专辑封面测验",
        tweet: (tier, line) => `我在 SEVENTEEN 专辑封面测验里拿到了${tier}！\n${line}\n你也来挑战一下？\n#SEVENTEEN #세븐틴 #专辑封面测验`,
        native: (tier, line) => `SEVENTEEN 专辑封面测验结果\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #专辑封面测验`,
        saved: "已保存图片 🖼️",
        fallback: "已保存图片！ 在你喜欢的应用里发出来吧 😊",
        insta: "已保存图片！ 发到 Instagram 故事或动态吧 📷",
        kakao: "已保存图片！ 在 KakaoTalk 分享吧 💬",
      },
      ui: {
        tagline: "只看封面，就能把<b>专辑 · 年份 · 主打歌</b>全部答对吗？",
        rule1: "每次一题，共<b>20题</b>",
        rule2: "每题都会标注<b>难度（简单~顶级）</b>",
        rule3: "全部答完会给出<b>CARAT 等级</b> · 结果尽管炫耀 😎",
        modeNormalT: "🎲 随便玩一局", modeNormalS: "随机20题 · 满分100",
        modeEndlessT: "♾️ 无限模式", modeEndlessS: "答错就结束！ 能走多远？",
        modeTimeT: "⏱️ 限时挑战", modeTimeS: "60秒内尽量多 · 3条命",
        resultHeading: "这是你的结果",
        rankPlaceholder: "取个名字加入排行榜",
        rankBtn: "登记",
        shareBtn: "📤 分享", restartBtn: "再来一局！",
        saveBtn: "保存图片", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "点击「分享」即可把结果图片直接发到 Instagram、KakaoTalk、Twitter 等任意平台（移动端）。",
        footer: "粉丝制作非商业演示 · 专辑封面版权归各版权方（PLEDIS 等）所有，仅为识别用途从 Apple Music CDN 加载。",
        themeTitle: "浅色/深色切换",
        langLabel: "语言",
      },
    },

    es: {
      _unit: U.es,
      q: {
        album: "Esta portada, ¿de qué álbum es?",
        year: "¿Cuándo salió este álbum?",
        track: "¿Cuál era la canción principal?",
        notInAlbum: "¿Cuál <b>NO</b> está en este álbum?",
        lyricist: (track) => `¿Qué miembro ayudó a escribir ‘${track}’?`,
        unitSong: (u) => `¿Qué canción cantó la <b>unit de ${U.es[u] || u}</b> en este álbum?`,
        albumType: "¿Qué tipo de lanzamiento es este?",
        albumNumber: "¿Qué número de álbum es este?",
        laterAlbum: "¿Cuál salió <b>después</b> de este álbum?",
      },
      qm: {
        unitSong: (n) => `¿Qué <b>canción de unit</b> cantó <b>${nm(n, "en")}</b>?`,
        notSong: (n) => `¿Qué canción <b>NO</b> cantó <b>${nm(n, "en")}</b>?`,
        roster: (n) => `¿Quién está en una <b>unit distinta</b> a <b>${nm(n, "en")}</b>?`,
        lyricist: (n) => `¿Qué canción principal ayudó a <b>escribir</b> <b>${nm(n, "en")}</b>?`,
      },
      qyt: { song: "¿De qué <b>canción solista</b> es este videoclip?", year: "¿Cuándo salió esta canción solista?" },
      note: {
        notInAlbum: "¡Pista! Las otras tres sí están en este álbum.",
        lyricist: "¡Pista! Los miembros de SEVENTEEN escriben sus propias canciones.",
        unitSong: "¡Pista! La canción de unit está escondida en el álbum.",
        laterAlbum: "¡Pista! Las otras tres salieron antes.",
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
      hudMode: { normal: "🎲 Normal", endless: "♾️ Infinito", timeattack: "⏱️ Contrarreloj" },
      shareMode: { normal: "Normal", endless: "Infinito", timeattack: "Contrarreloj" },
      tier: {
        normal: (pct) => (pct >= 90 ? "🏆 ¡CARAT de verdad!" : pct >= 70 ? "💎 CARAT auténtico" : pct >= 40 ? "🌱 Cayendo en el pozo" : "👀 A punto de caer"),
        count: (n) => (n >= 20 ? "🏆 ¡CARAT de verdad!" : n >= 12 ? "💎 CARAT auténtico" : n >= 6 ? "🌱 Cayendo en el pozo" : "👀 A punto de caer"),
      },
      resScore: {
        normal: (s) => `${s}<span class="score-max"> / 100</span>`,
        endless: (n) => `${n}<span class="score-max"> seguidas</span>`,
        time: (n) => `${n}<span class="score-max"> correctas</span>`,
      },
      resLine: { normal: (s) => `${s} / 100`, endless: (n) => `${n} seguidas`, time: (n) => `${n} correctas` },
      resSub: {
        normal: (total, hits, pct) => `${hits} de ${total} correctas · ${pct}% de acierto`,
        endless: (hits) => `Infinito · ${hits} seguidas`,
        time: (sec, hits) => `Contrarreloj ${sec}s · ${hits} correctas`,
      },
      share: {
        title: "SEVENTEEN Quiz de Portadas",
        tweet: (tier, line) => `¡Saqué ${tier} en el Quiz de Portadas de SEVENTEEN!\n${line}\n¿Puedes superarme?\n#SEVENTEEN #세븐틴 #QuizDePortadas`,
        native: (tier, line) => `Resultado del Quiz de Portadas de SEVENTEEN\n${tier} · ${line}\n#SEVENTEEN #세븐틴 #QuizDePortadas`,
        saved: "Imagen guardada 🖼️",
        fallback: "¡Imagen guardada! Publícala desde tu app favorita 😊",
        insta: "¡Imagen guardada! Súbela a tu historia o feed de Instagram 📷",
        kakao: "¡Imagen guardada! Compártela en KakaoTalk 💬",
      },
      ui: {
        tagline: "Solo con la portada, ¿puedes acertar <b>álbum · año · canción principal</b>?",
        rule1: "Responderás <b>20 preguntas</b>, una a una",
        rule2: "Cada pregunta muestra una <b>dificultad (Fácil–Experto)</b>",
        rule3: "Al terminar obtienes tu <b>nivel CARAT</b> · presume el resultado 😎",
        modeNormalT: "🎲 Una partida", modeNormalS: "20 al azar · sobre 100",
        modeEndlessT: "♾️ Modo infinito", modeEndlessS: "¡Un fallo y se acabó! ¿Hasta dónde llegas?",
        modeTimeT: "⏱️ Contrarreloj", modeTimeS: "Las que puedas en 60s · 3 vidas",
        resultHeading: "Aquí está tu resultado",
        rankPlaceholder: "Elige un nombre para la clasificación",
        rankBtn: "Añadir",
        shareBtn: "📤 Compartir", restartBtn: "¡Otra vez!",
        saveBtn: "Guardar imagen", tweetBtn: "Twitter", instaBtn: "Instagram", kakaoBtn: "KakaoTalk",
        shareHint: "Toca ‘Compartir’ para publicar tu imagen de resultado en Instagram, KakaoTalk o Twitter — donde quieras (móvil).",
        footer: "Demo sin fines de lucro hecha por fans · Los derechos de las portadas pertenecen a sus dueños (Pledis, etc.); se cargan desde el CDN de Apple Music con fines de identificación.",
        themeTitle: "Claro/Oscuro",
        langLabel: "Idioma",
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
  const PLAIN_KEYS = { _unit: 1, difficulty: 1, hudMode: 1, shareMode: 1, share: 1, resScore: 1, resLine: 1 };

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
