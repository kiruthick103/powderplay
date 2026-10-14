// ==========================================================================
// CINEFLEX — CLIENT APPLICATION
// Visual Identity: Luxury Neo-Brutalism & Cinema Streaming Engine
// Tagline: WATCH ■ STREAM ■ ENJOY
// ==========================================================================

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const IMG_POSTER = `${TMDB_IMAGE_BASE}/w342`;
const IMG_POSTER_LARGE = `${TMDB_IMAGE_BASE}/w500`;
const IMG_BACKDROP = `${TMDB_IMAGE_BASE}/w1280`;
const IMG_LOGO = `${TMDB_IMAGE_BASE}/w92`;

// State
let appState = {
  category: 'popular',
  provider: '',
  providerName: '',
  language: '',
  genre: '',
  sort: 'popularity.desc',
  page: 1,
  totalPages: 1,
  query: '',
  region: localStorage.getItem('cinema_region') || 'US',
  currentWatchMovieId: null,
  currentWatchServer: 'vsembed',
  currentWatchTrailerKey: '',
};

let debounceTimer = null;
let providersList = [];

// DOM Elements
const el = {
  // Views
  viewList: document.getElementById('view-list'),
  viewDetails: document.getElementById('view-details'),
  viewWatch: document.getElementById('view-watch'),
  detailsContent: document.getElementById('details-content'),
  backBtn: document.getElementById('back-btn'),
  grid: document.getElementById('grid'),
  banner: document.getElementById('state-banner'),
  heroSpotlight: document.getElementById('hero-spotlight'),

  // Search
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),

  // Filters & Controls
  regionSelect: document.getElementById('region-select'),
  providerSlider: document.getElementById('provider-slider'),
  clearProviderBtn: document.getElementById('clear-provider-btn'),
  languageChips: document.getElementById('language-chips'),
  clearLangBtn: document.getElementById('clear-lang-btn'),
  genreChips: document.getElementById('genre-chips'),
  clearGenreBtn: document.getElementById('clear-genre-btn'),
  categoryTabs: document.getElementById('category-tabs'),
  sortSelect: document.getElementById('sort-select'),

  // Status & Pagination
  listTitle: document.getElementById('list-title'),
  listMeta: document.getElementById('list-meta'),
  pagination: document.getElementById('pagination'),
  prevBtn: document.getElementById('prev-page'),
  nextBtn: document.getElementById('next-page'),
  pageIndicator: document.getElementById('page-indicator'),
  keyStatus: document.getElementById('key-status'),

  // Watch Page Elements
  watchTitle: document.getElementById('watch-title'),
  watchBackBtn: document.getElementById('watch-back-btn'),
  watchPlayerContainer: document.getElementById('watch-player-container'),
  watchIframe: document.getElementById('watch-iframe'),
  watchLoadingOverlay: document.getElementById('watch-loading-overlay'),
  watchDetailsSection: document.getElementById('watch-details-section'),
  serverPills: document.getElementById('server-pills'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  externalWatchBtn: document.getElementById('external-watch-btn'),
  directStreamLink: document.getElementById('direct-stream-link'),
  streamServerStatus: document.getElementById('stream-server-status'),

  // Trailer Modal
  trailerModal: document.getElementById('trailer-modal'),
  trailerModalTitle: document.getElementById('trailer-modal-title'),
  trailerFrame: document.getElementById('trailer-frame'),
  closeTrailerBtn: document.getElementById('close-trailer-btn'),
};

// ---------- Initialization ----------

window.addEventListener('DOMContentLoaded', () => {
  initRegion();
  checkApiHealth();
  setupEventListeners();
  loadProviders();
  route();
  initUnicornMoviesBackground();
});

window.addEventListener('hashchange', route);

// ---------- Unicorn Studio WebGL Background (Movies Section Alone) ----------
// Component: projectId="lceIKpAuIWxZo33mb8eq", scale=1, dpi=1.5

function initUnicornMoviesBackground() {
  const bgEl = document.getElementById('movies-unicorn-bg');
  if (!bgEl) return;

  let attempts = 0;
  function tryInit() {
    attempts++;
    if (window.UnicornStudio) {
      if (typeof window.UnicornStudio.addScene === 'function') {
        window.UnicornStudio.addScene({
          element: bgEl,
          projectId: 'lceIKpAuIWxZo33mb8eq',
          scale: 1,
          dpi: 1.5,
          lazyLoad: false,
          production: false
        }).then(() => {
          console.log('Unicorn Studio interactive background loaded for movies section.');
        }).catch((err) => {
          console.warn('Unicorn Studio addScene error, trying init():', err);
          if (typeof window.UnicornStudio.init === 'function') {
            window.UnicornStudio.init();
          }
        });
      } else if (typeof window.UnicornStudio.init === 'function') {
        window.UnicornStudio.init();
      }
    } else if (attempts < 20) {
      setTimeout(tryInit, 250);
    }
  }

  tryInit();
}

function initRegion() {
  if (el.regionSelect) {
    el.regionSelect.value = appState.region;
    el.regionSelect.addEventListener('change', () => {
      appState.region = el.regionSelect.value;
      localStorage.setItem('cinema_region', appState.region);
      loadProviders();
      loadCatalog();
    });
  }
}

// ---------- API Health Check ----------

async function checkApiHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    el.keyStatus.classList.remove('ok', 'bad');
    if (res.ok && data.ok) {
      el.keyStatus.classList.add('ok');
      el.keyStatus.title = `TMDB API Active (${data.auth === 'bearer' ? 'Bearer Auth' : 'API Key'})`;
    } else {
      el.keyStatus.classList.add('bad');
      el.keyStatus.title = data.error || 'TMDB API Connection Error';
    }
  } catch {
    el.keyStatus.classList.add('bad');
    el.keyStatus.title = 'Could not reach server';
  }
}

// ---------- Event Listeners ----------

