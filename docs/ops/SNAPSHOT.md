# 운영 스냅샷 (2026-08-10 02:09Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2429 | 2306 | 14.8% |
| normal | 10651 | 4982 | 64.8% |
| timeattack | 3367 | 1296 | 20.5% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3507 | 6161 | 56.9% |
| memberLyricist | 1085 | 1739 | 62.4% |
| year | 10682 | 17106 | 62.4% |
| lyricist | 2447 | 3237 | 75.6% |
| notInAlbum | 3801 | 4994 | 76.1% |
| albumType | 13732 | 17227 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1565 | 1932 | 81% |
| unitSong | 2185 | 2656 | 82.3% |
| memberNotSong | 15097 | 17895 | 84.4% |
| memberUnitSong | 15294 | 18063 | 84.7% |
| laterAlbum | 19375 | 21919 | 88.4% |
| albumCrop | 970 | 1066 | 91% |
| album | 12925 | 14064 | 91.9% |
| memberRoster | 13094 | 13737 | 95.3% |
| titleTrack | 16363 | 17134 | 95.5% |
| ytSong | 9738 | 10079 | 96.6% |
| memberUnit | 1197 | 1236 | 96.8% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 7건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 890 | ⚠ |
| `timeline__album_directorscut` | 64% | 81% | -17 | 89 | ⚠ |
| `year__album_directorscut` | 45.5% | 62.4% | -16.9 | 695 | ⚠ |
| `albumCrop__album_boysbe` | 74.6% | 91% | -16.400000000000006 | 71 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 791 | ⚠ |
| `lyricist__album_al1` | 59.9% | 75.6% | -15.699999999999996 | 656 | ⚠ |
| `unitSong__album_goingseventeen` | 67.2% | 82.3% | -15.099999999999994 | 128 | ⚠ |
| `year__album_goingseventeen` | 47.5% | 62.4% | -14.899999999999999 | 995 |  |
| `notInAlbum__album_sector17` | 61.5% | 76.1% | -14.599999999999994 | 91 |  |
| `year__album_boysbe` | 48% | 62.4% | -14.399999999999999 | 841 |  |
| `album__album_directorscut` | 78.3% | 91.9% | -13.600000000000009 | 674 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.3% | 79.7% | -13.400000000000006 | 710 |  |
| `albumType__album_directorscut` | 68% | 79.7% | -11.700000000000003 | 684 |  |
| `unitSong__album_boysbe` | 71.9% | 82.3% | -10.399999999999991 | 89 |  |
| `album__album_youmademydawn` | 81.6% | 91.9% | -10.300000000000011 | 586 |  |
| `notInAlbum__album_al1` | 66.2% | 76.1% | -9.899999999999991 | 622 |  |
| `albumCrop__album_anode` | 81.8% | 91% | -9.200000000000003 | 33 |  |
| `albumType__album_semicolon` | 70.8% | 79.7% | -8.900000000000006 | 874 |  |
| `year__album_vernon_blackeye` | 53.5% | 62.4% | -8.899999999999999 | 691 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
