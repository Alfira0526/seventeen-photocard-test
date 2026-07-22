/**
 * ranking-config.js — 랭킹 저장소 설정.
 *
 * 기본값(빈 설정)은 "로컬 전용" — 그 기기에서만 순위가 보인다.
 * 다른 PC/IP에서도 공유하려면 아래에 원격 저장소를 지정한다:
 *   window.SVTRankingConfig = { firebase: "https://<프로젝트>-default-rtdb.firebaseio.com" };
 * (Firebase Realtime Database를 만들고, 규칙에서 rankings 읽기/쓰기를 공개로 열면 됨)
 */
window.SVTRankingConfig = {};