function setupEventListeners() {
  // Navigation Links
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      const targetNav = link.dataset.nav;
      if (targetNav === 'home') {
        if (location.hash !== '#/' && location.hash !== '') {
          location.hash = '#/';
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        if (el.viewList.hidden) {
          location.hash = '#/';
          setTimeout(() => {
            scrollToNavSection(targetNav);
          }, 150);
        } else {
          scrollToNavSection(targetNav);
        }
      }
    });
  });

  // Search submit
  if (el.searchForm) {
    el.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = el.searchInput.value.trim();
      updateUrlParams({ q, page: 1 });
    });
  }

  // Search input change & clear
  if (el.searchInput) {
    el.searchInput.addEventListener('input', () => {
      const val = el.searchInput.value.trim();
      el.searchClearBtn.hidden = !val;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateUrlParams({ q: val, page: 1 });
      }, 450);
    });
  }

  if (el.searchClearBtn) {
    el.searchClearBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.searchClearBtn.hidden = true;
      updateUrlParams({ q: '', page: 1 });
    });
  }

  // Clear Filter Buttons
  if (el.clearProviderBtn) {
    el.clearProviderBtn.addEventListener('click', () => {
      updateUrlParams({ provider: '', page: 1 });
    });
  }

  if (el.clearLangBtn) {
    el.clearLangBtn.addEventListener('click', () => {
      updateUrlParams({ lang: '', page: 1 });
    });
  }

  if (el.clearGenreBtn) {
    el.clearGenreBtn.addEventListener('click', () => {
      updateUrlParams({ genre: '', page: 1 });
    });
  }

  // Language chips click
  if (el.languageChips) {
    el.languageChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.brutal-chip');
      if (!chip) return;
      const lang = chip.dataset.lang || '';
      updateUrlParams({ lang, page: 1 });
    });
  }

  // Genre chips click
  if (el.genreChips) {
    el.genreChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.brutal-chip');
      if (!chip) return;
      const genre = chip.dataset.genre || '';
      updateUrlParams({ genre, page: 1 });
    });
  }

  // Category Tabs
  if (el.categoryTabs) {
    el.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.category-tab');
      if (!tab) return;
      const cat = tab.dataset.category || 'popular';
      updateUrlParams({ cat, page: 1 });
    });
  }

  // Sort select
  if (el.sortSelect) {
    el.sortSelect.addEventListener('change', () => {
      updateUrlParams({ sort: el.sortSelect.value, page: 1 });
    });
  }

  // Pagination buttons
  if (el.prevBtn) {
    el.prevBtn.addEventListener('click', () => {
      if (appState.page > 1) {
        updateUrlParams({ page: appState.page - 1 });
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    });
  }

  if (el.nextBtn) {
    el.nextBtn.addEventListener('click', () => {
      if (appState.page < appState.totalPages) {
        updateUrlParams({ page: appState.page + 1 });
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    });
  }

  // Details Back button
  if (el.backBtn) {
    el.backBtn.addEventListener('click', () => {
      location.hash = '#/';
    });
  }

  // Watch Page Controls
  if (el.watchBackBtn) {
    el.watchBackBtn.addEventListener('click', () => {
      if (el.watchIframe) el.watchIframe.src = '';
      location.hash = '#/';
    });
  }

  if (el.serverPills) {
    el.serverPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.server-pill');
      if (!pill) return;
      const serverKey = pill.dataset.server;
      switchWatchServer(serverKey);
    });
  }

  if (el.fullscreenBtn && el.watchPlayerContainer) {
    el.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        el.watchPlayerContainer.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Trailer Modal controls
  if (el.closeTrailerBtn) el.closeTrailerBtn.addEventListener('click', closeTrailerModal);
  if (el.trailerModal) {
    const backdrop = el.trailerModal.querySelector('.glass-modal__backdrop, .brutal-modal__backdrop');
    if (backdrop) backdrop.addEventListener('click', closeTrailerModal);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTrailerModal();
  });
}

function scrollToNavSection(targetNav) {
  const map = {
    providers: 'providers-section',
    languages: 'languages-section',
    genres: 'genres-section',
    movies: 'catalog-section',
  };
  const targetId = map[targetNav];
  if (targetId) {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ---------- URL & Routing Management ----------

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}

function updateUrlParams(updates) {
  const { path, params } = parseHash();
  for (const [k, v] of Object.entries(updates)) {
    if (v === '' || v === null || v === undefined) {
      params.delete(k);
    } else {
      params.set(k, v);
    }
  }
  const newHash = `${path}${params.toString() ? '?' + params.toString() : ''}`;
  location.hash = newHash;
}

function route() {
  const { path, params } = parseHash();

  // Route: Watch Page #/watch/:id
  const watchMatch = path.match(/^\/watch\/(\d+)$/);
  if (watchMatch) {
    showWatchView();
    loadWatchPage(watchMatch[1]);
    return;
  }

  // Route: Movie Details #/movie/:id
  const movieMatch = path.match(/^\/movie\/(\d+)$/);
  if (movieMatch) {
    showDetailsView();
    loadMovieDetails(movieMatch[1]);
    return;
  }

  // Route: Catalog & Home #/
  showListView();

  // Sync state from query parameters
  appState.query = params.get('q') || '';
  appState.provider = params.get('provider') || '';
  appState.language = params.get('lang') || '';
  appState.genre = params.get('genre') || '';
  appState.category = params.get('cat') || (appState.query ? '' : 'popular');
  appState.sort = params.get('sort') || 'popularity.desc';
  appState.page = parseInt(params.get('page') || '1', 10) || 1;

  // Sync UI controls
  if (el.searchInput) {
    el.searchInput.value = appState.query;
    el.searchClearBtn.hidden = !appState.query;
  }
  if (el.sortSelect) el.sortSelect.value = appState.sort;

  syncActiveChips();
  loadCatalog();
}

function showListView() {
  el.viewList.hidden = false;
  el.viewDetails.hidden = true;
  el.viewWatch.hidden = true;
  if (el.watchIframe) el.watchIframe.src = '';
}

function showDetailsView() {
  el.viewList.hidden = true;
  el.viewDetails.hidden = false;
  el.viewWatch.hidden = true;
  if (el.watchIframe) el.watchIframe.src = '';
  window.scrollTo({ top: 0 });
}

function showWatchView() {
  el.viewList.hidden = true;
  el.viewDetails.hidden = true;
  el.viewWatch.hidden = false;
  window.scrollTo({ top: 0 });
}

function syncActiveChips() {
  // Provider cards
  if (el.providerSlider) {
    el.providerSlider.querySelectorAll('.provider-card').forEach((c) => {
      c.classList.toggle('active', c.dataset.providerId === appState.provider);
    });
    if (el.clearProviderBtn) el.clearProviderBtn.hidden = !appState.provider;
  }

  // Language chips
  if (el.languageChips) {
    el.languageChips.querySelectorAll('.brutal-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.lang === appState.language);
    });
    if (el.clearLangBtn) el.clearLangBtn.hidden = !appState.language;
  }

  // Genre chips
  if (el.genreChips) {
    el.genreChips.querySelectorAll('.brutal-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.genre === appState.genre);
    });
    if (el.clearGenreBtn) el.clearGenreBtn.hidden = !appState.genre;
  }

  // Category tabs
  if (el.categoryTabs) {
    el.categoryTabs.querySelectorAll('.category-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.category === appState.category);
    });
  }
}

