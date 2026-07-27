# 릴리즈 파이프라인 (테스트베드 → 프로덕션)

주간 업데이트를 **미리 개발 → 테스트베드에서 검수 → 릴리즈일에 승격**하기 위한 배포 구조.

## 구조

```
develop 브랜치(claude/game-analysis-improvements-7mccdp)  ── push ──▶ 테스트베드  /preview/
   │  (평소 작업은 여기, 프로덕션에 자동 노출되지 않음)
   │
[릴리즈일] Actions ▸ "Promote develop → release" 수동 실행(입력 promote)
   ▼
release 브랜치  ── push ──▶ 프로덕션  /
```

- **프로덕션**: `https://alfira0526.github.io/seventeen-photocard-test/`
- **테스트베드**: `https://alfira0526.github.io/seventeen-photocard-test/preview/`
- 두 URL은 **같은 Pages 산출물**의 다른 경로. `deploy-pages.yml` 이 release→`/`, develop→`/preview/` 로 한 번에 배포.

## 데이터 격리 (실 랭킹 오염 방지)

테스트베드는 `js/env.js` 가 경로(`/preview/`)로 스테이징을 감지해 Firebase 경로 앞에 **`staging/`** 접두사를 붙인다(`staging/rankings`, `staging/stats`, `staging/reports`). 로컬 저장 키도 `svt-ranking-staging` 로 분리. → **테스트 점수/제보가 실 데이터에 절대 섞이지 않음.** 상단엔 빨간 "🧪 테스트베드" 배너가 뜬다.

### Firebase 규칙 (1회 추가 필요)

기존 규칙에 `staging` 서브트리를 추가한다(테스트 데이터라 열어둠). Realtime Database → 규칙:

```json
{
  "rules": {
    "rankings": { "...": "기존 그대로" },
    "stats":    { "...": "기존 그대로" },
    "reports":  { "...": "기존 그대로" },
    "staging": { ".read": true, ".write": true }
  }
}
```

## 운영자 1회 설정

1. **Pages 소스 = GitHub Actions** (Settings ▸ Pages ▸ Source) — *이미 설정됨.*
2. 위 **Firebase `staging` 규칙** 추가.

## 릴리즈 절차 (매 릴리즈일)

1. 그 주 작업이 develop 에 병합되어 `/preview/` 에서 검수 완료.
2. GitHub ▸ **Actions ▸ "Promote develop → release" ▸ Run workflow** ▸ 입력칸에 `promote`.
3. `deploy-pages` 가 자동으로 프로덕션(`/`) 갱신. 끝.
4. 문제가 있으면 되돌리기: release 브랜치를 직전 커밋으로 옮기고 재배포(아래).

## 변경 리스크 점검 · 보강 (하드닝)

| 리스크 | 보강 |
|---|---|
| Pages 소스를 Actions로 바꿨는데 **배포 워크플로가 없어 사이트 정지** | `deploy-pages.yml` 추가로 해결(이 변경의 핵심). |
| 최초에 **release 브랜치가 없어** 빌드 실패 | 워크플로가 release 없으면 **develop 로 폴백**해 프로덕션이 비지 않음. |
| 빌드 실패 시 **사이트가 깨짐** | 실패하면 배포가 안 될 뿐, Pages는 **직전 성공 배포를 유지**(무중단). |
| 스테이징 테스트 점수가 **실 랭킹 오염** | 경로/로컬키 `staging` 네임스페이스 격리 + 배너. |
| `SVT_DATA_PREFIX` 미정의 시 `undefinedrankings` 같은 **깨진 경로** | 모든 소비처에서 `(… || "")` 폴백 → 프로덕션은 접두사 없이 그대로. |
| 실수로 프로덕션 승격 | 승격 워크플로는 입력값 `promote` 정확 일치해야 실행. |
| 테스트베드가 **검색엔진에 노출** | `robots.txt` 로 `/preview/` 색인 차단. |
| 동시 배포 충돌 | `concurrency: pages` 로 마지막 것만 반영. |

## 되돌리기(롤백)

```
git push origin <직전_안정_커밋>:release --force-with-lease
```
→ deploy-pages 가 프로덕션을 그 커밋으로 되돌린다. (테스트베드/데이터는 영향 없음)
