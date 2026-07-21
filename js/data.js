/**
 * SEVENTEEN Album-Jacket Quiz — 데이터 모델
 *
 * 앨범 자켓(커버)을 보고 ① 앨범 ② 발매연도 ③ 타이틀곡을 맞히는 게임.
 * 자켓엔 특정 멤버가 없으므로 정답 단위는 "앨범"이다.
 *
 * 이미지는 리포에 파일로 담지 않는다(저작권/재배포 회피).
 * 대신 iTunes(Apple) 아트워크 CDN URL을 js/albumArt.js 에 베이크해 두고
 * 런타임에 <img> 로 불러온다.  albumArt.js 는 scripts/fetch-art.mjs 로 생성한다.
 * URL 이 아직 없으면 렌더러가 SVG 플레이스홀더로 대체한다.
 */

// ── 멤버(참고용): 자켓 모드 문제엔 쓰지 않지만 하이브리드 확장 대비로 유지 ──
const MEMBERS = [
  { id: "scoups",    name: "에스쿱스",   unit: "hiphop" },
  { id: "jeonghan",  name: "정한",       unit: "vocal" },
  { id: "joshua",    name: "조슈아",     unit: "vocal" },
  { id: "jun",       name: "준",         unit: "performance" },
  { id: "hoshi",     name: "호시",       unit: "performance" },
  { id: "wonwoo",    name: "원우",       unit: "hiphop" },
  { id: "woozi",     name: "우지",       unit: "vocal" },
  { id: "dk",        name: "도겸",       unit: "vocal" },
  { id: "mingyu",    name: "민규",       unit: "hiphop" },
  { id: "the8",      name: "디에잇",     unit: "performance" },
  { id: "seungkwan", name: "승관",       unit: "vocal" },
  { id: "vernon",    name: "버논",       unit: "hiphop" },
  { id: "dino",      name: "디노",       unit: "performance" },
];

/**
 * 앨범 데이터.
 *  - id        : 내부 식별자 (albumArt.js 키와 매칭)
 *  - title     : 앨범명 (문제 정답)
 *  - year      : 발매연도 (문제 정답)
 *  - type      : 앨범 유형
 *  - titleTrack: 타이틀곡 (문제 정답) — ⚠️ 팬덤 고증 최종 확인 권장
 *  - itunes    : fetch-art.mjs 가 아트워크를 찾을 때 쓰는 검색 힌트
 *
 *  타이틀곡 표기는 "국문 (영문)" 우선, 영문 단독 곡은 영문만.
 */
const ALBUMS = [
  { id: "17carat",       title: "17 CARAT",           year: 2015, type: "미니 1집",  titleTrack: "아낀다 (Adore U)",       itunes: "17 CARAT" },
  { id: "boysbe",        title: "BOYS BE",            year: 2015, type: "미니 2집",  titleTrack: "만세 (Mansae)",          itunes: "BOYS BE" },
  { id: "loveandletter", title: "Love&Letter",        year: 2016, type: "정규 1집",  titleTrack: "예쁘다 (Pretty U)",      itunes: "Love and Letter" },
  { id: "al1",           title: "Al1",                year: 2017, type: "미니 4집",  titleTrack: "울고 싶지 않아 (Don't Wanna Cry)", itunes: "Al1" },
  { id: "teenage",       title: "TEEN, AGE",          year: 2017, type: "정규 2집",  titleTrack: "박수 (CLAP)",            itunes: "TEEN AGE" },
  { id: "youmakemyday",  title: "You Make My Day",    year: 2018, type: "미니 5집",  titleTrack: "어쩌나 (Oh My!)",        itunes: "You Make My Day" },
  { id: "youmademydawn", title: "You Made My Dawn",   year: 2019, type: "미니 6집",  titleTrack: "고맙다 (Home)",          itunes: "You Made My Dawn" },
  { id: "anode",         title: "An Ode",             year: 2019, type: "정규 3집",  titleTrack: "독: Fear",               itunes: "An Ode" },
  { id: "henggarae",     title: "Heng:garæ",          year: 2020, type: "미니 7집",  titleTrack: "좋아 (Left & Right)",    itunes: "Heng garae" },
  { id: "semicolon",     title: "; [Semicolon]",      year: 2020, type: "스페셜 앨범", titleTrack: "HOME;RUN",              itunes: "Semicolon" },
  { id: "yourchoice",    title: "Your Choice",        year: 2021, type: "미니 8집",  titleTrack: "Ready to love",          itunes: "Your Choice" },
  { id: "attacca",       title: "Attacca",            year: 2021, type: "미니 9집",  titleTrack: "Rock with you",          itunes: "Attacca" },
  { id: "facethesun",    title: "Face the Sun",       year: 2022, type: "정규 4집",  titleTrack: "Darl+ing",               itunes: "Face the Sun" },
  { id: "sector17",      title: "SECTOR 17",          year: 2022, type: "리패키지",  titleTrack: "_WORLD",                 itunes: "SECTOR 17" },
  { id: "fml",           title: "FML",                year: 2023, type: "미니 10집", titleTrack: "손오공 (Super)",         itunes: "FML SEVENTEEN" },
  { id: "17thheaven",    title: "SEVENTEENTH HEAVEN", year: 2023, type: "미니 11집", titleTrack: "음악의 신 (God of Music)", itunes: "SEVENTEENTH HEAVEN" },
  { id: "spillthefeels", title: "SPILL THE FEELS",    year: 2024, type: "정규 5집",  titleTrack: "MAESTRO",                itunes: "SPILL THE FEELS" },
];

// ── 아트워크 URL 병합: albumArt.js 가 있으면 window.SVTArt 로 주입됨 ──
// scripts/fetch-art.mjs 실행 전에는 SVTArt 가 없어 art=null → 플레이스홀더.
const ART = (typeof window !== "undefined" && window.SVTArt) || {};
ALBUMS.forEach((a) => {
  a.art = ART[a.id] || null;
});

// ── 조회 헬퍼 ──
const albumById = Object.fromEntries(ALBUMS.map((a) => [a.id, a]));
const ALBUM_YEARS = [...new Set(ALBUMS.map((a) => a.year))].sort((x, y) => x - y);

// ── 로드시 데이터 무결성 검증(개발 편의) : 콘솔에 경고만, 게임은 계속 ──
(function validate() {
  const ids = new Set();
  ALBUMS.forEach((a) => {
    ["id", "title", "titleTrack"].forEach((k) => {
      if (!a[k]) console.warn(`[data] 앨범 ${a.id || "?"} 의 ${k} 누락`);
    });
    if (!Number.isInteger(a.year)) console.warn(`[data] 앨범 ${a.id} year 형식 오류`);
    if (ids.has(a.id)) console.warn(`[data] 앨범 id 중복: ${a.id}`);
    ids.add(a.id);
  });
})();

// 전역 노출
if (typeof window !== "undefined") {
  window.SVTData = { MEMBERS, ALBUMS, albumById, ALBUM_YEARS };
}
// Node(테스트/스크립트)에서 재사용
if (typeof module !== "undefined" && module.exports) {
  module.exports = { MEMBERS, ALBUMS, albumById, ALBUM_YEARS };
}