// ---------- Watch Providers Data & Slider ----------

async function loadProviders() {
  try {
    const res = await fetch(`/api/providers?region=${appState.region}`);
    const data = await res.json();
    if (!res.ok || !data.results) return;

    providersList = data.results;
    renderProviderSlider(providersList);
  } catch (err) {
    console.warn('Could not load providers:', err);
  }
}

function renderProviderSlider(providers) {
  if (!el.providerSlider) return;

  el.providerSlider.innerHTML = providers
    .map((p) => {
      const isActive = String(p.id) === String(appState.provider);
      const logoUrl = p.logo ? `${IMG_LOGO}${p.logo}` : '';
      return `
        <div class="provider-card ${isActive ? 'active' : ''}" data-provider-id="${p.id}" data-provider-name="${escapeHTML(p.name)}" title="Filter ${escapeHTML(p.name)} titles">
          <div class="provider-card__logo-wrap">
            ${
              logoUrl
                ? `<img src="${logoUrl}" alt="${escapeHTML(p.name)}" class="provider-card__logo" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><span class="provider-card__logo-fallback" style="display:none">${escapeHTML(p.name.slice(0, 2))}</span>`
                : `<span class="provider-card__logo-fallback">${escapeHTML(p.name.slice(0, 2))}</span>`
            }
          </div>
          <span class="provider-card__name">${escapeHTML(p.name)}</span>
        </div>
      `;
    })
    .join('');

  // Attach card click handlers
  el.providerSlider.querySelectorAll('.provider-card').forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.dataset.providerId;
      const isAlreadyActive = card.classList.contains('active');
      const newPid = isAlreadyActive ? '' : pid;
      appState.providerName = isAlreadyActive ? '' : card.dataset.providerName;
      updateUrlParams({ provider: newPid, page: 1 });
    });
  });
}

// ---------- Movies Catalog Loading ----------

