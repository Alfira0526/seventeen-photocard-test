/**
 * SEVENTEEN Photocard Quiz — 데이터 모델
 *
 * 게임의 정답 소스는 이 파일 하나로 통일한다.
 * - MEMBERS : 세븐틴 멤버 13명 (정답 후보)
 * - ALBUMS  : 앨범 메타데이터 (제목, 발매년도, 유형)
 * - CARDS   : 실제 포토카드 1장 = { member, album, image }
 *
 * 실제 서비스에서는 CARDS[].image 에 정품 포토카드 스캔 경로를 넣는다.
 * 이미지가 없으면 렌더러가 SVG 플레이스홀더를 자동 생성한다(assets 참고).
 */

// ── 멤버: 유닛/시그니처 컬러까지 포함해 확장 문제(유닛 맞히기)에도 대응 ──
const MEMBERS = [
  { id: "scoups",    name: "에스쿱스",   nameEn: "S.Coups",   unit: "hiphop",   color: "#8E2DE2" },
  { id: "jeonghan",  name: "정한",       nameEn: "Jeonghan",  unit: "vocal",    color: "#4A90D9" },
  { id: "joshua",    name: "조슈아",     nameEn: "Joshua",    unit: "vocal",    color: "#5AC8FA" },
  { id: "jun",       name: "준",         nameEn: "Jun",       unit: "performance", color: "#FF375F" },
  { id: "hoshi",     name: "호시",       nameEn: "Hoshi",     unit: "performance", color: "#FF9500" },
  { id: "wonwoo",    name: "원우",       nameEn: "Wonwoo",    unit: "hiphop",   color: "#34495E" },
  { id: "woozi",     name: "우지",       nameEn: "Woozi",     unit: "vocal",    color: "#AF52DE" },
  { id: "dk",        name: "도겸",       nameEn: "DK",        unit: "vocal",    color: "#FFCC00" },
  { id: "mingyu",    name: "민규",       nameEn: "Mingyu",    unit: "hiphop",   color: "#30D158" },
  { id: "the8",      name: "디에잇",     nameEn: "The8",      unit: "performance", color: "#FF2D55" },
  { id: "seungkwan", name: "승관",       nameEn: "Seungkwan", unit: "vocal",    color: "#FF6482" },
  { id: "vernon",    name: "버논",       nameEn: "Vernon",    unit: "hiphop",   color: "#64D2FF" },
  { id: "dino",      name: "디노",       nameEn: "Dino",      unit: "performance", color: "#0A84FF" },
];

// ── 앨범: id → 메타. year 는 정수(발매년도) ──
const ALBUMS = [
  { id: "17carat",       title: "17 CARAT",            year: 2015, type: "미니 1집" },
  { id: "boysbe",        title: "BOYS BE",             year: 2015, type: "미니 2집" },
  { id: "loveandletter", title: "Love&Letter",         year: 2016, type: "정규 1집" },
  { id: "al1",           title: "Al1",                 year: 2017, type: "미니 4집" },
  { id: "teenage",       title: "TEEN, AGE",           year: 2017, type: "정규 2집" },
  { id: "youmakemyday",  title: "You Make My Day",     year: 2018, type: "미니 5집" },
  { id: "youmademydawn", title: "You Made My Dawn",    year: 2019, type: "미니 6집" },
  { id: "anode",         title: "An Ode",              year: 2019, type: "정규 3집" },
  { id: "henggarae",     title: "Heng:garæ",           year: 2020, type: "미니 7집" },
  { id: "semicolon",     title: "; [Semicolon]",       year: 2020, type: "스페셜 앨범" },
  { id: "yourchoice",    title: "Your Choice",         year: 2021, type: "미니 8집" },
  { id: "attacca",       title: "Attacca",             year: 2021, type: "미니 9집" },
  { id: "facethesun",    title: "Face the Sun",        year: 2022, type: "정규 4집" },
  { id: "sector17",      title: "SECTOR 17",           year: 2022, type: "리패키지" },
  { id: "fml",           title: "FML",                 year: 2023, type: "미니 10집" },
  { id: "17thheaven",    title: "SEVENTEENTH HEAVEN",  year: 2023, type: "미니 11집" },
  { id: "spillthefeels", title: "SPILL THE FEELS",     year: 2024, type: "정규 5집" },
];

// ── 카드: 멤버 × 앨범 조합. image 가 없으면 플레이스홀더로 대체 ──
// 데모용으로 각 앨범당 대표 멤버 몇 명을 배치했다(실제로는 멤버×앨범 전체 확장 가능).
const CARDS = [
  { id: "c001", member: "scoups",    album: "17carat",       image: null },
  { id: "c002", member: "woozi",     album: "17carat",       image: null },
  { id: "c003", member: "hoshi",     album: "boysbe",        image: null },
  { id: "c004", member: "dk",        album: "boysbe",        image: null },
  { id: "c005", member: "jeonghan",  album: "loveandletter", image: null },
  { id: "c006", member: "mingyu",    album: "loveandletter", image: null },
  { id: "c007", member: "vernon",    album: "al1",           image: null },
  { id: "c008", member: "the8",      album: "al1",           image: null },
  { id: "c009", member: "joshua",    album: "teenage",       image: null },
  { id: "c010", member: "dino",      album: "teenage",       image: null },
  { id: "c011", member: "seungkwan", album: "youmakemyday",  image: null },
  { id: "c012", member: "jun",       album: "youmakemyday",  image: null },
  { id: "c013", member: "wonwoo",    album: "youmademydawn", image: null },
  { id: "c014", member: "scoups",    album: "anode",         image: null },
  { id: "c015", member: "woozi",     album: "henggarae",     image: null },
  { id: "c016", member: "hoshi",     album: "semicolon",     image: null },
  { id: "c017", member: "mingyu",    album: "yourchoice",    image: null },
  { id: "c018", member: "dk",        album: "attacca",       image: null },
  { id: "c019", member: "jeonghan",  album: "facethesun",    image: null },
  { id: "c020", member: "vernon",    album: "sector17",      image: null },
  { id: "c021", member: "the8",      album: "fml",           image: null },
  { id: "c022", member: "seungkwan", album: "17thheaven",    image: null },
  { id: "c023", member: "dino",      album: "spillthefeels", image: null },
  { id: "c024", member: "joshua",    album: "fml",           image: null },
];

// ── 조회 헬퍼: id → 객체 ──
const memberById = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));
const albumById = Object.fromEntries(ALBUMS.map((a) => [a.id, a]));

// 발매년도 후보(중복 제거, 정렬) — 연도 문제 보기 생성에 사용
const ALBUM_YEARS = [...new Set(ALBUMS.map((a) => a.year))].sort((a, b) => a - b);

// 다른 모듈(game.js)에서 접근할 수 있도록 전역에 노출
window.SVTData = { MEMBERS, ALBUMS, CARDS, memberById, albumById, ALBUM_YEARS };
