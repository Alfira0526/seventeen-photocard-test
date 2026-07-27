# 운영 스냅샷 (2026-07-27 02:09Z)

> 이 파일은 GitHub Actions(ops-snapshot)가 Firebase에서 자동 생성합니다. 주간 리뷰 루틴이 읽습니다.

## 1) 모드 이용률
| 모드 | 시작(plays) | 완료(games) | 비중 |
|---|---:|---:|---:|
| endless | 1695 | 1605 | 15% |
| normal | 7358 | 3457 | 65% |
| timeattack | 2266 | 914 | 20% |

## 2) 문제 유형별 정답률 (낮은 순)
| 유형 | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| ytYear | 2546 | 4507 | 56.5% |
| memberLyricist | 769 | 1247 | 61.7% |
| year | 7870 | 12562 | 62.6% |
| notInAlbum | 1661 | 2319 | 71.6% |
| lyricist | 1585 | 2116 | 74.9% |
| albumType | 9951 | 12536 | 79.4% |
| albumNumber | 7064 | 8788 | 80.4% |
| unitSong | 996 | 1214 | 82% |
| memberNotSong | 10654 | 12679 | 84% |
| memberUnitSong | 10660 | 12691 | 84% |
| laterAlbum | 11686 | 13341 | 87.6% |
| album | 9641 | 10502 | 91.8% |
| memberRoster | 9146 | 9615 | 95.1% |
| titleTrack | 11889 | 12457 | 95.4% |
| ytSong | 6474 | 6710 | 96.5% |

## 3) 이상문제 후보 (표본 8+ · 정답률 낮은 순 상위 20 → 데이터 오류 의심)
| 문제키(typeId__kind_ref) | 정답 | 응답 | 정답률 |
|---|---:|---:|---:|
| `year__album_boysbe` | 274 | 583 | 47% |
| `year__album_directorscut` | 259 | 538 | 48.1% |
| `year__album_goingseventeen` | 333 | 688 | 48.4% |
| `albumType__album_loveandletter` | 270 | 556 | 48.6% |
| `ytYear__yt_yt_blackeye` | 609 | 1156 | 52.7% |
| `year__album_vernon_blackeye` | 281 | 528 | 53.2% |
| `memberLyricist__member_hoshi` | 330 | 609 | 54.2% |
| `ytYear__yt_yt_ruby` | 636 | 1138 | 55.9% |
| `year__album_dino_wait` | 302 | 537 | 56.2% |
| `year__album_semicolon` | 331 | 589 | 56.2% |
| `year__album_youmademydawn` | 244 | 432 | 56.5% |
| `lyricist__album_al1` | 249 | 438 | 56.8% |
| `year__album_wonu_mingyu_bittersweet` | 312 | 545 | 57.2% |
| `year__album_woozi_ruby` | 301 | 524 | 57.4% |
| `year__album_teenage` | 181 | 315 | 57.5% |
| `ytYear__yt_yt_wait` | 644 | 1109 | 58.1% |
| `year__album_henggarae` | 180 | 308 | 58.4% |
| `year__album_hoshi_spider` | 301 | 514 | 58.6% |
| `year__album_attacca` | 261 | 439 | 59.5% |
| `ytYear__yt_yt_spider` | 657 | 1104 | 59.5% |

## 4) 미처리 오류 제보 (5건)
| 시각 | 로케일 | 문제 맥락 | 내용 |
|---|---|---|---|
| 2026-07-26 | ko | albumType / album:loveandletter / ✔정규 앨범 | 1집 정규 리패키지 앨범인데 정답이 정규앨범으로 되어있어요 |
| 2026-07-26 | ko | memberRoster / member:joshua / ✔호시 |  |
| 2026-07-26 | ko | titleTrack / album:fml / ✔손오공 (Super) |  |
| 2026-07-26 | ko | - | love&letter 앨범 리패키지인데 정규로 들어가있어요 |
| 2026-07-26 | ko | - | test |
