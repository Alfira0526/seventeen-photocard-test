# 운영 루틴 — 리포트 · 오류 제보 · 정기 개선

이 문서는 게임을 "정기적으로 점검·개선"하는 자동 루프와, 그 안에서 5인 페르소나가
어떻게 협업하는지를 정의합니다. (기획 비전문가도 이해할 수 있도록 역할과 흐름을 명시)

## 전체 루프

```
[플레이어 브라우저]
   ├─ 텔레메트리(analytics.js) ─▶ Firebase /stats   (모드 이용률·유형/문제별 정답률)
   └─ 오류 제보(report.js)     ─▶ Firebase /reports (문제 맥락 + 자유 텍스트)
                                        │
[매주 월 00:10 UTC] GitHub Actions(ops-snapshot) ──GET──▶ Firebase
   └─ docs/ops/{stats-latest.json, reports-latest.json, SNAPSHOT.md} 커밋
                                        │
[매주 월 02:00 UTC] 주간 리뷰 루틴(Claude 세션) ── docs/ops 읽기
   ├─ 5인 페르소나 리뷰 → docs/reports/<날짜>-review.md
   ├─ 검증된 데이터 오류 즉시 수정(웹 교차검증) + docs/ops/handled.json 갱신
   └─ 애매/위험 변경은 "제안"으로만 남기고 사용자에게 보고, dev 브랜치에 push
```

> 왜 이 구조인가: 개발 샌드박스는 외부(파이어베이스) 직접 접근이 막혀 있어, **열린 네트워크인
> GitHub Actions**가 데이터를 리포지토리로 실어 나르고, **리뷰 루틴(Claude)**은 리포지토리
> 파일만 읽어 분석합니다. (오류 교차검증용 웹 검색은 루틴에서 가능)

## 5인 페르소나와 관계

| # | 역할 | 주 업무 | 산출물 |
|---|---|---|---|
| 1 | **팀장(8년차)** | 업무 분담·판단·의견 수합. 2~5의 결과를 종합해 우선순위 결정 | 주간 리뷰 종합·의사결정 |
| 2 | **QA(4년차)** | 모드 이용률·정답률 리포트, 오류 제보 점검·재현 | 정확도/이용률 리포트, 오류 리포트 |
| 3 | **개발자(4년차)** | 시스템적 오류(로딩 실패·데이터 정합성·성능) 점검·개선안 | 기술 이슈·수정안 |
| 4 | **기획자(4년차)** | 재미 요소 점검, 최초 기획의도(자켓·멤버·MV 퀴즈 + 랭킹) 유지 여부 | 콘텐츠/재미 개선안·신규 문제 아이디어 |
| 5 | **디자이너(3년차)** | 기획의도 대비 UX/사용자 친화성 점검 | UI/UX 개선안 |

**관계·흐름**: 팀장(1)이 스냅샷을 보고 업무를 분배 → QA(2)가 수치·제보를 정리 →
개발자(3)·기획자(4)·디자이너(5)가 각 관점에서 진단·제안 → 팀장(1)이 종합해
"이번 주 반영/보류/제안"을 결정. 검증된 데이터 오류는 즉시 반영, 그 외는 제안으로 보고.

## 리뷰 루틴이 하는 일 (안전 규칙)

1. `docs/ops/SNAPSHOT.md`(+ json) 를 읽는다.
2. **오류 제보 교차검증**: 각 제보를 웹서치로 사실 확인. 데이터 오류가 **확증**되면 즉시 수정
   (예: Face the Sun 타이틀곡 → HOT). 처리한 제보 id 는 `docs/ops/handled.json` 에 추가.
3. **이상문제 후보**(정답률 비정상적으로 낮음)도 데이터 오류 의심 → 검증 후 수정.
4. **정확도/이용률 리포트 + 개선 협의 결과**를 `docs/reports/<날짜>-review.md` 로 작성.
5. 애매하거나 큰 변경(신규 기능·UX 리뉴얼·리스크 있는 리팩터)은 **직접 반영하지 않고**
   리포트에 "제안"으로 남기고 사용자 승인 대기.
6. 유닛/E2E 테스트 통과 확인 후 **dev 브랜치에 push**(운영 반영은 사용자의 배포로).
7. 완료 요약을 사용자에게 통지.

## Firebase 보안 규칙 (사용자 1회 설정 필요)

텔레메트리/제보가 저장되려면 규칙에 `stats`·`reports`를 열어야 합니다. Realtime Database →
**규칙** 탭에 아래를 붙여넣고 게시하세요. (rankings 는 기존대로 유지)

```json
{
  "rules": {
    "rankings": {
      ".read": true,
      "$mode": { "$id": {
        ".write": "!data.exists() && newData.exists()",
        ".validate": "newData.hasChildren(['name','score','mode','ts']) && newData.child('name').isString() && newData.child('name').val().length <= 12 && newData.child('score').isNumber() && newData.child('ts').isNumber()"
      } }
    },
    "stats": {
      ".read": true,
      ".write": true
    },
    "reports": {
      ".read": true,
      "$id": {
        ".write": "!data.exists() && newData.exists()",
        ".validate": "newData.hasChildren(['ts'])"
      }
    }
  }
}
```

- `stats`: 카운터(정수) 집계용. 익명·비식별. 공개 쓰기라 이론상 조작 가능하나 리뷰 루틴이
  이상치를 걸러냅니다(팬 데모 수준 트레이드오프).
- `reports`: 새 제보 추가만 허용(수정·삭제 불가). 공개 읽기(스냅샷 Actions용).

## 개인정보 / 프라이버시

- 텔레메트리는 **집계 카운터만**(누가 무엇을 했는지 식별 불가).
- 제보는 자유 텍스트 + 문제 맥락 + 브라우저/로케일만 저장(이름·연락처 등 요구 안 함).

## 루틴 관리

- 스냅샷 워크플로: `.github/workflows/ops-snapshot.yml` (수동 실행: Actions 탭 → Run workflow)
- 주간 리뷰 루틴: Claude Routine(스케줄). 잠시 끄려면 사용자가 Routine 을 비활성화하면 됩니다.
- 리포트 산출물: `docs/reports/`, 처리 이력: `docs/ops/handled.json`
