# 작업 진행 관리 (자율 작업 세션)

> 사용자가 8시간 부재. 확인 필요 항목은 맨 아래 **⏳ 사용자 확인 필요**로 미루고,
> 스스로 진행 가능한 것을 순차 처리한다. 각 항목 완료 시 커밋하고 이 파일을 갱신한다.

세션 시작: 2026-07-21 · 브랜치 `claude/game-analysis-improvements-7mccdp`

## 범례
`[ ]` 대기 · `[~]` 진행중 · `[x]` 완료 · `[!]` 보류(사용자 확인)

## 작업 큐 (우선순위순)

### P1 — 재미 + 안정
- [x] **T1. 근접 오답 로직** (A2) — 연도 ±근접, 동시기/동유형 앨범 오답. 로직+테스트
- [x] **T2. 정답/오답 모션 + 점수 카운트업** (C3)
- [x] **T3. 레이아웃 개선: 자켓 확대·밀도** (C5)
- [x] **T4. 라이트/다크 테마 토글** (C6)
- [x] **T5. 이미지 로딩 스켈레톤/블러업** (C7)
- [x] **T6. 웹폰트(Pretendard) 적용** (C2) — CDN+시스템 폴백
- [x] **T7. 결과 공유 카드**(캔버스 PNG 다운로드 + 트위터 인텐트) (A3/C4)

### P2 — 깊이 + 확장
- [x] **T8. 게임 모드: 데일리 챌린지 + 오답 복습** (A5)
- [x] **T9. fetch-art.mjs 수동 오버라이드 맵 + 매칭 로그** (B1)
- [x] **T10. E2E 테스트 리포 정식 편입 + 유닛 테스트 보강** (B5)
- [x] **T11. UI 문자열 분리(i18n-lite)** (B6)

### 보류/판단
- [!] **ESM 전면 이행** (B3) — **보류 결정.** `<script type=module>` 은 `file://`
  직접 열기에서 CORS로 로드 실패 → "index.html 더블클릭" 데모 UX가 깨진다.
  현행 `<script>` 나열 유지. 향후 번들러(Vite 등) 도입 시 함께 이행 권장.

## 진행 로그
- T1: logic.js에 buildYearChoices/buildAlbumChoices(근접 오답) 추가, game 연결, 유닛테스트 13 pass.
- T2~T8: game.js 전면 재작성 — 3모드(일반/데일리 시드결정론/오답복습), 테마 토글(localStorage),
  점수 카운트업, 이미지 스켈레톤+블러업, 캡션, 결과 공유 카드(canvas PNG+트위터 인텐트).
  CSS 라이트/다크 변수화, 자켓 360px 확대, 정답 pop/오답 shake, Pretendard 웹폰트(CDN 폴백),
  prefers-reduced-motion 존중. HUD/토글 겹침 수정.
  검증: E2E(8라운드·시작복귀·공유카드), 데일리 결정론 OK, 오답복습 활성화 OK. 스크린샷 확인.
- T9: fetch-art.mjs에 OVERRIDE 맵(collectionId/URL) + lookup + 미스 후보 로그. 실행은 사용자망 필요.
- T10: tests/e2e.test.mjs(node:test+playwright) 편입, 3 시나리오 pass. package.json test 스크립트 분리
  (기본 test=유닛만, test:e2e/test:all 별도). playwright 미설치 시 자동 skip.
- T11: js/i18n.js로 동적 UI 문자열 중앙화, game.js 전면 참조 교체. 회귀 없음(유닛13+E2E3 pass).

- T12(추가): js/artlive.js — 자켓 실시간 로딩(iTunes JSONP) 폴백. albumArt.js 없어도
  페이지 열면 자동으로 자켓 표시(무설치). 오프라인/차단 시 플레이스홀더. → 초보자용 온라인 배포 경로 확보.
  사용자 선택: **GitHub Pages(온라인으로 바로 보기)** 로 진행 안내.

- 문서 보강: README 전면 재작성(미리보기 스크린샷·문제유형표·모드표·mermaid 흐름도·배포가이드),
  docs/ARCHITECTURE.md(설계·문제엔진·데일리 결정론·테스트전략), docs/DATA_GUIDE.md(데이터 확장·검증절차),
  CHANGELOG.md(v0.1~v0.4). docs/img/에 스크린샷 4종 커밋.

## 최종 검증
- 유닛 13 pass, E2E 3 pass, 문법 체크 OK.
- 스크린샷: 시작(라/다), 플레이(라/다), 결과 — 레이아웃·테마·근접오답·토글 겹침수정 확인.

## 🆕 v0.4 요청 (카드당 1문제 랜덤 + 새 문제 유형)

결정: **카드당 1문제, 유형 랜덤** / **정확도 우선**(검증된 앨범만 새 유형 출제, 점진 확대).

