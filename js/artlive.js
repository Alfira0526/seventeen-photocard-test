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

  const cache = {}; // id -> url (성공만 캐시. 실패는 캐시하지 않아 다음에 재시도)
  const pending = {}; // id -> Promise (동시 중복 요청 방지)
  const COUNTRY = "us"; // 영문 아티스트명 → 매칭 안정적
  const TIMEOUT = 8000;
  const ARTIST_ALIASES = { seventeen: ["seventeen", "세븐틴"] };

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

  // 아티스트 정확 매칭(오매칭 방지). "vernon"이 "nicholas vernon"에 붙지 않도록
  // 부분포함(includes)은 쓰지 않고, 정확일치 또는 접두(예: "wonwoo, mingyu")만 허용.
  function artistOk(resultArtist, albumArtist) {
    const a = norm(resultArtist), b = norm(albumArtist);
    if (a === b || a.startsWith(b)) return true;
    const aliases = ARTIST_ALIASES[b];
    return aliases ? aliases.some((x) => { const n = norm(x); return a === n || a.startsWith(n); }) : false;
  }

  function pickBest(album, results) {
    const artist = album.artist || "SEVENTEEN";
    const byArtist = results.filter((r) => artistOk(r.artistName || "", artist));
    if (!byArtist.length) return null; // 아티스트 일치 없으면 매칭 실패(placeholder)
    let best = null, bestScore = 0;
    for (const r of byArtist) {
      let score = similarity(album.title, r.collectionName || "");
      if ((r.releaseDate || "").slice(0, 4) === String(album.year)) score += 0.3;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return bestScore >= 0.6 && best ? best : null; // 임계값 상향(오매칭 방지)
  }

  function searchUrl(term) {
    return "https://itunes.apple.com/search?" +
      new URLSearchParams({ term, entity: "album", country: COUNTRY, limit: "20" });
  }

  // 1회만 시도(레이트리밋 회피). 실패는 성공 캐시가 안 되므로 다음에 자연히 재시도됨.
  async function fetchResults(term) {
    try { const data = await jsonp(searchUrl(term)); return (data && data.results) || []; }
    catch (e) { return null; }
  }

  // 검색어를 바꿔가며(힌트 → 제목) 매칭 시도
  async function resolve(album) {
    const artist = album.artist || "SEVENTEEN";
    const terms = [];
    if (album.itunes) terms.push(artist + " " + album.itunes);
    terms.push(artist + " " + album.title);
    // 솔로/유닛은 'SEVENTEEN' 문맥을 더해 정확한 릴리스 노출 확률↑(결과 필터는 엄격 유지)
    if (artist !== "SEVENTEEN") terms.push("SEVENTEEN " + artist + " " + (album.itunes || album.title));
    for (const term of terms) {
      const results = await fetchResults(term);
      if (results) { const m = pickBest(album, results); if (m) return hi(m.artworkUrl100); }
    }
    return null;
  }

  // album -> Promise<url|null>. 성공한 URL만 캐시(실패는 다음에 재시도), 동시요청은 dedup.
  function get(album) {
    if (cache[album.id]) return Promise.resolve(cache[album.id]);
    if (pending[album.id]) return pending[album.id];
    pending[album.id] = resolve(album)
      .then((u) => { if (u) cache[album.id] = u; delete pending[album.id]; return u || null; })
      .catch(() => { delete pending[album.id]; return null; });
    return pending[album.id];
  }

  // 덱 프리페치: 시작 시 미리 불러와 라운드 도달 전에 준비(레이트리밋 회피 위해 stagger)
  function prefetch(albums) {
    (albums || []).forEach((al, i) => {
      if (!al || al.art || cache[al.id]) return;
      setTimeout(() => { get(al); }, i * 180);
    });
  }

  // 캐시/진행 요청을 비워 다음 get()이 새로 시도하게 함(수동 재로딩용)
  function reload(album) {
    delete cache[album.id];
    delete pending[album.id];
  }

  window.SVTArtLive = { get, prefetch, reload };
})();
