# 전역 랭킹 연결 가이드 (Firebase)

시작화면 명예의 전당·결과 랭킹을 **다른 PC/IP에서도 공유**하려면 무료 Firebase
Realtime Database를 붙이면 됩니다. 코드(`js/ranking.js`)는 이미 준비돼 있어,
`js/ranking-config.js`에 DB URL 한 줄만 넣으면 활성화됩니다. (없으면 자동 로컬 전용)

## 1) Firebase 프로젝트 + Realtime Database 만들기 (약 5분, 무료)
1. https://console.firebase.google.com → **프로젝트 추가** (이름 아무거나, 애널리틱스는 꺼도 됨)
2. 좌측 **빌드 → Realtime Database → 데이터베이스 만들기**
3. 위치 선택(예: `asia-southeast1`), 보안 규칙은 **잠금 모드로 시작** 후 아래 3)에서 교체
4. 상단에 보이는 DB URL을 복사 — 형태 예시:
   - `https://<프로젝트>-default-rtdb.firebaseio.com`
   - 또는 `https://<프로젝트>-default-rtdb.asia-southeast1.firebasedatabase.app`

## 2) URL 넣기
`js/ranking-config.js` 를 아래처럼 한 줄만 채우면 됩니다:

```js
window.SVTRankingConfig = { firebase: "https://<프로젝트>-default-rtdb.firebaseio.com" };
```

> URL만 알려주시면 제가 넣고 커밋·배포하겠습니다.

## 3) 보안 규칙(append-only) — 스팸/삭제 방지
Realtime Database → **규칙** 탭에 아래를 붙여넣고 게시하세요. 읽기는 공개,
쓰기는 **새 기록 추가만** 허용(기존 기록 수정·삭제 불가), 필드/형식도 검증합니다.

```json
{
  "rules": {
    "rankings": {
      ".read": true,
      "$mode": {
        "$id": {
          ".write": "!data.exists() && newData.exists()",
          ".validate": "newData.hasChildren(['name','score','mode','ts']) && newData.child('name').isString() && newData.child('name').val().length <= 12 && newData.child('score').isNumber() && newData.child('ts').isNumber()"
        }
      }
    }
  }
}
```

- 게임은 `POST /rankings/<mode>.json` 으로 기록을 추가하고, `GET /rankings/<mode>.json` 으로 조회합니다.
- 이 규칙이면 아무도 남의 기록을 지우거나 바꿀 수 없고, 이상한 형식은 저장되지 않습니다.
- 앱은 API 키가 필요 없습니다(공개 읽기/추가 규칙 기반). 원격이 실패해도 로컬로 자동 폴백합니다.

## 참고
- 무료 Spark 요금제로 충분합니다(소규모 팬 게임 트래픽).
- 데이터가 너무 커지면 상위 N개만 저장하도록 서버측 정리(선택)를 추가할 수 있습니다.
