# 설계 문서 (ARCHITECTURE)

이 프로젝트는 **빌드 도구·프레임워크·런타임 의존성이 전혀 없는** 순수 정적
웹앱입니다. `<script>` 나열식으로 로드되며, 각 파일은 **하나의 책임**만 가집니다.
순수 로직은 DOM과 분리되어 브라우저와 Node(테스트) 양쪽에서 재사용됩니다.

## 1. 왜 이렇게 설계했나

| 원칙 | 이유 |
|---|---|
| 빌드리스(정적) | `index.html`만 열면 실행 → 초보자 배포(GitHub Pages)·데모가 쉬움 |
| 로직/DOM 분리 | 게임 규칙을 브라우저 없이 단위 테스트 가능(빠르고 안정적) |
| 데이터 단일 소스(`data.js`) | 정답이 한 곳에 → 검증·확장 용이 |
| 이미지 URL만, 파일 X | 저작물 재배포 회피 + 리포 경량 |
| 유형 레지스트리 | 문제 유형을 데이터/코드로 확장(엔진 수정 없이 추가) |

> ESM(`type=module`) 대신 전역 `<script>`를 쓰는 이유: `file://` 직접 열기에서
> 모듈이 CORS로 막히기 때문. 번들러 도입 시 ESM으로 이행 예정(보류 항목).

## 2. 로드 순서와 의존성

`index.html` 하단 스크립트 순서(위→아래로 의존):

```
albumArt.js?  →  i18n.js  →  logic.js  →  data.js  →  questions.js  →  artlive.js  →  game.js
 (선택,자동생성)   문구        순수로직     정답데이터     문제엔진        자켓로딩       DOM/진행
```

- `albumArt.js`는 **선택**(없으면 404 무시). 있으면 `window.SVTArt` 주입 → `data.js`가 병합.
- 순수 모듈(`logic`, `questions`, `i18n`, `data`)은 Node에서 `require`도 지원
  (`module.exports`) → 테스트에서 직접 로드.

## 3. 파일별 책임

| 파일 | 책임 | 브라우저 전역 | Node export |
|---|---|---|---|
| `i18n.js` | UI 문자열 중앙화 | `window.I18N` | ✅ |
| `logic.js` | 셔플, 보기 생성, 근접 오답, 등급 | `window.QuizLogic` | ✅ |
| `data.js` | 앨범/멤버/수록곡/작사 데이터 + 무결성 검증 | `window.SVTData` | ✅ |
| `questions.js` | 문제 유형 레지스트리·가용성·가중 랜덤 | `window.QuizQuestions` | ✅ |
| `artlive.js` | 자켓 실시간 로딩(JSONP) | `window.SVTArtLive` | — |
| `game.js` | 모드·라운드·렌더·채점·결과·공유·테마 | (IIFE) | — |

## 4. 문제 엔진 (`questions.js`)

핵심 아이디어: **유형(type) 배열**. 각 유형은 스스로 "이 앨범에 낼 수 있는가"를 판단합니다.

```js
{
  id: "unitSong",
  weight: 1.6,                        // 가중 랜덤 선택 시 확률 가중치
  available: (album) => Array.isArray(album.tracks)
                     && album.tracks.some(t => t.unit),   // 데이터 없으면 미출제
  make: (album, ctx) => ({ label, correct, choices, note })
}
```

- `buildQuestion(album, ctx)` = `available` 통과 유형 중 **가중 랜덤 1개** 선택 → `make` 호출.
- 데이터가 없는 앨범은 기본 3유형(album/year/titleTrack)만 가능 → **오답(고증 오류) 위험 0**.
- `ctx` = `{ albums, years, members, memberName, n, rng }`. `rng`는 모드별 난수원.

### 유형별 정답/오답 생성 규칙

| 유형 | 정답 | 오답(distractor) |
|---|---|---|
| album | 그 앨범 | 같은 유형/인접 연도 앨범 우선 |
| year | 발매연도 | 정답에 가까운 연도 우선 |
| titleTrack | 타이틀곡 | 다른 앨범 타이틀곡 |
| notInAlbum | **다른** 앨범의 수록곡 | 이 앨범의 실제 수록곡 3개 |
| lyricist | 작사 참여 **멤버** | 작사 미참여 멤버 |
| unitSong | 그 유닛의 곡 | 같은 앨범의 다른 곡 |

## 5. 결정론적 데일리 챌린지

`game.js`는 날짜 문자열을 해시 → `mulberry32` 시드 PRNG를 만들어 `state.rng`로 사용합니다.
덱 셔플과 보기 생성이 모두 이 `rng`를 받으므로, **같은 날엔 누구나 같은 문제**가 나옵니다.

```
todayKey("2026-07-22") → hashStr → mulberry32(seed) → 덱·보기 결정론적
```

## 6. 자켓 로딩 폴백 (`artlive.js`)

```
album.art (베이크됨) ─┐
                      ├─→ 있으면 <img> (블러업)
SVTArtLive.get(album) ┘   실패/차단/오프라인 → SVG 플레이스홀더
```

- `SVTArtLive.get`은 iTunes Search API를 **JSONP**(`<script>`)로 호출 → CORS 무관,
  `file://`·정적호스팅 모두 동작. 앨범별 1회 캐시. 6초 타임아웃.

## 7. 상태 & 저장

- 게임 상태는 `game.js`의 `state` 객체(덱/라운드/점수/정답기록)에 보관(DOM과 분리).
- `localStorage`: 테마(`svt-theme`), 직전 오답(`svt-wrong`), 데일리 기록/스트릭
  (`svt-daily`/`svt-streak`). 사파리 프라이빗 등 예외는 조용히 무시.

## 8. 테스트 전략

- **단위(`quiz.test.mjs`)**: 순수 로직·문제 엔진·데이터 무결성. 브라우저 불필요, 빠름.
  대량 시행으로 "정답 항상 포함·4지선다·중복 0"과 유형별 사실성(정답이 실제 비수록곡인지 등) 검증.
- **E2E(`e2e.test.mjs`)**: Playwright로 완주·데일리 결정론·오답 복습·공유 카드 렌더 확인.
  Playwright 미설치 시 자동 skip.