async function loadCatalog() {
  setLoadingState();

  const queryParams = new URLSearchParams();
  queryParams.set('page', appState.page);
  queryParams.set('sort_by', appState.sort);
  queryParams.set('region', appState.region);

  if (appState.query) {
    queryParams.set('query', appState.query);
  } else {
    if (appState.category === 'free_ads') {
      queryParams.set('monetization', 'free|ads');
    } else if (appState.category) {
      queryParams.set('category', appState.category);
    }
    if (appState.provider) queryParams.set('provider', appState.provider);
    if (appState.language) queryParams.set('orig_lang', appState.language);
    if (appState.genre) queryParams.set('genre', appState.genre);
  }

  updateTitleAndMeta();

  try {
    const res = await fetch(`/api/movies?${queryParams.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      setErrorState(data.error || 'Failed to load movie catalog.');
      return;
    }

    const movies = data.results || [];
    appState.totalPages = Math.min(data.total_pages || 1, 500);

    if (movies.length === 0) {
      setEmptyState();
      return;
    }

    // Featured Cinema Spotlight Slider on page 1 of general browsing
    const sliderContainer = document.getElementById('hero-slider-container');
    if (appState.page === 1 && !appState.query && !appState.provider && movies.length > 0) {
      initHeroSlider(movies);
    } else {
      if (sliderContainer) sliderContainer.style.display = 'none';
      stopHeroSliderAutoplay();
    }

    renderMovieGrid(movies);
    renderPagination(data.total_results || movies.length);
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  } catch (err) {
    setErrorState('Network error connecting to movie service.');
  }
}

// ---------- Featured Cinema Spotlight Slider Engine ----------

let heroSliderTimer = null;
let currentHeroSlideIndex = 0;
let heroSlideCount = 0;

function initHeroSlider(movies) {
  const container = document.getElementById('hero-slider-container');
  const slider = document.getElementById('hero-slider');
  const dotsContainer = document.getElementById('hero-dots');
  const prevBtn = document.getElementById('hero-prev-btn');
  const nextBtn = document.getElementById('hero-next-btn');

  if (!container || !slider || !movies || movies.length === 0) return;

  // Filter movies with valid artwork
  const validMovies = movies.filter((m) => m.backdrop_path || m.poster_path);
  if (validMovies.length === 0) return;

  // Prioritize Spider-Man first according to title preference, then include top movies
  const topMovies = [...validMovies];
  const spiderIndex = topMovies.findIndex((m) => m.title && m.title.toLowerCase().includes('spider-man'));
  if (spiderIndex > 0) {
    const [spider] = topMovies.splice(spiderIndex, 1);
    topMovies.unshift(spider);
  }

  const spotlightMovies = topMovies.slice(0, 6);
  heroSlideCount = spotlightMovies.length;
  currentHeroSlideIndex = 0;

  // Build slides with respective movie pics (backdrop + poster showcase)
  slider.innerHTML = spotlightMovies
    .map((m, index) => {
      const isActive = index === 0;
      const year = m.release_date ? m.release_date.slice(0, 4) : '';
      const rating = m.vote_average ? Number(m.vote_average).toFixed(1) : '—';
      const lang = (m.original_language || 'en').toUpperCase();
      const backdropUrl = m.backdrop_path ? `${TMDB_IMAGE_BASE}/original${m.backdrop_path}` : (m.poster_path ? `${IMG_BACKDROP}${m.poster_path}` : '');
      const posterUrl = m.poster_path ? `${IMG_POSTER_LARGE}${m.poster_path}` : '';

      return `
        <div class="hero-slide ${isActive ? 'active' : ''}" data-index="${index}" data-movie-id="${m.id}">
          <div class="hero-slide__backdrop" style="background-image: url('${backdropUrl}');"></div>
          <div class="hero-slide__overlay"></div>
          <div class="hero-slide__content">
            <div class="hero-slide__info">
              <span class="hero-slide__badge">FEATURED CINEMA SPOTLIGHT</span>
              <h1 class="hero-slide__title">${escapeHTML(m.title)}</h1>
              <div class="hero-slide__meta">
                <span class="rating">★ ${rating} / 10</span>
                ${year ? `<span>YEAR: ${year}</span>` : ''}
                <span>LANG: ${lang}</span>
              </div>
              <p class="hero-slide__overview">${escapeHTML(m.overview || 'Explore this acclaimed cinematic masterpiece on PowderPlay with high-definition multi-source streaming.')}</p>
              <div class="hero-slide__actions">
                <a href="#/watch/${m.id}" class="glass-btn glass-btn--accent">▶ STREAM & WATCH NOW</a>
                <a href="#/movie/${m.id}" class="glass-btn">[ ℹ MOVIE DETAILS & SERVERS ]</a>
              </div>
            </div>
            ${posterUrl ? `
            <div class="hero-slide__poster-wrap">
              <img src="${posterUrl}" alt="${escapeHTML(m.title)}" class="hero-slide__poster-img" />
            </div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  // Build dot indicators
  if (dotsContainer) {
    dotsContainer.innerHTML = spotlightMovies
      .map((_, i) => `
        <button class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>
      `)
      .join('');

    dotsContainer.querySelectorAll('.hero-dot').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const targetIndex = parseInt(btn.getAttribute('data-index'), 10);
        goToHeroSlide(targetIndex);
      };
    });
  }

  // Navigation button controls
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      goToHeroSlide((currentHeroSlideIndex - 1 + heroSlideCount) % heroSlideCount);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      goToHeroSlide((currentHeroSlideIndex + 1) % heroSlideCount);
    };
  }

  // Pause on hover, resume on mouse leave
  container.onmouseenter = stopHeroSliderAutoplay;
  container.onmouseleave = startHeroSliderAutoplay;

  container.style.display = 'block';
  startHeroSliderAutoplay();
}

function goToHeroSlide(index) {
  if (index < 0 || index >= heroSlideCount) return;
  currentHeroSlideIndex = index;

  const slides = document.querySelectorAll('.hero-slide');
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === index);
  });

  const dots = document.querySelectorAll('.hero-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === index);
  });
}

function startHeroSliderAutoplay() {
  stopHeroSliderAutoplay();
  heroSliderTimer = setInterval(() => {
    goToHeroSlide((currentHeroSlideIndex + 1) % heroSlideCount);
  }, 5000);
}

function stopHeroSliderAutoplay() {
  if (heroSliderTimer) {
    clearInterval(heroSliderTimer);
    heroSliderTimer = null;
  }
}

function updateTitleAndMeta() {
  let title = 'POPULAR MOVIES';

  if (appState.query) {
    title = `SEARCH: "${appState.query.toUpperCase()}"`;
  } else if (appState.provider) {
    const match = providersList.find((p) => String(p.id) === String(appState.provider));
    const pName = match ? match.name.toUpperCase() : 'PROVIDER';
    title = `STREAMING ON ${pName}`;
  } else if (appState.language) {
    const langNames = {
      ta: 'TAMIL (தமிழ்)',
      hi: 'HINDI (हिन्दी)',
      en: 'ENGLISH',
      te: 'TELUGU (తెలుగు)',
      ml: 'MALAYALAM (മലയാളം)',
      kn: 'KANNADA (ಕನ್ನಡ)',
      bn: 'BENGALI (বাংলা)',
      mr: 'MARATHI (मराठी)',
      ja: 'JAPANESE (日本語)',
      ko: 'KOREAN (한국어)',
      es: 'SPANISH (ESPAÑOL)',
      fr: 'FRENCH (FRANÇAIS)',
    };
    title = `${langNames[appState.language] || appState.language.toUpperCase()} MOVIES`;
  } else if (appState.category) {
    const catTitles = {
      popular: 'POPULAR MOVIES',
      trending: 'WEEKLY TRENDING',
      top_rated: 'TOP-RATED CLASSICS',
      now_playing: 'IN THEATERS NOW',
      upcoming: 'UPCOMING RELEASES',
      free_ads: 'FREE & AD-SUPPORTED STREAMING',
    };
    title = catTitles[appState.category] || 'MOVIE CATALOG';
  }

  if (el.listTitle) el.listTitle.textContent = title;
}

function renderMovieGrid(movies) {
  el.banner.hidden = true;
  el.grid.hidden = false;

  el.grid.innerHTML = movies
    .map((m) => {
      const poster = m.poster_path ? `${IMG_POSTER}${m.poster_path}` : '';
      const year = m.release_date ? m.release_date.slice(0, 4) : '—';
      const rating = m.vote_average ? m.vote_average.toFixed(1) : 'NR';
      const lang = (m.original_language || 'en').toUpperCase();

      return `
        <article class="movie-card" tabindex="0" aria-label="${escapeHTML(m.title)}">
          <div class="movie-card__poster-wrap" onclick="location.hash='#/movie/${m.id}'">
            ${
              poster
                ? `<img src="${poster}" alt="${escapeHTML(m.title)}" class="movie-card__poster" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="movie-card__poster-fallback" style="display:none">${escapeHTML(m.title)}</div>`
                : `<div class="movie-card__poster-fallback">${escapeHTML(m.title)}</div>`
            }
            <div class="movie-card__badges">
              <span class="card-tag card-tag--gold">★ ${rating}</span>
              <span class="card-tag">${lang}</span>
            </div>
          </div>
          <div class="movie-card__body">
            <h3 class="movie-card__title" onclick="location.hash='#/movie/${m.id}'">${escapeHTML(m.title)}</h3>
            <div class="movie-card__info">
              <span>YEAR: ${year}</span>
              <a href="#/movie/${m.id}" style="color: var(--text-muted);">DETAILS →</a>
            </div>
            <div class="movie-card__actions">
              <button class="movie-card__play-btn" onclick="location.hash='#/watch/${m.id}'">▶ STREAM NOW</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderPagination(totalResults) {
  if (appState.totalPages <= 1) {
    el.pagination.hidden = true;
    return;
  }

  el.pagination.hidden = false;
  el.prevBtn.disabled = appState.page <= 1;
  el.nextBtn.disabled = appState.page >= appState.totalPages;
  el.pageIndicator.textContent = `PAGE ${appState.page} OF ${appState.totalPages}`;
  if (el.listMeta) el.listMeta.textContent = `${totalResults.toLocaleString()} TITLES FOUND`;
}

function setLoadingState() {
  el.banner.hidden = true;
  el.grid.hidden = false;
  el.grid.innerHTML = Array.from({ length: 12 })
    .map(() => '<div class="skeleton-card"></div>')
    .join('');
  if (el.pagination) el.pagination.hidden = true;
}

function setEmptyState() {
  el.grid.innerHTML = '';
  el.grid.hidden = true;
  el.pagination.hidden = true;
  el.banner.className = 'state-banner';
  el.banner.hidden = false;
  el.banner.innerHTML = `
    <h3 style="font-family: var(--font-heading); font-size: 28px; margin-bottom: 8px;">NO TITLES DISCOVERED</h3>
    <p>No films matched the selected provider, language, or genre filters in region (${appState.region}).</p>
    <button class="brutal-btn" style="margin-top: 16px;" onclick="location.hash='#/'">[ RESET ALL FILTERS ]</button>
  `;
}

function setErrorState(msg) {
  el.grid.innerHTML = '';
  el.grid.hidden = true;
  el.pagination.hidden = true;
  el.banner.className = 'state-banner error';
  el.banner.hidden = false;
  el.banner.innerHTML = `
    <h3 style="font-family: var(--font-heading); font-size: 28px; margin-bottom: 8px;">DATA RETRIEVAL ERROR</h3>
    <p>${escapeHTML(msg)}</p>
    <button class="brutal-btn" style="margin-top: 16px;" onclick="loadCatalog()">[ RETRY REQUEST ]</button>
  `;
}

// ---------- Movie Details Page ----------

async function loadMovieDetails(id) {
  el.detailsContent.innerHTML = '<div class="state-banner">LOADING MOVIE ARCHIVE…</div>';

  try {
    const res = await fetch(`/api/movies/${id}`);
    const movie = await res.json();

    if (!res.ok) {
      el.detailsContent.innerHTML = `
        <div class="state-banner error">
          <h3>RECORD NOT FOUND</h3>
          <p>${escapeHTML(movie.error || 'Movie details unavailable.')}</p>
        </div>`;
      return;
    }

    // Optional age rating
    let cert = '';
    try {
      const rRes = await fetch(`/api/movies/${id}/rating`);
      const rData = await rRes.json();
      cert = rData.certification || '';
    } catch {}

    renderMovieDetails(movie, cert);
  } catch (err) {
    el.detailsContent.innerHTML = `
      <div class="state-banner error">
        <h3>CONNECTION FAILED</h3>
        <p>Could not load record from TMDB service.</p>
      </div>`;
  }
}

function renderMovieDetails(movie, certification) {
  const backdrop = movie.backdrop_path ? `${IMG_BACKDROP}${movie.backdrop_path}` : '';
  const poster = movie.poster_path
    ? `<img src="${IMG_POSTER_LARGE}${movie.poster_path}" alt="${escapeHTML(movie.title)}" class="details__poster" />`
    : `<div class="movie-card__poster-fallback">${escapeHTML(movie.title)}</div>`;

  const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  const votes = movie.vote_count ? `${movie.vote_count.toLocaleString()} VOTES` : '';

  const genres = (movie.genres || []).map((g) => `<span class="genre-tag">${escapeHTML(g.name.toUpperCase())}</span>`).join('');

  // Cast list
  const cast = ((movie.credits && movie.credits.cast) || [])
    .slice(0, 8)
    .map(
      (c) => `
        <div class="cast-card">
          <div class="cast-card__name">${escapeHTML(c.name)}</div>
          <div class="cast-card__char">${escapeHTML(c.character || 'Cast')}</div>
        </div>`
    )
    .join('');

  // Trailer finding
  const trailer = ((movie.videos && movie.videos.results) || []).find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );
  const trailerKey = trailer ? trailer.key : '';

  // Watch providers parsed by current region
  const providerData = (movie['watch/providers'] && movie['watch/providers'].results) || {};
  const regionWatch = providerData[appState.region] || providerData['US'] || Object.values(providerData)[0] || null;

  const flatrate = (regionWatch && regionWatch.flatrate) || [];
  const free = (regionWatch && (regionWatch.free || regionWatch.ads)) || [];
  const rent = (regionWatch && regionWatch.rent) || [];
  const buy = (regionWatch && regionWatch.buy) || [];
  const jwLink = regionWatch && regionWatch.link;

  function renderProviderGroup(title, list) {
    if (!list.length) return '';
    const pills = list
      .map(
        (p) => `
        <div class="provider-pill" title="${escapeHTML(p.provider_name)}">
          <img src="${IMG_LOGO}${p.logo_path}" alt="${escapeHTML(p.provider_name)}" onerror="this.style.display='none'" />
          <span>${escapeHTML(p.provider_name)}</span>
        </div>`
      )
      .join('');
    return `
      <div class="watch-group">
        <div class="watch-group__label">${title}</div>
        <div class="provider-logos-grid">${pills}</div>
      </div>
    `;
  }

  const hasWatchOptions = flatrate.length > 0 || free.length > 0 || rent.length > 0 || buy.length > 0;
  const releaseDateObj = movie.release_date ? new Date(movie.release_date) : null;
  const isUnreleased = releaseDateObj && releaseDateObj > new Date();
  const defaultServer = isUnreleased ? (trailerKey ? 'trailer' : 'vsembed') : 'vsembed';

  let initialStreamUrl = '';
  let initialStatusText = '';

  if (defaultServer === 'trailer') {
    initialStreamUrl = trailerKey
      ? `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`
      : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(movie.title + ' official trailer')}&autoplay=1`;
    initialStatusText = 'OFFICIAL HD STREAM: TEASER & TRAILER';
  } else {
    initialStreamUrl = `https://vsembed.su/embed/movie/${movie.id}`;
    initialStatusText = 'REALTIME STREAM: SERVER 1 (VSEMBED MULTI-QUALITY - PRIMARY)';
  }

  window.currentDetailsTrailerKey = trailerKey;
  window.currentDetailsMovieTitle = movie.title;

  el.detailsContent.innerHTML = `
    <article class="details">
      <div class="details__hero" style="${backdrop ? `background-image:url('${backdrop}')` : ''}">
        <div class="details__hero-inner">
          <div class="details__poster-wrap">${poster}</div>
          <div class="details__main">
            <h1 class="details__title">${escapeHTML(movie.title)}</h1>
            ${movie.original_title && movie.original_title !== movie.title ? `<div class="details__orig-title">ORIGINAL: ${escapeHTML(movie.original_title)}</div>` : ''}
            ${movie.tagline ? `<div class="details__tagline">"${escapeHTML(movie.tagline)}"</div>` : ''}

            <div class="details__stats-bar">
              <span class="stat-pill stat-pill--gold">★ ${rating} / 10 (${votes})</span>
              <span class="stat-pill">YEAR: ${year}</span>
              ${runtime ? `<span class="stat-pill">RUN: ${runtime}</span>` : ''}
              ${certification ? `<span class="stat-pill" style="border-color: var(--accent); color: var(--accent)">RATING: ${escapeHTML(certification)}</span>` : ''}
              <span class="stat-pill">LANG: ${(movie.original_language || 'EN').toUpperCase()}</span>
            </div>

            ${genres ? `<div class="details__genres">${genres}</div>` : ''}

            <div class="details__actions">
              <a href="#details-player-section" class="glass-btn glass-btn--accent" onclick="document.getElementById('details-player-section')?.scrollIntoView({behavior:'smooth'})">▶ WATCH STREAM BELOW</a>
              <a href="#/watch/${movie.id}" class="glass-btn">[ ⛶ FULL THEATER VIEW ]</a>
              ${
                jwLink
                  ? `<a href="${jwLink}" target="_blank" rel="noopener" class="glass-btn">[ CHECK OFFICIAL PROVIDERS ↗ ]</a>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>

      <!-- In-Page Realtime Cinema Streaming Theater -->
      <div class="details__section" id="details-player-section" style="padding: 0; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
        <div class="watch-header" style="padding: 16px 22px; background: rgba(12, 14, 22, 0.85); border-bottom: 1px solid var(--glass-border); margin: 0;">
          <div class="watch-header__left">
            <span class="status-dot"></span>
            <h3 style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">
              STREAMING THEATER // ${escapeHTML(movie.title.toUpperCase())}
            </h3>
          </div>
          <div class="watch-header__right">
            <div class="server-selector-group">
              <span class="server-label">SOURCE:</span>
              <div class="server-pills" id="details-server-pills">
                <button class="server-pill ${defaultServer === 'vsembed' ? 'active' : ''}" onclick="switchDetailsServer('${movie.id}', 'vsembed')">⚡ SERVER 1 (VSEMBED)</button>
                <button class="server-pill ${defaultServer === 'autoembed' ? 'active' : ''}" onclick="switchDetailsServer('${movie.id}', 'autoembed')">⚡ SERVER 2 (AUTOEMBED)</button>
                <button class="server-pill ${defaultServer === '2embed' ? 'active' : ''}" onclick="switchDetailsServer('${movie.id}', '2embed')">⚡ SERVER 3 (2EMBED)</button>
                <button class="server-pill ${defaultServer === 'trailer' ? 'active' : ''}" onclick="switchDetailsServer('${movie.id}', 'trailer')">▶ TRAILER (HD)</button>
              </div>
            </div>
            <div class="watch-actions-group">
              <a id="details-popout-btn" href="${initialStreamUrl}" target="_blank" rel="noopener noreferrer" class="glass-btn">[ ↗ POP-OUT ]</a>
              <a href="#/watch/${movie.id}" class="glass-btn glass-btn--accent">[ ⛶ FULLSCREEN ]</a>
            </div>
          </div>
        </div>

        ${
          isUnreleased
            ? `<div style="background: rgba(229, 9, 20, 0.12); border-bottom: 1px solid var(--accent); padding: 12px 22px; font-size: 12px; font-weight: 600; color: #ff9e9a; display: flex; align-items: center; gap: 10px;">
                <span style="background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px;">THEATRICAL NOTICE</span>
                <span>THIS TITLE IS SCHEDULED FOR FUTURE RELEASE (${year}). STREAMING OFFICIAL HD TEASER & TRAILER BELOW.</span>
              </div>`
            : ''
        }

        <div class="watch-player-wrapper" id="details-player-wrapper" style="border: none; box-shadow: none;">
          <iframe
            id="details-iframe"
            src="${initialStreamUrl}"
            title="PowderPlay Cinema Player"
            referrerpolicy="no-referrer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        </div>

        <div class="watch-server-toolbar">
          <div class="stream-health-indicator">
            <span class="pulse-dot"></span>
            <span id="details-server-status">${initialStatusText}</span>
          </div>
          <div class="stream-troubleshoot">
            <span class="troubleshoot-label">STREAM DELAYED? SWITCH MIRROR:</span>
            <button type="button" class="switch-link-btn" onclick="switchDetailsServer('${movie.id}', 'vsembed')">VSEMBED</button>
            <button type="button" class="switch-link-btn" onclick="switchDetailsServer('${movie.id}', 'autoembed')">AUTOEMBED</button>
            <button type="button" class="switch-link-btn" onclick="switchDetailsServer('${movie.id}', '2embed')">2EMBED</button>
            <a id="details-direct-link" href="${initialStreamUrl}" target="_blank" rel="noopener noreferrer" class="direct-link-tag">DIRECT LINK ↗</a>
          </div>
        </div>
      </div>

      <div class="details__body">
        <div class="details__section">
          <div class="details__section-title">// SYNOPSIS</div>
          <p class="details__overview">${escapeHTML(movie.overview || 'No description recorded in archives.')}</p>
        </div>

        <div class="details__section">
          <div class="details__section-title">// STREAMING AVAILABILITY & OFFICIAL SOURCES (${appState.region})</div>
          ${
            hasWatchOptions
              ? `<div class="watch-options-container">
                  ${renderProviderGroup('SUBSCRIPTION STREAMING (FLATRATE)', flatrate)}
                  ${renderProviderGroup('FREE WITH ADS / LEGAL FREE', free)}
                  ${renderProviderGroup('DIGITAL RENTAL', rent)}
                  ${renderProviderGroup('DIGITAL PURCHASE', buy)}
                  ${
                    jwLink
                      ? `<a href="${jwLink}" target="_blank" rel="noopener" class="jw-link-banner">
                          <span>VERIFIED BY JUSTWATCH & TMDB — CLICK FOR DIRECT WATCH PAGE</span>
                          <span>↗</span>
                        </a>`
                      : ''
                  }
                </div>`
              : `<div class="state-banner" style="margin: 0;">
                  <p>Streaming availability not found for this title in region (${appState.region}).</p>
                  ${jwLink ? `<a href="${jwLink}" target="_blank" rel="noopener" class="brutal-btn" style="margin-top: 10px;">[ CHECK WORLDWIDE OPTIONS ↗ ]</a>` : ''}
                </div>`
          }
        </div>

        ${
          cast
            ? `<div class="details__section">
                <div class="details__section-title">// CAST & CHARACTERS</div>
                <div class="cast-grid">${cast}</div>
              </div>`
            : ''
        }
      </div>
    </article>
  `;
}

// In-Page Details Server Switcher
window.switchDetailsServer = function (movieId, serverKey) {
  const iframe = document.getElementById('details-iframe');
  const statusEl = document.getElementById('details-server-status');
  const popoutBtn = document.getElementById('details-popout-btn');
  const directLink = document.getElementById('details-direct-link');
  const pills = document.querySelectorAll('#details-server-pills .server-pill');

  pills.forEach((p) => {
    p.classList.toggle('active', p.getAttribute('onclick')?.includes(`'${serverKey}'`));
  });

  let url = '';
  let status = '';

  switch (serverKey) {
    case 'vsembed':
      url = `https://vsembed.su/embed/movie/${movieId}`;
      status = 'REALTIME STREAM: SERVER 1 (VSEMBED MULTI-QUALITY)';
      break;
    case 'autoembed':
      url = `https://autoembed.co/movie/tmdb/${movieId}`;
      status = 'REALTIME STREAM: SERVER 2 (AUTOEMBED CO)';
      break;
    case '2embed':
      url = `https://www.2embed.cc/embed/${movieId}`;
      status = 'REALTIME STREAM: SERVER 3 (2EMBED CLOUD)';
      break;
    case 'trailer':
      url = window.currentDetailsTrailerKey
        ? `https://www.youtube-nocookie.com/embed/${window.currentDetailsTrailerKey}?autoplay=1&rel=0`
        : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent((window.currentDetailsMovieTitle || 'movie') + ' official trailer')}&autoplay=1`;
      status = 'OFFICIAL STREAM: YOUTUBE / TMDB HD TRAILER';
      break;
    default:
      url = `https://vsembed.su/embed/movie/${movieId}`;
      status = 'REALTIME STREAM: SERVER 1 (VSEMBED DEFAULT)';
  }

  if (iframe) iframe.src = url;
  if (statusEl) statusEl.textContent = status;
  if (popoutBtn) popoutBtn.href = url;
  if (directLink) directLink.href = url;
};

