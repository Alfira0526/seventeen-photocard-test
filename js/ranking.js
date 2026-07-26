/**
 * ranking.js — 랭킹 데이터 계층(로컬 + 원격 겸용).
 *
 * 기본은 로컬(localStorage) 저장이라 그 기기에서만 보인다.
 * `window.SVTRankingConfig` 로 원격 저장소를 붙이면 다른 PC/IP에서도 순위가 공유된다.
 *   예) window.SVTRankingConfig = { firebase: "https://<프로젝트>.firebaseio.com" };
 * 백엔드가 정해지면 js/ranking-config.js 한 줄만 채우면 되고, 없으면 자동으로 로컬 전용.
 *
 * 원격 어댑터: Firebase Realtime Database REST (append=POST, 조회=GET). CORS·키불필요(공개 규칙).
 * 원격 실패/미설정 시에도 로컬에는 항상 저장되어 게임이 끊기지 않는다.
 */
(function (root) {
  "use strict";
  if (!root) return;

  const LS = "svt-ranking";
  const cfg = root.SVTRankingConfig || {};
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; } },
    set(v) { try { localStorage.setItem(LS, JSON.stringify(v.slice(0, 300))); } catch (e) {} },
  };

  // ── 시즌 ──
  // 시즌 스케줄(js/season.js)이 현재/직전 시즌을 날짜 기반으로 계산한다.
  // 현재 시즌은 모드 키에 접미사(_s2, _s3 …)를 붙여 저장/조회하고, 직전 시즌은
  // legacy 로 조회한다(시즌2의 직전은 오픈베타=접미사 없음).
  // → Firebase 규칙(rankings/$mode/$id)을 그대로 재사용(규칙 재설정 불필요).
  function curSuffix() { return (root.SVTSeason ? root.SVTSeason.active().suffix : "_s2"); }
  function prevSuffix() { return (root.SVTSeason ? root.SVTSeason.previous().suffix : ""); }
  function skey(mode, legacy) { return mode + (legacy ? prevSuffix() : curSuffix()); }

  const idOf = (e) => `${e.mode}|${e.name}|${e.score}|${e.ts}`;
  function dedupeSort(list, mode) {
    const seen = new Set(), out = [];
    for (const e of list) {
      if (!e || (mode && e.mode !== mode)) continue;
      const k = idOf(e);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    out.sort((a, b) => b.score - a.score || (a.ts || 0) - (b.ts || 0));
    return out;
  }

  // ── 로컬 ──
  function localAdd(entry) { const l = store.get(); l.push(entry); store.set(l); }
  function localList(mode) { return dedupeSort(store.get(), mode); }

  // ── 원격(Firebase RTDB REST) ──
  const fb = cfg.firebase ? String(cfg.firebase).replace(/\/$/, "") : null;
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }
  async function remoteList(mode) {
    const res = await withTimeout(fetch(`${fb}/rankings/${encodeURIComponent(mode)}.json`), 4000);
    if (!res.ok) throw new Error("http " + res.status);
    const obj = await res.json();
    return obj ? Object.keys(obj).map((k) => obj[k]) : [];
  }
  async function remoteAdd(entry) {
    await withTimeout(fetch(`${fb}/rankings/${encodeURIComponent(entry.mode)}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry),
    }), 4000);
  }

  const api = {
    remote: !!fb,
    // 현재 시즌(기본) 또는 지난 시즌(opts.legacy) 로컬 순위
    localList(mode, opts) { return dedupeSort(store.get(), skey(mode, opts && opts.legacy)); },
    // 특정 모드 순위(원격+로컬 병합, 점수 내림차순). 원격 실패 시 로컬만.
    async list(mode, opts) {
      const sk = skey(mode, opts && opts.legacy);
      const local = dedupeSort(store.get(), sk);
      if (!fb) return local;
      try {
        const rem = await remoteList(sk);
        return dedupeSort(local.concat(rem), sk);
      } catch (e) { return local; }
    },
    // 기록 추가: 현재 시즌 키로 로컬 즉시 저장 + (설정 시) 원격 append
    async add(entry) {
      const sid = root.SVTSeason ? root.SVTSeason.active().id : "s2";
      const e = Object.assign({}, entry, { mode: skey(entry.mode), season: sid });
      localAdd(e);
      if (fb) { try { await remoteAdd(e); } catch (err) {} }
      return e;
    },
    // 모드별 기록 수(현재 시즌 기준, 롤링 노출 조건 판단)
    async counts(modes) {
      const out = {};
      await Promise.all(modes.map(async (m) => { out[m] = (await api.list(m)).length; }));
      return out;
    },
  };
  root.SVTRanking = api;
})(typeof window !== "undefined" ? window : null);
