# 운영 스냅샷 (2026-08-03 02:07Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 2421 | 2300 | 14.8% |
| normal | 10589 | 4970 | 64.9% |
| timeattack | 3306 | 1251 | 20.3% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 3477 | 6123 | 56.8% |
| memberLyricist | 1079 | 1731 | 62.3% |
| year | 10620 | 17010 | 62.4% |
| lyricist | 2432 | 3218 | 75.6% |
| notInAlbum | 3695 | 4862 | 76% |
| albumType | 13672 | 17158 | 79.7% |
| albumNumber | 7175 | 8912 | 80.5% |
| timeline | 1469 | 1802 | 81.5% |
| unitSong | 2131 | 2585 | 82.4% |
| memberNotSong | 14985 | 17764 | 84.4% |
| memberUnitSong | 15186 | 17935 | 84.7% |
| laterAlbum | 19262 | 21784 | 88.4% |
| albumCrop | 906 | 996 | 91% |
| album | 12867 | 13998 | 91.9% |
| memberRoster | 13036 | 13674 | 95.3% |
| titleTrack | 16296 | 17064 | 95.5% |
| ytSong | 9651 | 9989 | 96.6% |
| memberUnit | 1119 | 1152 | 97.1% |

## 3) 이상문제 후보 (표본 8+ · **유형평균 대비 이탈폭** 하위 20 → 데이터 오류 의심)
> ⚠ = 유형평균보다 15%p 이상 낮음(유형 난이도로 설명 안 되는 진짜 이상치 후보). 플래그 5건.
| 문제키(typeId__kind_ref) | 정답률 | 유형평균 | 이탈(%p) | 표본 | |
|---|---:|---:|---:|---:|:--:|
| `albumType__album_loveandletter` | 52.9% | 79.7% | -26.800000000000004 | 885 | ⚠ |
| `year__album_directorscut` | 45.6% | 62.4% | -16.799999999999997 | 693 | ⚠ |
| `album__album_boysbe` | 75.5% | 91.9% | -16.400000000000006 | 788 | ⚠ |
| `lyricist__album_al1` | 59.8% | 75.6% | -15.799999999999997 | 651 | ⚠ |
| `albumCrop__album_boysbe` | 75.4% | 91% | -15.599999999999994 | 69 | ⚠ |
| `unitSong__album_goingseventeen` | 67.5% | 82.4% | -14.900000000000006 | 120 |  |
| `year__album_goingseventeen` | 47.6% | 62.4% | -14.799999999999997 | 994 |  |
| `year__album_boysbe` | 47.9% | 62.4% | -14.5 | 838 |  |
| `timeline__album_directorscut` | 67.1% | 81.5% | -14.400000000000006 | 82 |  |
| `notInAlbum__album_sector17` | 62.1% | 76% | -13.899999999999999 | 87 |  |
| `album__album_directorscut` | 78.5% | 91.9% | -13.400000000000006 | 673 |  |
| `albumType__album_wonu_mingyu_bittersweet` | 66.4% | 79.7% | -13.299999999999997 | 709 |  |
| `albumType__album_directorscut` | 67.9% | 79.7% | -11.799999999999997 | 682 |  |
| `albumCrop__album_anode` | 80% | 91% | -11 | 30 |  |
| `album__album_youmademydawn` | 81.6% | 91.9% | -10.300000000000011 | 582 |  |
| `notInAlbum__album_al1` | 66.1% | 76% | -9.900000000000006 | 620 |  |
| `unitSong__album_boysbe` | 72.6% | 82.4% | -9.800000000000011 | 84 |  |
| `albumType__album_semicolon` | 70.6% | 79.7% | -9.100000000000009 | 868 |  |
| `year__album_vernon_blackeye` | 53.3% | 62.4% | -9.100000000000001 | 685 |  |
| `albumNumber__album_facethesun` | 72.1% | 80.5% | -8.400000000000006 | 513 |  |

## 4) 미처리 오류 제보 (5건)
| 시각 | 로케일 | 문제 맥락 | 내용 |
|---|---|---|---|
| 2026-07-30 | ko | memberRoster / member:dk / ✔디노 | 해당 문제에 오류가 있는 건 아니지만, 제보하기 버튼을 누르면 답안까지 함께 나와버리는 건 수정 불가능한 부분인가요! |
| 2026-07-30 | ko | memberRoster / member:the8 / ✔버논 | 퍼포 보컬 힙합으로 유닛 분류하는 것은 알지만, 이제 버논과 명호도 같은 유닛이라서 문제와 답안에 모순이 생기네요 ㅠㅠㅋㅋㅋ |
| 2026-07-27 | ko | lyricist / album:al1 / ✔버논 | 에스쿱스 |
| 2026-07-27 | ko | lyricist / album:al1 / ✔버논 | 버논이 아니고 에스쿱스,호시,정한,우지입니다 |
| 2026-07-27 | ko | lyricist / album:al1 / ✔버논 | 작사에 참여한 멤버는 우지,쿱스,정한,호시입니다 |
