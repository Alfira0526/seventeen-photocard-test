/**
 * announce.js — 업데이트 공지 팝업(사용자당 1회).
 *
 * 버전 키(ANNOUNCE_VER)로 "이 버전 공지를 봤는지"를 저장한다. 다음 업데이트 때
 * 값만 바꾸면 다시 1회 노출된다. localStorage 실패(사파리 프라이빗 등) 시
 * sessionStorage 로 폴백해 최소한 세션 내 중복은 막는다.
 *
 * UI 는 기존 .modal-overlay 컴포넌트를 재사용하며(#announce-modal), 문구는
 * data-i18n 으로 i18n 엔진이 채운다(언어 전환에도 자동 대응). game.js 와는
 * 결합하지 않고, CTA 는 노멀 모드 버튼을 프로그램적으로 클릭한다.
 */
(function () {
  "use strict";
  var ANNOUNCE_VER = "2026-07-v12-s2"; // 공지 버전(내용 바뀌면 이 값만 갱신)
  var KEY = "svt-announce-seen";

  function seen() {
    try { if (localStorage.getItem(KEY) === ANNOUNCE_VER) return true; } catch (e) {}
    try { if (sessionStorage.getItem(KEY) === ANNOUNCE_VER) return true; } catch (e) {}
    return false;
  }
  function markSeen() {
    try { localStorage.setItem(KEY, ANNOUNCE_VER); } catch (e) {}
    try { sessionStorage.setItem(KEY, ANNOUNCE_VER); } catch (e) {}
  }

  function el(id) { return document.getElementById(id); }
  function show() { var m = el("announce-modal"); if (m) m.hidden = false; }
  function hide() { var m = el("announce-modal"); if (m) m.hidden = true; markSeen(); }

  function init() {
    var m = el("announce-modal");
    if (!m) return;
    if (window.__SVT_NO_ANNOUNCE) return; // 테스트/자동화에서 공지 억제
    var close = el("announce-close");
    var cta = el("announce-cta");
    if (close) close.addEventListener("click", hide);
    if (cta) cta.addEventListener("click", function () {
      hide();
      var b = document.querySelector('.mode-btn[data-mode="normal"]');
      if (b) b.click(); // 노멀 모드 바로 시작(기능 체감 유도)
    });
    // 배경 클릭 닫기
    m.addEventListener("click", function (e) { if (e.target === m) hide(); });
    // ESC 닫기
    document.addEventListener("keydown", function (e) {
      if (!m.hidden && (e.key === "Escape" || e.key === "Esc")) hide();
    });

    // 최초 1회: 로드 직후 시작 화면이 활성 → 시작 화면에서만 노출
    if (!seen()) setTimeout(show, 450);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