// ---------- Watch Page (Cinematic Streaming Engine) ----------

async function loadWatchPage(id) {
  appState.currentWatchMovieId = id;
  appState.currentWatchServer = 'vidlink';

  if (el.watchLoadingOverlay) el.watchLoadingOverlay.classList.remove('hidden');
  if (el.watchTitle) el.watchTitle.textContent = 'CONNECTING REALTIME STREAM…';

  try {
    const res = await fetch(`/api/movies/${id}`);
    const movie = await res.json();

    if (!res.ok) {
      if (el.watchTitle) el.watchTitle.textContent = 'MOVIE STREAM UNAVAILABLE';
      if (el.watchLoadingOverlay) el.watchLoadingOverlay.classList.add('hidden');
      return;
    }

    const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
    if (el.watchTitle) el.watchTitle.textContent = `${movie.title.toUpperCase()} ${year ? `(${year})` : ''}`;

    // Extract official trailer if present
    const trailer = ((movie.videos && movie.videos.results) || []).find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    appState.currentWatchTrailerKey = trailer ? trailer.key : '';

    // Set server pills active
    syncServerPills();

    // Load initial stream with high-speed primary server (VidLink)
    renderWatchStream(id, appState.currentWatchServer);

    // Render movie details, watch providers, and related recommendations below the player
    renderWatchDetails(movie);
  } catch (err) {
    if (el.watchTitle) el.watchTitle.textContent = 'STREAM CONNECTION ERROR';
    if (el.watchLoadingOverlay) el.watchLoadingOverlay.classList.add('hidden');
  }
}

