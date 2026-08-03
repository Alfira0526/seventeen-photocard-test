# 운영 스냅샷 (2026-08-03 03:46Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2421 | 2300 | 14.8% |
| normal | 10590 | 4970 | 64.9% |
| timeattack | 3309 | 1254 | 20.3% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3480 | 6126 | 56.8% |
| memberLyricist | 1079 | 1731 | 62.3% |
| year | 10624 | 17015 | 62.4% |
| lyricist | 2432 | 3218 | 75.6% |
| notInAlbum | 3697 | 4864 | 76% |
| albumType | 13674 | 17160 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1470 | 1805 | 81.4% |
| unitSong | 2131 | 2586 | 82.4% |
| memberNotSong | 14988 | 17769 | 84.3% |
| memberUnitSong | 15187 | 17937 | 84.7% |
| laterAlbum | 19266 | 21789 | 88.4% |
| albumCrop | 908 | 999 | 90.9% |
| album | 12871 | 14002 | 91.9% |
| memberRoster | 13037 | 13675 | 95.3% |
| titleTrack | 16297 | 17065 | 95.5% |
| ytSong | 9652 | 9990 | 96.6% |
| memberUnit | 1123 | 1156 | 97.1% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 5건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 886 | ⚠ |
| `year__album_directorscut` | 45.6% | 62.4% | -16.799999999999997 | 693 | ⚠ |
| `albumCrop__album_boysbe` | 74.3% | 90.9% | -16.60000000000001 | 70 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 788 | ⚠ |
| `lyricist__album_al1` | 59.8% | 75.6% | -15.799999999999997 | 651 | ⚠ |
| `unitSong__album_goingseventeen` | 67.5% | 82.4% | -14.900000000000006 | 120 |  |
| `year__album_goingseventeen` | 47.6% | 62.4% | -14.799999999999997 | 994 |  |
| `year__album_boysbe` | 47.9% | 62.4% | -14.5 | 838 |  |
| `timeline__album_directorscut` | 67.1% | 81.4% | -14.300000000000011 | 82 |  |
| `notInAlbum__album_sector17` | 62.1% | 76% | -13.899999999999999 | 87 |  |
| `album__album_directorscut` | 78.5% | 91.9% | -13.400000000000006 | 673 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.4% | 79.7% | -13.299999999999997 | 709 |  |
| `albumType__album_directorscut` | 67.9% | 79.7% | -11.799999999999997 | 683 |  |
| `albumCrop__album_anode` | 80% | 90.9% | -10.900000000000006 | 30 |  |
| `album__album_youmademydawn` | 81.6% | 91.9% | -10.300000000000011 | 582 |  |
| `unitSong__album_boysbe` | 72.6% | 82.4% | -9.800000000000011 | 84 |  |
| `notInAlbum__album_al1` | 66.2% | 76% | -9.799999999999997 | 621 |  |
| `albumType__album_semicolon` | 70.6% | 79.7% | -9.100000000000009 | 868 |  |
| `year__album_vernon_blackeye` | 53.3% | 62.4% | -9.100000000000001 | 685 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
