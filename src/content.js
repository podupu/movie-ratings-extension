/* global MR_SITES, MR_readTitle */
(() => {
  const site = MR_SITES.find(
    (s) => s.host.test(location.hostname) && (!s.path || s.path.test(location.pathname))
  );
  if (!site) return;

  const kind = site.kind || 'cinema';
  let settings = { minRating: 7, minVotes: 10000 };

  chrome.storage.sync.get(['minRating', 'minVotes', 'ottEnabled'], (s) => {
    if (kind === 'ott' && s.ottEnabled === false) return;
    if (s.minRating != null) settings.minRating = Number(s.minRating);
    if (s.minVotes != null) settings.minVotes = Number(s.minVotes);
    start();
  });

  // "Godzilla Minus Zero  (Japanese, Eng Sub)" -> "Godzilla Minus Zero"
  // "Wicker MA15+" -> "Wicker"
  function cleanTitle(raw) {
    return raw
      .replace(/\s+/g, ' ')
      .replace(/\s*[([].*?[)\]]\s*/g, ' ')
      .replace(/\s+(G|PG|M|MA ?15\+|R ?18\+|CTC|TBC|E)$/i, '')
      .trim();
  }

  function readTitle(el) {
    if (site.getTitle) return site.getTitle(el) || '';
    if (kind === 'ott') return MR_readTitle(el);
    return cleanTitle(el.textContent || '');
  }

  function formatVotes(n) {
    if (n == null) return '';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function makeBadge() {
    const b = document.createElement('span');
    b.className = 'mr-badge mr-loading';
    b.setAttribute('role', 'link');
    b.textContent = 'IMDb …';
    // Badges sit inside the site's links/cards, and several streaming apps
    // navigate or open previews on pointerdown, so swallow those too.
    const swallow = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart'].forEach((t) =>
      b.addEventListener(t, swallow, true)
    );
    b.addEventListener('click', (e) => {
      swallow(e);
      if (b.dataset.href) window.open(b.dataset.href, '_blank', 'noopener');
      else if (b.dataset.action === 'options') chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    }, true);
    return b;
  }

  function render(badge, res) {
    badge.classList.remove('mr-loading');
    if (!res || res.error) {
      if (res && res.error === 'NO_KEY') {
        badge.textContent = 'IMDb: add API key';
        badge.title = 'Click to open settings';
        badge.dataset.action = 'options';
        badge.classList.add('mr-warn');
      } else {
        badge.textContent = 'IMDb ?';
        badge.title = (res && res.error) || 'Lookup failed';
        badge.classList.add('mr-muted');
      }
      return;
    }
    if (res.notFound || res.imdbRating == null) {
      badge.textContent = 'IMDb –';
      badge.title = res.notFound ? 'Not found on IMDb' : 'No rating yet';
      badge.classList.add('mr-muted');
      if (res.imdbID) badge.dataset.href = `https://www.imdb.com/title/${res.imdbID}/`;
      return;
    }
    const { imdbRating: r, imdbVotes: v } = res;
    badge.textContent = `IMDb ★ ${r.toFixed(1)}`;
    const votes = document.createElement('span');
    votes.className = 'mr-votes';
    votes.textContent = formatVotes(v);
    badge.appendChild(votes);

    const extra = [];
    if (res.rottenTomatoes) extra.push(`Rotten Tomatoes ${res.rottenTomatoes}`);
    if (res.metacritic) extra.push(`Metacritic ${res.metacritic}`);
    const what = res.type === 'series' ? 'TV series, ' : '';
    badge.title = `${res.title} (${what}${res.year}) – ${(v || 0).toLocaleString()} votes` +
      (extra.length ? `\n${extra.join(' · ')}` : '');
    badge.dataset.href = `https://www.imdb.com/title/${res.imdbID}/`;

    const trusted = (v || 0) >= settings.minVotes;
    if (r >= settings.minRating && trusted) badge.classList.add('mr-good');
    else if (r < settings.minRating - 1) badge.classList.add('mr-poor');
    if (!trusted) badge.classList.add('mr-few');
  }

  // Overlay mode: pin the badge to the poster's container.
  function overlayHost(el) {
    const img = el.querySelector('img');
    let host = (img && img.parentElement) || el;
    // Skip inline wrappers such as <picture>: they can't anchor an overlay.
    while (host !== el && host.parentElement && getComputedStyle(host).display === 'inline') {
      host = host.parentElement;
    }
    const style = getComputedStyle(host);
    if (style.position === 'static' && style.display !== 'inline') host.classList.add('mr-host');
    return host;
  }

  // el -> { title, badge, requested }. Streaming rows are virtualised: the same
  // node is reused for a different title, and frameworks may drop our badge.
  const tracked = new WeakMap();

  // Only look titles up once they are (nearly) on screen, to save API quota.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      request(entry.target);
    });
  }, { rootMargin: '200px' });

  function request(el) {
    const t = tracked.get(el);
    if (!t || t.requested) return;
    t.requested = true;
    const { title, badge } = t;
    chrome.runtime.sendMessage({ type: 'GET_RATING', title, kind }, (res) => {
      if (chrome.runtime.lastError) res = { error: chrome.runtime.lastError.message };
      if (tracked.get(el) === t) render(badge, res);
    });
  }

  function scan() {
    document.querySelectorAll(site.title).forEach((el) => {
      const title = readTitle(el);
      const prev = tracked.get(el);
      if (prev && prev.title === title && prev.badge.isConnected) return;
      if (prev) prev.badge.remove();
      if (!title) {
        tracked.delete(el);
        return;
      }

      const badge = makeBadge();
      if (site.overlay) {
        badge.classList.add('mr-overlay');
        overlayHost(el).appendChild(badge);
      } else {
        const anchor = (site.anchor && site.anchor(el)) || el;
        anchor.insertAdjacentElement('afterend', badge);
      }
      tracked.set(el, { title, badge, requested: false });
      io.unobserve(el);
      io.observe(el);
    });
  }

  // Sites load listings dynamically (date tabs, filters, infinite scroll).
  // Streaming apps mutate constantly (trailers, hover previews), so a plain
  // debounce could postpone scanning forever: also cap the wait at 1s.
  function start() {
    scan();
    let timer = null;
    let firstAt = 0;
    const run = () => {
      clearTimeout(timer);
      timer = null;
      firstAt = 0;
      scan();
    };
    const isBadge = (n) => n.nodeType === 1 && n.classList.contains('mr-badge');
    const inBadge = (n) => {
      const e = n.nodeType === 1 ? n : n.parentElement;
      return !!(e && e.closest('.mr-badge'));
    };
    // Mutations we caused ourselves (inserting/filling badges) don't need a rescan.
    // A badge being *removed* does: the site re-rendered and dropped it.
    const ours = (m) => {
      if (inBadge(m.target)) return true;
      return m.type === 'childList' && m.removedNodes.length === 0 &&
        m.addedNodes.length > 0 && [...m.addedNodes].every(isBadge);
    };
    new MutationObserver((mutations) => {
      if (mutations.every(ours)) return;
      const now = Date.now();
      if (!firstAt) firstAt = now;
      clearTimeout(timer);
      timer = now - firstAt >= 1000 ? (run(), null) : setTimeout(run, 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'alt', 'href'] });
  }
})();
