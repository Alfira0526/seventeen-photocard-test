/**
 * geo.js — 접속 지역 기반 로케일 자동 선택.
 *
 * 우선순위: ① 사용자가 고른 언어(localStorage) > ② IP 지역(국가코드) > ③ 브라우저 언어 > ④ en
 * IP 조회는 무료 공개 API를 순차 시도하고, 실패/차단 시 조용히 브라우저 언어로 폴백한다.
 * (정적 사이트라 서버가 없어 지역 판별은 클라이언트에서 수행)
 *
 * 결정된 로케일은 window.I18N.setLocale 로 반영된다. IP 조회는 비동기라,
 * 우선 브라우저 언어로 즉시 적용한 뒤 지역 결과가 오면(시작화면 한정) 갱신한다.
 */
(function (root) {
  "use strict";
  if (!root) return;
  const I18N = root.I18N;
  if (!I18N) return;

  const LS_LANG = "svt-lang";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // 무료 IP 지역 조회 엔드포인트(순차 폴백). 국가코드만 뽑아 쓴다.
  // CORS 허용 + 키 불필요한 곳 우선. 하나라도 성공하면 그 결과를 사용.
  const IP_ENDPOINTS = [
    { url: "https://api.country.is/", pick: (j) => j && j.country },
    { url: "https://ipwho.is/", pick: (j) => j && j.country_code },
    { url: "https://ipapi.co/json/", pick: (j) => j && j.country_code },
    { url: "https://get.geojs.io/v1/ip/country.json", pick: (j) => j && j.country },
  ];

  function browserLocale() {
    try {
      const langs = navigator.languages || [navigator.language];
      for (const l of langs) { const m = I18N.localeFromLang(l); if (m) return m; }
    } catch (e) {}
    return "en";
  }

  async function fetchCountryLocale() {
    for (const ep of IP_ENDPOINTS) {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(ep.url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        clearTimeout(to);
        if (!res.ok) continue;
        const json = await res.json();
        const cc = ep.pick(json);
        const loc = I18N.localeFromCountry(cc);
        if (loc) return loc;
        // 지역은 알았지만 지원 언어가 아니면 영어로(그 지역 사용자는 보통 영어 병기가 유효)
        if (cc) return "en";
      } catch (e) { /* 다음 엔드포인트 */ }
    }
    return null;
  }

  const api = {
    LS_LANG,
    saved() { return store.get(LS_LANG); },
    // 사용자가 수동 선택 → 저장 + 즉시 반영
    choose(code) {
      store.set(LS_LANG, code);
      I18N.setLocale(code);
      return code;
    },
    // 자동 감지 시작: 즉시 브라우저 언어, 이어서 IP 지역으로 보정(수동선택 없을 때만)
    // onRefine(code): 지역 보정이 실제로 로케일을 바꿨을 때 호출(시작화면 재렌더용)
    async init(onRefine) {
      const manual = store.get(LS_LANG);
      if (manual && I18N.SUPPORTED.indexOf(manual) >= 0) {
        I18N.setLocale(manual);
        return manual;
      }
      // 1) 즉시 브라우저 언어
      const guess = browserLocale();
      I18N.setLocale(guess);
      // 2) IP 지역 보정(비동기) — 실제 적용은 호출측이 판단(플레이 중 전환 방지)
      try {
        const geo = await fetchCountryLocale();
        if (geo && geo !== I18N.locale && !store.get(LS_LANG)) {
          if (typeof onRefine === "function") onRefine(geo);
          else I18N.setLocale(geo);
        }
      } catch (e) {}
      return I18N.locale;
    },
  };

  root.SVTGeo = api;
})(typeof window !== "undefined" ? window : null);