- [x] **Q1. 문제 엔진 재설계** — js/questions.js: 유형 레지스트리 + 가용성(available)+가중 랜덤 선택
- [x] **Q2. 카드당 1문제 UI** — index.html 단일 #question, game.js 단일 문제 렌더/채점(rounds=10, 만점 100)
- [x] **Q3. 새 유형 로직** — notInAlbum/lyricist/unitSong (데이터 있는 앨범만 가용)
- [x] **Q4. 데이터 수집·검증** — 웹서치로 6개 앨범 데이터 추가(정확도 우선 부분 커버리지)
- [x] **Q5. 테스트/문서 갱신** — questions 유닛테스트 6종, e2e 단일문제, README/데이터 주석

진행 완료:
- 엔진: 6유형(album/year/titleTrack/notInAlbum/lyricist/unitSong), 가용성 게이팅 + 가중 랜덤.
- 데이터(웹 검증): 수록곡+유닛 태그 = al1/teenage/anode/henggarae/yourchoice,
  타이틀곡 작사 멤버 = al1(우지·버논·호시·정한)/anode(우지·에스쿱스·버논)/henggarae(우지·버논)/fml(우지·에스쿱스·버논).
  · notInAlbum 가용: 5개 앨범 / unitSong 가용: 3개(al1·teenage·anode) / lyricist 가용: 4개.
  · 유닛곡 예: An Ode 247(퍼포)/Second Life(보컬)/Back It Up(힙합), Al1 Habit(보컬)/If I(힙합)/Swimming Fool(퍼포),
    TEEN,AGE Trauma(힙합)/Lilili Yabbay(퍼포)/Pinwheel(보컬).
- 검증: 유닛 19 pass, e2e 3 pass, 대량 시행(정답 포함·4지선다·중복0)·유형별 사실성 테스트 통과. 스크린샷 확인.
- 커버리지 확대는 tracks/titleLyricists에 앨범 추가만 하면 됨(엔진 자동 반영).

## 🐞 v0.4.1 버그픽스 (사용자 제보)
- 트위터 공유가 작은 팝업으로 떠 로그인이 안 눌리던 문제 → anchor 정상 탭 오픈 + 이미지 자동저장.
- 자켓이 종종 안 뜨던 문제 → 타임아웃↑·재시도·대체검색어·성공만캐시·덱 프리페치·img 재시도.
- 검증: 유닛 19 + E2E 4(트위터 새 탭 테스트 추가) pass.

## ⏳ 사용자 확인 필요 (부재 종료 후)

1. **[필수] 자켓 이미지 실제 로딩** — 이 개발 환경은 프록시 정책상 iTunes/CDN 접근이
   막혀 `js/albumArt.js`를 생성하지 못했습니다. **네트워크 열린 로컬에서 `npm run fetch-art`**
   (= `node scripts/fetch-art.mjs`) 한 번 실행 → 실제 자켓이 채워집니다. 미실행 시 플레이스홀더.
   - 실행 후 매칭이 틀린 앨범이 있으면 로그의 후보 id를 `OVERRIDE` 맵에 넣고 재실행.

2. **[확인] 웹폰트 CDN 의존** — Pretendard를 jsDelivr CDN(`<link>`)으로 불러옵니다.
   외부 의존을 피하려면 폰트 파일을 리포에 담아 self-host로 바꿀 수 있습니다(제안). 현재는
   차단/오프라인 시 시스템 폰트로 자동 폴백되어 동작엔 문제 없음.

3. **[확인] 트위터 공유 방식** — 현재 트위터는 텍스트 인텐트(결과 문구+해시태그)만 전송하고,
   이미지 카드는 "PNG 저장" 버튼으로 따로 내려받는 구조입니다(인텐트 API가 이미지 첨부 미지원).
   X(트위터) 외 인스타/카톡 공유도 원하면 알려주세요.

4. **[취향] 타이틀곡 표기 최종 사인오프** — 웹 3라운드 검증은 마쳤으나 `titleTrack`은 팬덤
   관용 표기(예: "독 (Fear)" vs "독:Fear", FML 더블타이틀 대표곡)가 취향을 탈 수 있습니다.
   원하는 표기 규칙이 있으면 반영하겠습니다.

5. **[제안] 데이터 확장** — 현재 앨범 20개(정규·미니·스페셜·리패키지·베스트). 일본 앨범이나
   싱글까지 넣을지, 리패키지를 별도 문제로 다룰지 결정 필요.

6. **[미결] ESM/번들러 이행(B3)** — `file://` 호환 위해 보류. 배포를 정적 호스팅으로 확정하면
   Vite 등으로 이행 가능(요청 시 진행).

> PR은 아직 만들지 않았습니다(요청 시 생성). 모든 작업은 브랜치에 커밋·푸시만 했습니다.
