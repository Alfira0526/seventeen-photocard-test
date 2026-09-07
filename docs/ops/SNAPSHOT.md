# 운영 스냅샷 (2026-09-07 04:47Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2443 | 2320 | 14.8% |
| normal | 10685 | 5002 | 64.8% |
| timeattack | 3373 | 1301 | 20.4% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3524 | 6187 | 57% |
| memberLyricist | 1089 | 1748 | 62.3% |
| year | 10724 | 17161 | 62.5% |
| lyricist | 2453 | 3245 | 75.6% |
| notInAlbum | 3850 | 5047 | 76.3% |
| albumType | 13774 | 17276 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1614 | 1987 | 81.2% |
| unitSong | 2216 | 2695 | 82.2% |
| memberNotSong | 15154 | 17958 | 84.4% |
| memberUnitSong | 15342 | 18122 | 84.7% |
| laterAlbum | 19436 | 21984 | 88.4% |
| albumCrop | 1004 | 1104 | 90.9% |
| album | 12965 | 14109 | 91.9% |
| memberRoster | 13131 | 13777 | 95.3% |
| titleTrack | 16423 | 17195 | 95.5% |
| ytSong | 9785 | 10127 | 96.6% |
| memberUnit | 1249 | 1289 | 96.9% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 7건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 891 | ⚠ |
| `year__album_directorscut` | 45.6% | 62.5% | -16.9 | 697 | ⚠ |
| `timeline__album_directorscut` | 64.4% | 81.2% | -16.799999999999997 | 90 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 793 | ⚠ |
| `albumCrop__album_boysbe` | 74.6% | 90.9% | -16.30000000000001 | 71 | ⚠ |
| `lyricist__album_al1` | 59.9% | 75.6% | -15.699999999999996 | 658 | ⚠ |
| `unitSong__album_goingseventeen` | 66.7% | 82.2% | -15.5 | 132 | ⚠ |
| `year__album_goingseventeen` | 47.6% | 62.5% | -14.899999999999999 | 997 |  |
| `year__album_boysbe` | 48% | 62.5% | -14.5 | 841 |  |
| `notInAlbum__album_sector17` | 62.4% | 76.3% | -13.899999999999999 | 93 |  |
| `album__album_directorscut` | 78.1% | 91.9% | -13.800000000000011 | 676 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.3% | 79.7% | -13.400000000000006 | 712 |  |
| `albumType__album_directorscut` | 68% | 79.7% | -11.700000000000003 | 687 |  |
| `album__album_youmademydawn` | 81.5% | 91.9% | -10.400000000000006 | 588 |  |
| `notInAlbum__album_al1` | 66.3% | 76.3% | -10 | 623 |  |
| `unitSong__album_boysbe` | 73.1% | 82.2% | -9.100000000000009 | 93 |  |
| `year__album_vernon_blackeye` | 53.5% | 62.5% | -9 | 695 |  |
| `albumType__album_semicolon` | 70.9% | 79.7% | -8.799999999999997 | 875 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |
| `year__album_wonu_mingyu_bittersweet` | 54.2% | 62.5% | -8.299999999999997 | 707 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
