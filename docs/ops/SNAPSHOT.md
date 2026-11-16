# 운영 스냅샷 (2026-11-16 06:37Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2451 | 2328 | 14.8% |
| normal | 10703 | 5011 | 64.8% |
| timeattack | 3373 | 1301 | 20.4% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3530 | 6200 | 56.9% |
| memberLyricist | 1091 | 1752 | 62.3% |
| year | 10736 | 17182 | 62.5% |
| lyricist | 2456 | 3250 | 75.6% |
| notInAlbum | 3871 | 5073 | 76.3% |
| albumType | 13788 | 17294 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1630 | 2008 | 81.2% |
| unitSong | 2228 | 2708 | 82.3% |
| memberNotSong | 15177 | 17988 | 84.4% |
| memberUnitSong | 15367 | 18148 | 84.7% |
| laterAlbum | 19459 | 22012 | 88.4% |
| albumCrop | 1017 | 1120 | 90.8% |
| album | 12978 | 14124 | 91.9% |
| memberRoster | 13151 | 13797 | 95.3% |
| titleTrack | 16439 | 17212 | 95.5% |
| ytSong | 9801 | 10143 | 96.6% |
| memberUnit | 1264 | 1304 | 96.9% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 8건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.8% | 79.7% | -26.900000000000006 | 892 | ⚠ |
| `year__album_directorscut` | 45.6% | 62.5% | -16.9 | 698 | ⚠ |
| `timeline__album_directorscut` | 64.8% | 81.2% | -16.400000000000006 | 91 | ⚠ |
| `album__album_boysbe` | 75.6% | 91.9% | -16.30000000000001 | 794 | ⚠ |
| `albumCrop__album_boysbe` | 74.6% | 90.8% | -16.200000000000003 | 71 | ⚠ |
| `lyricist__album_al1` | 59.8% | 75.6% | -15.799999999999997 | 659 | ⚠ |
| `unitSong__album_goingseventeen` | 66.9% | 82.3% | -15.399999999999991 | 133 | ⚠ |
| `year__album_goingseventeen` | 47.5% | 62.5% | -15 | 999 | ⚠ |
| `year__album_boysbe` | 48.1% | 62.5% | -14.399999999999999 | 842 |  |
| `album__album_directorscut` | 78.1% | 91.9% | -13.800000000000011 | 676 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.3% | 79.7% | -13.400000000000006 | 712 |  |
| `notInAlbum__album_sector17` | 63.2% | 76.3% | -13.099999999999994 | 95 |  |
| `albumType__album_directorscut` | 67.9% | 79.7% | -11.799999999999997 | 688 |  |
| `album__album_youmademydawn` | 81.5% | 91.9% | -10.400000000000006 | 588 |  |
| `albumCrop__album_anode` | 80.6% | 90.8% | -10.200000000000003 | 36 |  |
| `notInAlbum__album_al1` | 66.3% | 76.3% | -10 | 626 |  |
| `unitSong__album_boysbe` | 72.6% | 82.3% | -9.700000000000003 | 95 |  |
| `year__album_vernon_blackeye` | 53.4% | 62.5% | -9.100000000000001 | 696 |  |
| `albumType__album_semicolon` | 70.9% | 79.7% | -8.799999999999997 | 876 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |

## 4) 미처리 오류 제보 (0건)
접수된 미처리 제보가 없습니다.