function syncServerPills() {
  if (!el.serverPills) return;
  el.serverPills.querySelectorAll('.server-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.server === appState.currentWatchServer);
  });
}

function switchWatchServer(serverKey) {
  appState.currentWatchServer = serverKey;
  syncServerPills();
  if (appState.currentWatchMovieId) {
    renderWatchStream(appState.currentWatchMovieId, serverKey);
  }
}

// Expose globally for toolbar buttons
window.switchWatchServer = switchWatchServer;

function renderWatchStream(movieId, serverKey) {
  if (!el.watchIframe) return;

  if (el.watchLoadingOverlay) {
    el.watchLoadingOverlay.classList.remove('hidden');
  }

  let streamUrl = '';
  let statusText = '';

  switch (serverKey) {
    case 'vidlink':
      streamUrl = `https://vidlink.pro/movie/${movieId}`;
      statusText = 'REALTIME STREAM: SERVER 1 (VIDLINK HIGH-SPEED)';
      break;
    case 'vsembed':
      streamUrl = `https://vsembed.su/embed/movie/${movieId}`;
      statusText = 'REALTIME STREAM: SERVER 2 (VSEMBED MULTI-QUALITY)';
      break;
    case 'autoembed':
      streamUrl = `https://autoembed.co/movie/tmdb/${movieId}`;
      statusText = 'REALTIME STREAM: SERVER 3 (AUTOEMBED CO)';
      break;
    case '2embed':
      streamUrl = `https://www.2embed.cc/embed/${movieId}`;
      statusText = 'REALTIME STREAM: SERVER 4 (2EMBED CLOUD)';
      break;
    case 'trailer':
      if (appState.currentWatchTrailerKey) {
        streamUrl = `https://www.youtube-nocookie.com/embed/${appState.currentWatchTrailerKey}?autoplay=1&rel=0`;
        statusText = 'OFFICIAL STREAM: YOUTUBE / TMDB HD TRAILER';
      } else {
        streamUrl = `https://vidlink.pro/movie/${movieId}`;
        statusText = 'REALTIME STREAM: SERVER 1 (VIDLINK HIGH-SPEED)';
      }
      break;
    default:
      streamUrl = `https://vidlink.pro/movie/${movieId}`;
      statusText = 'REALTIME STREAM: SERVER 1 (VIDLINK HIGH-SPEED)';
  }

  // Set Iframe Source
  el.watchIframe.src = streamUrl;

  // Update Status and Direct Links
  if (el.streamServerStatus) el.streamServerStatus.textContent = statusText;
  if (el.directStreamLink) el.directStreamLink.href = streamUrl;
  if (el.externalWatchBtn) el.externalWatchBtn.href = streamUrl;

  // Fade out loading spinner once iframe signals load or fallback timer fires
  el.watchIframe.onload = () => {
    setTimeout(() => {
      if (el.watchLoadingOverlay) el.watchLoadingOverlay.classList.add('hidden');
    }, 450);
  };

  setTimeout(() => {
    if (el.watchLoadingOverlay) el.watchLoadingOverlay.classList.add('hidden');
  }, 2200);
}

