# 운영 스냅샷 (2026-08-24 01:59Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2440 | 2317 | 14.8% |
| normal | 10656 | 4985 | 64.7% |
| timeattack | 3372 | 1300 | 20.5% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3514 | 6170 | 57% |
| memberLyricist | 1087 | 1745 | 62.3% |
| year | 10700 | 17127 | 62.5% |
| lyricist | 2449 | 3239 | 75.6% |
| notInAlbum | 3822 | 5017 | 76.2% |
| albumType | 13752 | 17250 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1586 | 1958 | 81% |
| unitSong | 2203 | 2674 | 82.4% |
| memberNotSong | 15124 | 17923 | 84.4% |
| memberUnitSong | 15313 | 18084 | 84.7% |
| laterAlbum | 19400 | 21946 | 88.4% |
| albumCrop | 990 | 1087 | 91.1% |
| album | 12942 | 14086 | 91.9% |
| memberRoster | 13114 | 13758 | 95.3% |
| titleTrack | 16388 | 17159 | 95.5% |
| ytSong | 9756 | 10097 | 96.6% |
| memberUnit | 1220 | 1260 | 96.8% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 7건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 890 | ⚠ |
| `year__album_directorscut` | 45.5% | 62.5% | -17 | 696 | ⚠ |
| `timeline__album_directorscut` | 64.4% | 81% | -16.599999999999994 | 90 | ⚠ |
| `albumCrop__album_boysbe` | 74.6% | 91.1% | -16.5 | 71 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 792 | ⚠ |
| `lyricist__album_al1` | 59.9% | 75.6% | -15.699999999999996 | 656 | ⚠ |
| `unitSong__album_goingseventeen` | 67.4% | 82.4% | -15 | 129 | ⚠ |
| `year__album_goingseventeen` | 47.6% | 62.5% | -14.899999999999999 | 996 |  |
| `year__album_boysbe` | 48% | 62.5% | -14.5 | 841 |  |
| `notInAlbum__album_sector17` | 62% | 76.2% | -14.200000000000003 | 92 |  |
| `album__album_directorscut` | 78.1% | 91.9% | -13.800000000000011 | 676 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.2% | 79.7% | -13.5 | 711 |  |
| `albumType__album_directorscut` | 67.9% | 79.7% | -11.799999999999997 | 685 |  |
| `album__album_youmademydawn` | 81.5% | 91.9% | -10.400000000000006 | 588 |  |
| `notInAlbum__album_al1` | 66.2% | 76.2% | -10 | 622 |  |
| `unitSong__album_boysbe` | 72.5% | 82.4% | -9.900000000000006 | 91 |  |
| `year__album_vernon_blackeye` | 53.5% | 62.5% | -9 | 692 |  |
| `albumType__album_semicolon` | 70.8% | 79.7% | -8.900000000000006 | 874 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |
| `year__album_wonu_mingyu_bittersweet` | 54.3% | 62.5% | -8.200000000000003 | 704 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
