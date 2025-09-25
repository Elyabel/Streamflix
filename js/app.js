document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- TMDB config ----
  const TMDB = {
    API_KEY: 'e4b90327227c88daac14c0bd0c1f93cd',
    BASE_URL: 'https://api.themoviedb.org/3',
    IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
    TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNGI5MDMyNzIyN2M4OGRhYWMxNGMwYmQwYzFmOTNjZCIsIm5iZiI6MTc1ODY0ODMyMS43NDg5OTk4LCJzdWIiOiI2OGQyZDgwMTJhNWU3YzBhNDVjZWNmZWUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.aylEitwtAH0w4XRk8izJNNkF_bet8sxiC9iI-zSdHbU'
  };

  // Generic fetch helper
  function tmdbFetch(path, params = {}, init = {}) {
    const url = new URL(TMDB.BASE_URL + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
    url.searchParams.set('language', 'fr-FR');
    return fetch(url.toString(), {
      ...init,
      headers: {
        'Authorization': `Bearer ${TMDB.TOKEN}`,
        'Accept': 'application/json',
        ...(init.headers || {})
      }
    }).then(res => {
      if (!res.ok) throw new Error('TMDB ' + res.status);
      return res.json();
    });
  }

  // ---- Simple genre buckets (for tabs) ----
  const GENRE_BUCKET = {
    28: 'action', 12: 'action', 53: 'action',
    18: 'drama', 80: 'drama', 10749: 'drama',
    878: 'scifi', 14: 'scifi'
  };

  function toMovie(m) {
    const title = m.title || m.name || 'Sans titre';
    const year = (m.release_date || m.first_air_date || '').slice(0, 4) || '—';
    const rating = typeof m.vote_average === 'number' ? m.vote_average.toFixed(1) : '—';
    const poster = m.poster_path ? `${TMDB.IMAGE_BASE_URL}/w500${m.poster_path}` : '';
    const backdrop = m.backdrop_path ? `${TMDB.IMAGE_BASE_URL}/w1280${m.backdrop_path}` : poster;
    let genre = 'other';
    if (Array.isArray(m.genre_ids)) {
      for (const id of m.genre_ids) { if (GENRE_BUCKET[id]) { genre = GENRE_BUCKET[id]; break; } }
    }
    return { id: m.id, title, year, rating, img: poster || '', backdrop, overview: m.overview || '', genre };
  }

  const STATE = { trending: [], now: [], activeFilter: 'all' };

  // ---- Placeholders ----
  const PLACEHOLDER = [
    { id: 1, title: 'Inception', year: '2010', rating: '8.8', img: 'https://picsum.photos/seed/inception/600/900', backdrop: 'https://picsum.photos/seed/incback/1280/720', overview: 'Un voleur infiltre les rêves…', genre: 'scifi' },
    { id: 2, title: 'Interstellar', year: '2014', rating: '8.6', img: 'https://picsum.photos/seed/inter/600/900', backdrop: 'https://picsum.photos/seed/interb/1280/720', overview: 'Au-delà des étoiles.', genre: 'scifi' },
    { id: 3, title: 'Mad Max: Fury Road', year: '2015', rating: '8.1', img: 'https://picsum.photos/seed/madmax/600/900', backdrop: 'https://picsum.photos/seed/madback/1280/720', overview: 'Course folle dans le désert.', genre: 'action' },
    { id: 4, title: 'Joker', year: '2019', rating: '8.4', img: 'https://picsum.photos/seed/joker/600/900', backdrop: 'https://picsum.photos/seed/jokb/1280/720', overview: 'Origines d’un clown tragique.', genre: 'drama' },
  ];
  // Premier rendu immédiat
  renderGrid('#trendingGrid', PLACEHOLDER);
  renderGrid('#newGrid', PLACEHOLDER);

  // ---- Modal ----
  const modal = $('#movieModal');
  const modalTitle = $('#modalTitle');
  const modalGenre = $('#modalGenre');
  const modalDesc = $('#modalDesc');
  const modalPanel = $('.modal__panel');
  let lastFocused = null;
  let currentMovie = null;
  const playBtn = document.getElementById('playTrailerBtn');

  async function playTrailer() {
    if (!currentMovie) return;

    let win = null;
    try {
      if (win && win.document) {
        try {
          win.document.title = 'Chargement de la bande-annonce…';
          win.document.body.innerHTML = '<p style="font-family:system-ui;padding:16px">Chargement de la bande-annonce…</p>';
        } catch(_) {}
      }
    } catch(_) {
      win = null;
    }

    const navigateTo = (url) => {
      if (win && !win.closed) {
        try { win.location.href = url; return; } catch(_) {}
      }
      window.location.href = url;
    };

    const searchFallback = () => {
      const q = encodeURIComponent((currentMovie.title || '') + ' trailer');
      navigateTo(`https://www.youtube.com/results?search_query=${q}`);
    };

    try {
      let data = await tmdbFetch(`/movie/${currentMovie.id}/videos`, { language: 'fr-FR' });
      if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        data = await tmdbFetch(`/movie/${currentMovie.id}/videos`, { language: 'en-US' });
      }
      const results = (data && data.results) || [];
      const byType = (t) => results.filter(v => (v.site === 'YouTube') && new RegExp(t, 'i').test(v.type));
      const best = byType('Trailer')[0] || byType('Teaser')[0] || results.find(v => v.site === 'YouTube');
      if (best && best.key) {
        navigateTo(`https://www.youtube.com/watch?v=${best.key}`);
      } else {
        searchFallback();
      }
    } catch (e) {
      console.warn('Trailer fetch error', e);
      searchFallback();
    }
  }

  if (playBtn) playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    playTrailer();
  });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && (t.id === 'playTrailerBtn' || (t.closest && t.closest('#playTrailerBtn')))) {
      e.preventDefault();
      playTrailer();
    }
  }, { passive: false });

  function openModal(movie) {
    currentMovie = movie;
    lastFocused = document.activeElement;
    modalTitle.textContent = movie.title;
    modalGenre.textContent = (movie.genre || 'OTHER').toUpperCase();
    modalDesc.textContent = `${movie.year} • ★ ${movie.rating}` + (movie.overview ? ` — ${movie.overview}` : '');
    if (modalPanel) {
      modalPanel.style.backgroundImage =
          `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.85)), url('${movie.backdrop || movie.img || ''}')`;
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    const closeBtn = $('.modal__close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
  }


  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocused && document.body.contains(lastFocused)) lastFocused.focus();
  }

  // Fermer modal sur backdrop/bouton
  modal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-close') === 'true') closeModal();
  });
  // ESC pour fermer
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  // ---- Render helpers ----
  function renderGrid(selector, items) {
    const grid = $(selector);
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach((m, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${m.title} — détails`);
      card.style.animation = `fadeInUp .5s ${i * 40}ms both`;
      card.innerHTML = `
        <img class="card__img" src="${m.img || 'https://picsum.photos/seed/streamflix/600/900'}" alt="${m.title} (${m.year})">
        <div class="card__meta">
          <span class="badge">${(m.genre || 'OTHER').toUpperCase()}</span>
          <span class="kbd">★ ${m.rating}</span>
        </div>
      `;
      card.addEventListener('click', () => openModal(m));
      card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openModal(m); } });
      grid.appendChild(card);
    });
  }

  // ---- Keyframes for stagger ----
  const style = document.createElement('style');
  style.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}`;
  document.head.appendChild(style);

  // Les couches hero ne bloquent pas les clics
  $$('.hero__layer').forEach(el => { el.style.pointerEvents = 'none'; });

  // Nav tabs (header)
  const navTabs = $$('.nav .nav__tab');
  const navIndicator = $('.nav .nav__indicator');
  function updateIndicator(active) {
    if (!navIndicator || !active) return;
    const r = active.getBoundingClientRect();
    const parent = active.parentElement.getBoundingClientRect();
    navIndicator.style.transform = `translateX(${r.left - parent.left}px)`;
    navIndicator.style.width = r.width + 'px';
  }
  navTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      navTabs.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.getAttribute('data-target');
      if (target && document.querySelector(target)) {
        document.querySelector(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      updateIndicator(btn);
      const bc = document.getElementById('breadcrumbCurrent');
      if (bc) bc.textContent = btn.textContent.trim();
    });
  });
  updateIndicator($('.nav .nav__tab.is-active'));

  // Drawer mobile
  const menuToggle = $('#menuToggle');
  const drawer = $('#mobileMenu');
  if (menuToggle && drawer) {
    menuToggle.addEventListener('click', () => {
      const open = drawer.classList.toggle('is-open');
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    $$('.drawer__link', drawer).forEach(a => a.addEventListener('click', () => {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }));
  }

  // Theme switcher
  const themeChips = $$('.theme-switcher .chip');
  themeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const theme = chip.dataset.theme || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      themeChips.forEach(c => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      try { localStorage.setItem('streamflix-theme', theme); } catch {}
    });
  });
  try {
    const saved = localStorage.getItem('streamflix-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      const chip = document.querySelector(`.theme-switcher .chip[data-theme="${saved}"]`);
      if (chip) chip.setAttribute('aria-pressed', 'true');
    }
  } catch {}

  // Tabs section (Action / Drame / Sci-Fi)
  $$('.tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tabs .tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      STATE.activeFilter = btn.dataset.filter || 'all';
      const items = getMoviesFiltered(STATE.activeFilter);
      renderGrid('#trendingGrid', items);
    });
  });

  function getMoviesFiltered(filter) {
    const arr = STATE.trending.length ? STATE.trending : PLACEHOLDER;
    if (!filter || filter === 'all') return arr.slice(0, 12);
    return arr.filter(m => m.genre === filter).slice(0, 12);
  }

  // ---- Search ----
  const searchInput = $('#searchInput');
  if (searchInput) {
    let aborter = null;
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      if (!q || q.length < 2) {
        renderGrid('#trendingGrid', getMoviesFiltered(STATE.activeFilter));
        return;
      }
      try { if (aborter) aborter.abort(); } catch {}
      aborter = new AbortController();
      tmdbFetch('/search/movie', { query: q, include_adult: 'false', page: 1 }, { signal: aborter.signal })
          .then(d => renderGrid('#trendingGrid', (d.results || []).map(toMovie).slice(0, 12)))
          .catch(() => renderGrid('#trendingGrid', PLACEHOLDER.slice(0, 12)));
    });
  }

  // ---- Initial TMDB load ----
  Promise.all([
    tmdbFetch('/trending/movie/day', { page: 1 }),
    tmdbFetch('/movie/now_playing', { page: 1, region: 'FR' })
  ]).then(([trend, nowp]) => {
    STATE.trending = (trend.results || []).map(toMovie);
    STATE.now = (nowp.results || []).map(toMovie);

    renderGrid('#trendingGrid', getMoviesFiltered('all'));
    renderGrid('#newGrid', STATE.now.slice(0, 12));

    const heroPoster = $('.hero__poster');
    const top = STATE.trending[0];
    if (heroPoster && top) {
      heroPoster.src = top.img || heroPoster.src;
      heroPoster.alt = `${top.title} (${top.year})`;
      const back = $('.hero__layer--back');
      if (back) back.style.backgroundImage = `url('${top.backdrop || top.img || ''}')`;
    }
  }).catch((e) => {
    console.warn('TMDB fetch failed:', e);
  });

  // ---- Sticky header padding ----
  const headerEl = $('#appHeader');
  if (headerEl) {
    const setPad = () => document.documentElement.style.setProperty('--app-header-h', headerEl.getBoundingClientRect().height + 8 + 'px');
    setPad();
    window.addEventListener('resize', setPad, { passive: true });
  }
});