function renderWatchDetails(movie) {
  if (!el.watchDetailsSection) return;

  const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  const genres = (movie.genres || []).map((g) => `<span class="genre-tag">${escapeHTML(g.name.toUpperCase())}</span>`).join('');

  // Watch providers
  const providerData = (movie['watch/providers'] && movie['watch/providers'].results) || {};
  const regionWatch = providerData[appState.region] || providerData['US'] || Object.values(providerData)[0] || null;
  const flatrate = (regionWatch && regionWatch.flatrate) || [];
  const free = (regionWatch && (regionWatch.free || regionWatch.ads)) || [];
  const jwLink = regionWatch && regionWatch.link;

  const similar = ((movie.similar && movie.similar.results) || []).slice(0, 6);
  const releaseDateObj = movie.release_date ? new Date(movie.release_date) : null;
  const isUnreleased = releaseDateObj && releaseDateObj > new Date();

  el.watchDetailsSection.innerHTML = `
    ${
      isUnreleased
        ? `<div style="background: #201114; border: 1.5px solid var(--accent); padding: 12px 18px; margin-top: 20px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: #ff9e9a; display: flex; align-items: center; gap: 10px;">
            <span style="background: var(--accent); color: #fff; padding: 2px 8px; font-weight: 800;">THEATRICAL NOTICE</span>
            <span>THIS TITLE IS SCHEDULED FOR FUTURE RELEASE (${year}). STREAMING OFFICIAL HD TEASER & TRAILER ABOVE.</span>
          </div>`
        : ''
    }
    <div class="section-block" style="margin-top: 20px;">
      <div class="details__stats-bar" style="margin-bottom: 12px;">
        <span class="stat-pill stat-pill--gold">★ ${rating} / 10</span>
        <span class="stat-pill">RELEASE: ${year}</span>
        ${runtime ? `<span class="stat-pill">DURATION: ${runtime}</span>` : ''}
        <span class="stat-pill">LANG: ${(movie.original_language || 'EN').toUpperCase()}</span>
      </div>
      <div class="details__genres" style="margin-bottom: 14px;">${genres}</div>
      <p class="details__overview">${escapeHTML(movie.overview || 'No synopsis recorded.')}</p>

      ${
        flatrate.length || free.length
          ? `<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
              <span class="server-label">ALSO STREAMING OFFICIALLY ON:</span>
              <div class="provider-logos-grid" style="margin-top: 8px;">
                ${[...flatrate, ...free]
                  .map(
                    (p) => `
                    <div class="provider-pill">
                      <img src="${IMG_LOGO}${p.logo_path}" alt="${escapeHTML(p.provider_name)}" />
                      <span>${escapeHTML(p.provider_name)}</span>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      ${
        jwLink
          ? `<div style="margin-top: 16px;">
              <a href="${jwLink}" target="_blank" rel="noopener" class="jw-link-banner">
                <span>VIEW VERIFIED WATCH AVAILABILITY ON JUSTWATCH</span>
                <span>↗</span>
              </a>
            </div>`
          : ''
      }
    </div>

    ${
      similar.length
        ? `
        <div class="section-block">
          <div class="section-block__header">
            <div class="section-title-wrap">
              <span class="section-num">RECOMMENDED</span>
              <h3 class="section-title">SIMILAR CINEMA TITLES</h3>
            </div>
          </div>
          <div class="movie-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
            ${similar
              .map((m) => {
                const pUrl = m.poster_path ? `${IMG_POSTER}${m.poster_path}` : '';
                return `
                <div class="movie-card" onclick="location.hash='#/watch/${m.id}'">
                  <div class="movie-card__poster-wrap">
                    ${
                      pUrl
                        ? `<img src="${pUrl}" alt="${escapeHTML(m.title)}" class="movie-card__poster" loading="lazy" />`
                        : `<div class="movie-card__poster-fallback">${escapeHTML(m.title)}</div>`
                    }
                  </div>
                  <div class="movie-card__body">
                    <h4 class="movie-card__title" style="font-size: 16px;">${escapeHTML(m.title)}</h4>
                    <span style="color: var(--accent); font-family: var(--font-mono); font-size: 10px; font-weight: 800;">▶ STREAM NOW</span>
                  </div>
                </div>`;
              })
              .join('')}
          </div>
        </div>`
        : ''
    }
  `;
}

// ---------- Official Trailer Modal ----------

function openTrailerModal(key, title) {
  if (!el.trailerModal || !key) return;
  el.trailerModalTitle.textContent = title;
  el.trailerFrame.src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0`;
  el.trailerModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeTrailerModal() {
  if (!el.trailerModal) return;
  el.trailerFrame.src = '';
  el.trailerModal.hidden = true;
  document.body.style.overflow = '';
}

// ---------- Utilities ----------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
