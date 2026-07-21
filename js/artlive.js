/**
 * artlive.js — 브라우저에서 앨범 자켓을 "실시간으로" 불러오는 폴백.
 *
 * js/albumArt.js(사전 베이크)가 있으면 그걸 우선 쓰고, 없으면 여기서
 * iTunes Search API를 JSONP로 호출해 자켓 URL을 즉석에서 가져온다.
 * → 사용자가 아무 설치 없이 index.html만 열어도(또는 GitHub Pages) 자켓이 뜬다.
 *
 * JSONP를 쓰는 이유: <script> 로드는 CORS 제약이 없어 file://·정적호스팅에서 모두 동작.
 * 실패/차단/오프라인이면 조용히 null 반환 → 게임은 플레이스홀더로 폴백.
 */
(function () {
  "use strict";

  const cache = {}; // id -> url|null (완료)
  const pending = {}; // id -> Promise
  const COUNTRY = "kr";
  const TIMEOUT = 6000;

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.8;
    const setB = new Set(b); let hit = 0;
    for (const ch of new Set(a)) if (setB.has(ch)) hit++;
    return hit / new Set(a + b).size;
  }
  function hi(url) { return url ? url.replace(/\/\d+x\d+bb\.(jpg|png)/, "/600x600bb.$1") : null; }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "__svtart_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, TIMEOUT);
      function cleanup() { try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); clearTimeout(timer); }
      window[cb] = (data) => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error("script error")); };
      s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + cb;
      document.head.appendChild(s);
    });
  }

  function pickBest(album, results) {
    const svt = results.filter((r) => norm(r.artistName || "") === norm("SEVENTEEN"));
    const pool = svt.length ? svt : results;
    let best = null, bestScore = 0;
    for (const r of pool) {
      let score = similarity(album.title, r.collectionName || "");
      if ((r.releaseDate || "").slice(0, 4) === String(album.year)) score += 0.25;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return bestScore >= 0.45 && best ? best : null;
  }

  async function search(album) {
    const term = "SEVENTEEN " + (album.itunes || album.title);
    const url = "https://itunes.apple.com/search?" +
      new URLSearchParams({ term, entity: "album", country: COUNTRY, limit: "20" });
    const data = await jsonp(url);
    const match = pickBest(album, (data && data.results) || []);
    return match ? hi(match.artworkUrl100) : null;
  }

  // album -> Promise<url|null>. 앨범별 1회만 요청하고 캐시.
  function get(album) {
    if (album.id in cache) return Promise.resolve(cache[album.id]);
    if (pending[album.id]) return pending[album.id];
    pending[album.id] = search(album)
      .then((u) => { cache[album.id] = u || null; delete pending[album.id]; return cache[album.id]; })
      .catch(() => { cache[album.id] = null; delete pending[album.id]; return null; });
    return pending[album.id];
  }

  window.SVTArtLive = { get };
})();
