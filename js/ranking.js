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

  const LS = "svt-ranking" + (root.SVT_DATA_PREFIX ? "-staging" : "");
  const cfg = root.SVTRankingConfig || {};
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; } },
    set(v) { try { localStorage.setItem(LS, JSON.stringify(v.slice(0, 300))); } catch (e) {} },
  };

  // ── 시즌 키 ──
  // 저장/조회 키 = 모드 + 접미사. 접미사는 시즌 스케줄(season.js)이 준다.
  //  · 현재 달   : SVTSeason.active().suffix  (예: "_202608")
  //  · 지난 달   : SVTSeason.previous().suffix
  //  · 분기 누적 : SVTSeason.quarterMonths()  (여러 달 접미사 병합)
  //  · 오픈베타  : "" (구 100점제, 접미사 없음)
  // → Firebase 규칙(rankings/$mode/$id)을 그대로 재사용(규칙 재설정 불필요).
  function activeSuffix() { return (root.SVTSeason ? root.SVTSeason.active().suffix : ""); }
  // opts: {suffix} 단일 지정 · {suffixes:[...]} 병합(분기 누적) · 없으면 현재 달
  function keysFor(mode, opts) {
    let sufs;
    if (opts && opts.suffixes) sufs = opts.suffixes;
    else if (opts && opts.suffix != null) sufs = [opts.suffix];
    else sufs = [activeSuffix()];
    return sufs.map((s) => mode + s);
  }

  const idOf = (e) => `${e.mode}|${e.name}|${e.score}|${e.ts}`;
  // keys: 허용할 e.mode 값 집합(여러 달 병합 가능). null 이면 전체.
  function dedupeSort(list, keys) {
    const allow = keys ? new Set(keys) : null;
    const seen = new Set(), out = [];
    for (const e of list) {
      if (!e || (allow && !allow.has(e.mode))) continue;
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

  // ── 원격(Firebase RTDB REST) ──
  const fb = cfg.firebase ? String(cfg.firebase).replace(/\/$/, "") : null;
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }
  // 테스트베드 데이터 격리: 스테이징이면 경로 앞에 "staging/" (없으면 프로덕션 그대로)
  const NS = () => (root.SVT_DATA_PREFIX || "");
  async function remoteKey(key) {
    const res = await withTimeout(fetch(`${fb}/${NS()}rankings/${encodeURIComponent(key)}.json`), 4000);
    if (!res.ok) throw new Error("http " + res.status);
    const obj = await res.json();
    return obj ? Object.keys(obj).map((k) => obj[k]) : [];
  }
  async function remoteAdd(entry) {
    await withTimeout(fetch(`${fb}/${NS()}rankings/${encodeURIComponent(entry.mode)}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry),
    }), 4000);
  }

  const api = {
    remote: !!fb,
    // 로컬 순위(기본=현재 달 · opts.suffix/suffixes 로 다른 시즌/분기)
    localList(mode, opts) { return dedupeSort(store.get(), keysFor(mode, opts)); },
    // 원격+로컬 병합 순위(점수 내림차순). 원격 실패 시 로컬만.
    async list(mode, opts) {
      const keys = keysFor(mode, opts);
      const local = dedupeSort(store.get(), keys);
      if (!fb) return local;
      try {
        const rems = await Promise.all(keys.map(remoteKey));
        let merged = local;
        rems.forEach((r) => { merged = merged.concat(r); });
        return dedupeSort(merged, keys);
      } catch (e) { return local; }
    },
    // 기록 추가: 현재 달 키로 로컬 즉시 저장 + (설정 시) 원격 append
    async add(entry) {
      const ym = root.SVTSeason ? root.SVTSeason.active().ym : "";
      const e = Object.assign({}, entry, { mode: entry.mode + activeSuffix(), season: ym });
      localAdd(e);
      if (fb) { try { await remoteAdd(e); } catch (err) {} }
      return e;
    },
    // 모드별 기록 수(현재 달 기준)
    async counts(modes) {
      const out = {};
      await Promise.all(modes.map(async (m) => { out[m] = (await api.list(m)).length; }));
      return out;
    },
  };
  root.SVTRanking = api;
})(typeof window !== "undefined" ? window : null);
