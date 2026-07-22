# 데이터 가이드 (DATA_GUIDE)

모든 정답 데이터는 **`js/data.js` 한 파일**에 있습니다. 여기에 앨범·수록곡·작사
데이터를 추가하면 문제 엔진이 **자동으로** 새 문제를 출제합니다(코드 수정 불필요).

> 원칙: **정확도 우선.** 검증되지 않은 데이터는 넣지 마세요. 데이터가 없으면 그
> 앨범은 기본 3유형만 출제되어 고증 오류가 생기지 않습니다.

## 1. 앨범 추가/수정

`ALBUMS` 배열에 한 줄 추가합니다.

```js
{ id: "example", title: "EXAMPLE", year: 2025, type: "미니 13집",
  titleTrack: "제목 (Title)", itunes: "EXAMPLE" },
```

| 필드 | 설명 | 검증 포인트 |
|---|---|---|
| `id` | 내부 식별자(영소문자) | 중복 금지 |
| `title` | 앨범명(정답) | 공식 표기 |
| `year` | 발매연도(정수) | 2015~현재 |
| `type` | 미니/정규/스페셜/리패키지/베스트 | 표기 통일 |
| `titleTrack` | 타이틀곡. `"국문 (English)"` 우선 | 팬덤 표기 확인 |
| `itunes` | 자켓 검색 힌트 | iTunes에서 잘 잡히는 키워드 |
| `artist` | (선택) 아티스트. 솔로·유닛은 명시 | 미지정 시 `SEVENTEEN` |

> 믹스테이프·유닛·솔로 싱글은 아티스트가 다르므로 `artist`를 넣습니다
> (예: `artist: "HOSHI"`, `"BSS"`, `"WOOZI"`). 자켓 검색·매칭이 그 아티스트로 수행됩니다.
> `type`은 `스페셜 앨범 / 유닛 싱글 / 믹스테이프 / 디지털 싱글` 등 자유롭게 표기.

## 2. 수록곡 추가 → `notInAlbum` · `unitSong` 활성화

`TRACKLISTS` 맵에 `앨범id: [ {title, unit?} ]` 를 추가합니다.

```js
const TRACKLISTS = {
  example: [
    { title: "제목 (Title)" },                 // 타이틀곡도 넣어도 됨
    { title: "Some B-side" },
    { title: "Vocal Song",  unit: "vocal" },       // 보컬 유닛곡
    { title: "Hiphop Song", unit: "hiphop" },      // 힙합 유닛곡
    { title: "Perf Song",   unit: "performance" }, // 퍼포먼스 유닛곡
  ],
};
```

- `unit` 값은 **`vocal` / `hiphop` / `performance`** 중 하나.
- `notInAlbum`은 수록곡이 **3곡 이상**이면 활성화.
- `unitSong`은 **`unit` 태그가 있고 총 4곡 이상**이면 활성화.
- 부분 목록도 안전합니다(나열한 곡이 실제 수록곡이기만 하면 됨). 단, **다른 앨범과
  중복되는 곡(리패키지 등)은 넣지 마세요** — `notInAlbum` 정답 계산이 틀어질 수 있습니다.

## 3. 타이틀곡 작사 멤버 추가 → `lyricist` 활성화

`TITLE_LYRICISTS` 맵에 `앨범id: [멤버id...]` 를 추가합니다. **멤버만**(비멤버 작곡가
Bumzu 등은 제외) 넣습니다.

```js
const TITLE_LYRICISTS = {
  example: ["woozi", "vernon"],   // 타이틀곡 작사에 참여한 멤버
};
```

- 멤버 id: `scoups jeonghan joshua jun hoshi wonwoo woozi dk mingyu the8 seungkwan vernon dino`
- **완전한 목록**을 넣어야 합니다. 일부만 넣으면, 실제로 참여한 멤버가 오답(“미참여”)으로
  나올 수 있습니다. → 크레딧 전체를 확인한 앨범만 추가하세요.

## 4. 검증 절차(권장)

정확도를 위해 아래 **3라운드 교차검증**을 권장합니다(이 프로젝트에서 실제 사용한 방식).

1. **서치** — 1차 출처 확인: 영문 Wikipedia 각 곡/앨범 문서, `carat.fandom` / `kpop.fandom` Wiki.
2. **검수** — 서로 다른 관점으로 대조:
   - 사실(앨범명/연도/유형) · 팬덤 관용 표기(리패키지·더블타이틀 함정) · 정합성(포맷/중복).
3. **반영 → 수정** — 데이터 입력 후 아래 테스트로 자동 검증.

```bash
npm test   # 정답 포함·4지선다·중복0·유형별 사실성(정답이 실제 비수록곡/작사멤버인지) 자동 확인
```

### 출처 예시(작사 멤버)

| 타이틀곡 | 작사 참여 멤버 | 출처 |
|---|---|---|
| Don't Wanna Cry (Al1) | 우지·버논·호시·정한 | Wikipedia “Don't Wanna Cry” |
| Fear (An Ode) | 우지·에스쿱스·버논 | Wikipedia / carat.fandom |
| Left & Right (Heng:garæ) | 우지·버논 | Wikipedia “Left & Right” |
| Super (FML) | 우지·에스쿱스·버논 | Wikipedia “Super” |

## 5. 현재 커버리지

| 유형 | 데이터 보유 앨범 |
|---|---|
| `notInAlbum` (수록곡) | Al1 · TEEN,AGE · An Ode · Heng:garæ · Your Choice |
| `unitSong` (유닛곡) | Al1 · TEEN,AGE · An Ode |
| `lyricist` (작사) | Al1 · An Ode · Heng:garæ · FML |

나머지 앨범은 기본 3유형만 출제됩니다. 위 절차로 검증해 채우면 커버리지가 늘어납니다.

## 6. 자켓 매칭이 틀릴 때

`js/albumArt.js`를 쓰는 경우(`npm run fetch-art`), 매칭이 틀린 앨범은
`scripts/fetch-art.mjs` 상단 `OVERRIDE` 맵에 고정합니다.

```js
const OVERRIDE = {
  goingseventeen: 1160457959,                 // iTunes collectionId(숫자), 또는
  happyburstday:  "https://.../600x600bb.jpg" // 자켓 URL(문자열)
};
```

스크립트는 매칭 실패 시 후보(collectionId 포함)를 콘솔에 출력하므로, 그 값을 그대로
넣으면 됩니다.
