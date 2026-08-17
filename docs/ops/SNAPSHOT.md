# 운영 스냅샷 (2026-08-17 01:56Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2429 | 2306 | 14.8% |
| normal | 10654 | 4983 | 64.7% |
| timeattack | 3372 | 1300 | 20.5% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3510 | 6164 | 56.9% |
| memberLyricist | 1087 | 1742 | 62.4% |
| year | 10687 | 17112 | 62.5% |
| lyricist | 2448 | 3238 | 75.6% |
| notInAlbum | 3809 | 5003 | 76.1% |
| albumType | 13737 | 17235 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1569 | 1940 | 80.9% |
| unitSong | 2192 | 2663 | 82.3% |
| memberNotSong | 15105 | 17903 | 84.4% |
| memberUnitSong | 15298 | 18068 | 84.7% |
| laterAlbum | 19379 | 21925 | 88.4% |
| albumCrop | 973 | 1069 | 91% |
| album | 12927 | 14070 | 91.9% |
| memberRoster | 13099 | 13743 | 95.3% |
| titleTrack | 16370 | 17141 | 95.5% |
| ytSong | 9743 | 10084 | 96.6% |
| memberUnit | 1203 | 1242 | 96.9% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 7건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 890 | ⚠ |
| `year__album_directorscut` | 45.5% | 62.5% | -17 | 695 | ⚠ |
| `timeline__album_directorscut` | 64% | 80.9% | -16.900000000000006 | 89 | ⚠ |
| `albumCrop__album_boysbe` | 74.6% | 91% | -16.400000000000006 | 71 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 791 | ⚠ |
| `lyricist__album_al1` | 59.9% | 75.6% | -15.699999999999996 | 656 | ⚠ |
| `unitSong__album_goingseventeen` | 67.2% | 82.3% | -15.099999999999994 | 128 | ⚠ |
| `year__album_goingseventeen` | 47.6% | 62.5% | -14.899999999999999 | 996 |  |
| `notInAlbum__album_sector17` | 61.5% | 76.1% | -14.599999999999994 | 91 |  |
| `year__album_boysbe` | 48% | 62.5% | -14.5 | 841 |  |
| `album__album_directorscut` | 78.1% | 91.9% | -13.800000000000011 | 676 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.2% | 79.7% | -13.5 | 711 |  |
| `albumType__album_directorscut` | 67.9% | 79.7% | -11.799999999999997 | 685 |  |
| `album__album_youmademydawn` | 81.4% | 91.9% | -10.5 | 587 |  |
| `unitSong__album_boysbe` | 72.2% | 82.3% | -10.099999999999994 | 90 |  |
| `notInAlbum__album_al1` | 66.2% | 76.1% | -9.899999999999991 | 622 |  |
| `albumCrop__album_anode` | 81.8% | 91% | -9.200000000000003 | 33 |  |
| `year__album_vernon_blackeye` | 53.5% | 62.5% | -9 | 691 |  |
| `albumType__album_semicolon` | 70.8% | 79.7% | -8.900000000000006 | 874 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
