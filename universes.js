/**
 * ============================================================================
 * FEATURE 4: MOVIE UNIVERSE MAPS (universes.js)
 * Interactive Timeline & Chronological Order Engine for Cinematic Franchises
 * Wrapped in an IIFE to ensure no global scope pollution.
 * ============================================================================
 */

(function () {
  'use strict';

  const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
  const STORAGE_PREFIX = 'uni-watched-';

  let franchisesData = [];
  let currentFranchise = null;
  let currentSortMode = 'story'; // 'story' (chronological) or 'release'
  let currentZoomLevel = 1.0;

  // ---------- 1. HELPER UTILITIES ----------

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isMovieWatched(franchiseId, movieId) {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${franchiseId}-${movieId}`) === 'true';
    } catch (e) {
      return false;
    }
  }

  function setMovieWatched(franchiseId, movieId, isWatched) {
    try {
      if (isWatched) {
        localStorage.setItem(`${STORAGE_PREFIX}${franchiseId}-${movieId}`, 'true');
      } else {
        localStorage.removeItem(`${STORAGE_PREFIX}${franchiseId}-${movieId}`);
      }
    } catch (e) {
      // Fail quietly
    }
  }

  // ---------- 2. FETCH FRANCHISES FROM JSON ----------

  async function loadFranchises() {
    try {
      const res = await fetch('universes.json');
      if (!res.ok) throw new Error('Could not load universes.json');
      const data = await res.json();
      franchisesData = data.franchises || [];

      renderFranchiseGrid();

      // Open MCU or first franchise by default
      if (franchisesData.length > 0) {
        selectFranchise(franchisesData[0].id);
      }
    } catch (err) {
      console.warn('Failed to load universe data:', err);
      const grid = document.getElementById('uni-franchise-grid');
      if (grid) {
        grid.innerHTML = '<p class="uni-error">Unable to load franchise maps right now. Please refresh.</p>';
      }
    }
  }

  // ---------- 3. RENDER FRANCHISE CARDS ----------

  function renderFranchiseGrid() {
    const grid = document.getElementById('uni-franchise-grid');
    if (!grid) return;

    grid.innerHTML = franchisesData
      .map((f) => {
        const watchedCount = f.movies.filter((m) => isMovieWatched(f.id, m.id)).length;
        const totalCount = f.movies.length;
        const isCurrent = currentFranchise && currentFranchise.id === f.id;

        return `
          <div class="uni-franchise-card ${isCurrent ? 'uni-active-franchise' : ''}" 
               data-franchise-id="${f.id}"
               style="--uni-theme: ${f.themeColor || '#e50914'};"
               tabindex="0"
               role="button"
               aria-label="Explore ${escapeHTML(f.name)}">
            <div>
              <div class="uni-franchise-card__badge">${escapeHTML(f.badge || 'FRANCHISE')}</div>
              <h3 class="uni-franchise-card__name">${escapeHTML(f.name)}</h3>
              <p class="uni-franchise-card__tagline">${escapeHTML(f.tagline || '')}</p>
            </div>
            <div class="uni-franchise-card__count">
              <span>🎬 ${totalCount} Movies</span>
              <span style="opacity: 0.6;">•</span>
              <span id="uni-card-progress-${f.id}">👁️ ${watchedCount}/${totalCount}</span>
            </div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.uni-franchise-card').forEach((card) => {
      card.addEventListener('click', () => {
        const fid = card.dataset.franchiseId;
        selectFranchise(fid);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectFranchise(card.dataset.franchiseId);
        }
      });
    });
  }

  // ---------- 4. SELECT FRANCHISE & RENDER TIMELINE ----------

  function selectFranchise(franchiseId) {
    currentFranchise = franchisesData.find((f) => f.id === franchiseId) || franchisesData[0];
    if (!currentFranchise) return;

    // Highlight active card
    document.querySelectorAll('.uni-franchise-card').forEach((c) => {
      c.classList.toggle('uni-active-franchise', c.dataset.franchiseId === currentFranchise.id);
    });

    renderTimelineStage();
  }

  function renderTimelineStage() {
    const stage = document.getElementById('uni-timeline-stage');
    if (!stage || !currentFranchise) return;

    // Sort movies according to current mode
    const movies = [...currentFranchise.movies].sort((a, b) => {
      if (currentSortMode === 'story') {
        return (a.story_order || 0) - (b.story_order || 0);
      }
      return (a.release_order || 0) - (b.release_order || 0);
    });

    const watchedCount = movies.filter((m) => isMovieWatched(currentFranchise.id, m.id)).length;
    const totalCount = movies.length;
    const percent = Math.round((watchedCount / totalCount) * 100);

    stage.innerHTML = `
      <div class="uni-toolbar">
        <div class="uni-title-group">
          <h2>
            <span>${escapeHTML(currentFranchise.name)}</span>
            <span class="uni-hero__badge" style="margin:0; background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.2); color:#fff;">
              ${currentSortMode === 'story' ? 'STORY CHRONOLOGY' : 'THEATRICAL RELEASE'}
            </span>
          </h2>
          <div class="uni-progress-text" id="uni-progress-text">
            ${watchedCount} of ${totalCount} movies watched (${percent}%)
          </div>
        </div>

        <div class="uni-controls-group">
          <!-- Order Switcher -->
          <div class="uni-order-toggle" role="group" aria-label="Timeline Order">
            <button type="button" class="uni-toggle-btn ${currentSortMode === 'story' ? 'uni-toggle-active' : ''}" id="uni-sort-story-btn">
              Story Order
            </button>
            <button type="button" class="uni-toggle-btn ${currentSortMode === 'release' ? 'uni-toggle-active' : ''}" id="uni-sort-release-btn">
              Release Order
            </button>
          </div>

          <!-- Continue Where I Left Off -->
          <button type="button" class="uni-continue-btn" id="uni-continue-btn" title="Jump to next unwatched title">
            <span>▶ Continue where I left off</span>
          </button>

          <!-- Zoom Controls -->
          <div class="uni-zoom-controls">
            <button type="button" class="uni-zoom-btn" id="uni-zoom-in" title="Zoom in">+</button>
            <button type="button" class="uni-zoom-btn" id="uni-zoom-reset" title="Reset zoom">100%</button>
            <button type="button" class="uni-zoom-btn" id="uni-zoom-out" title="Zoom out">-</button>
          </div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="uni-progress-bar-wrap" aria-label="Watching progress">
        <div class="uni-progress-bar-fill" id="uni-progress-fill" style="width: ${percent}%;"></div>
      </div>

      <!-- Timeline Scroll Container -->
      <div class="uni-timeline-scroll-wrap" id="uni-timeline-scroll-wrap">
        <div class="uni-timeline-track" id="uni-timeline-track" style="transform: scale(${currentZoomLevel});">
          ${renderTimelineNodes(movies)}
        </div>
      </div>
    `;

    bindTimelineEvents(movies);
  }

  function renderTimelineNodes(movies) {
    return movies
      .map((m, index) => {
        const isWatched = isMovieWatched(currentFranchise.id, m.id);
        const orderNum = currentSortMode === 'story' ? m.story_order : m.release_order;
        const posterUrl = m.poster_path
          ? `${TMDB_POSTER_BASE}${m.poster_path}`
          : 'assets/powderplay-header-logo.png';

        return `
          <div class="uni-node ${isWatched ? 'uni-node-watched' : ''}" id="uni-node-${m.id}" data-movie-id="${m.id}">
            <!-- Node Step Dot -->
            <div class="uni-node__step-dot" title="Timeline Step #${orderNum}">
              ${isWatched ? '✓' : orderNum || index + 1}
            </div>

            <!-- Card Content -->
            <div class="uni-node__card">
              <div class="uni-node__poster-wrap">
                <img src="${posterUrl}" alt="${escapeHTML(m.title)}" class="uni-node__poster" loading="lazy" />
                ${m.phase ? `<span class="uni-node__phase-tag">${escapeHTML(m.phase)}</span>` : ''}
                ${m.era ? `<span class="uni-node__era-tag">${escapeHTML(m.era)}</span>` : ''}
              </div>

              <div class="uni-node__body">
                <h4 class="uni-node__title" title="${escapeHTML(m.title)}">${escapeHTML(m.title)}</h4>
                <div class="uni-node__year">Year: ${m.year || 'N/A'}</div>

                <!-- Watched Checkbox -->
                <label class="uni-checkbox-label">
                  <input type="checkbox" class="uni-checkbox-input" data-movie-id="${m.id}" ${isWatched ? 'checked' : ''} />
                  <span>Watched</span>
                </label>

                <a href="index.html#/watch/${m.id}" class="uni-node-watch-btn" title="Stream ${escapeHTML(m.title)}">
                  ▶ Stream Now
                </a>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ---------- 5. TIMELINE EVENTS & INTERACTION ----------

  function bindTimelineEvents(movies) {
    const stage = document.getElementById('uni-timeline-stage');
    if (!stage) return;

    // Toggle Order Buttons
    const storyBtn = stage.querySelector('#uni-sort-story-btn');
    const releaseBtn = stage.querySelector('#uni-sort-release-btn');

    if (storyBtn) {
      storyBtn.addEventListener('click', () => {
        if (currentSortMode !== 'story') {
          currentSortMode = 'story';
          renderTimelineStage();
        }
      });
    }

    if (releaseBtn) {
      releaseBtn.addEventListener('click', () => {
        if (currentSortMode !== 'release') {
          currentSortMode = 'release';
          renderTimelineStage();
        }
      });
    }

    // Continue where I left off
    const continueBtn = stage.querySelector('#uni-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        handleContinueLeftOff(movies);
      });
    }

    // Zoom Buttons
    const track = stage.querySelector('#uni-timeline-track');
    const zoomInBtn = stage.querySelector('#uni-zoom-in');
    const zoomOutBtn = stage.querySelector('#uni-zoom-out');
    const zoomResetBtn = stage.querySelector('#uni-zoom-reset');

    if (zoomInBtn && track) {
      zoomInBtn.addEventListener('click', () => {
        currentZoomLevel = Math.min(currentZoomLevel + 0.15, 1.45);
        track.style.transform = `scale(${currentZoomLevel})`;
        if (zoomResetBtn) zoomResetBtn.textContent = `${Math.round(currentZoomLevel * 100)}%`;
      });
    }

    if (zoomOutBtn && track) {
      zoomOutBtn.addEventListener('click', () => {
        currentZoomLevel = Math.max(currentZoomLevel - 0.15, 0.7);
        track.style.transform = `scale(${currentZoomLevel})`;
        if (zoomResetBtn) zoomResetBtn.textContent = `${Math.round(currentZoomLevel * 100)}%`;
      });
    }

    if (zoomResetBtn && track) {
      zoomResetBtn.addEventListener('click', () => {
        currentZoomLevel = 1.0;
        track.style.transform = `scale(${currentZoomLevel})`;
        zoomResetBtn.textContent = '100%';
      });
    }

    // Watched Checkboxes
    stage.querySelectorAll('.uni-checkbox-input').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const movieId = checkbox.dataset.movieId;
        const isWatched = checkbox.checked;
        setMovieWatched(currentFranchise.id, movieId, isWatched);

        // Update node visuals
        const node = document.getElementById(`uni-node-${movieId}`);
        if (node) {
          node.classList.toggle('uni-node-watched', isWatched);
          const dot = node.querySelector('.uni-node__step-dot');
          if (dot) {
            const movieItem = movies.find((m) => String(m.id) === String(movieId));
            const orderNum = currentSortMode === 'story' ? movieItem?.story_order : movieItem?.release_order;
            dot.textContent = isWatched ? '✓' : orderNum || '•';
          }
        }

        updateProgressUI(movies);
      });
    });

    // Touch and drag-scroll on timeline
    const scrollWrap = stage.querySelector('#uni-timeline-scroll-wrap');
    if (scrollWrap) {
      let isDown = false;
      let startX;
      let scrollLeft;

      scrollWrap.addEventListener('mousedown', (e) => {
        if (e.target.closest('a, button, input, label')) return;
        isDown = true;
        startX = e.pageX - scrollWrap.offsetLeft;
        scrollLeft = scrollWrap.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        isDown = false;
      });

      scrollWrap.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollWrap.offsetLeft;
        const walk = (x - startX) * 1.5;
        scrollWrap.scrollLeft = scrollLeft - walk;
      });
    }
  }

  function updateProgressUI(movies) {
    if (!currentFranchise) return;
    const watchedCount = movies.filter((m) => isMovieWatched(currentFranchise.id, m.id)).length;
    const totalCount = movies.length;
    const percent = Math.round((watchedCount / totalCount) * 100);

    const progressText = document.getElementById('uni-progress-text');
    if (progressText) {
      progressText.textContent = `${watchedCount} of ${totalCount} movies watched (${percent}%)`;
    }

    const progressFill = document.getElementById('uni-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    const cardCount = document.getElementById(`uni-card-progress-${currentFranchise.id}`);
    if (cardCount) {
      cardCount.textContent = `👁️ ${watchedCount}/${totalCount}`;
    }
  }

  function handleContinueLeftOff(movies) {
    try {
      // Find the first unwatched movie
      const nextMovie = movies.find((m) => !isMovieWatched(currentFranchise.id, m.id));

      if (!nextMovie) {
        alert('🎉 Congratulations! You have watched every title in this universe map!');
        return;
      }

      const node = document.getElementById(`uni-node-${nextMovie.id}`);
      const scrollWrap = document.getElementById('uni-timeline-scroll-wrap');

      if (node && scrollWrap) {
        // Clear previous focus highlights
        document.querySelectorAll('.uni-node.uni-node-focus').forEach((n) => {
          n.classList.remove('uni-node-focus');
        });

        node.classList.add('uni-node-focus');

        // Scroll to the node smoothly
        const nodeLeft = node.offsetLeft;
        const containerWidth = scrollWrap.clientWidth;
        scrollWrap.scrollTo({
          left: Math.max(0, nodeLeft - containerWidth / 2 + node.clientWidth / 2),
          behavior: 'smooth'
        });

        setTimeout(() => {
          node.classList.remove('uni-node-focus');
        }, 3000);
      }
    } catch (e) {
      console.warn('Continue where I left off error:', e);
    }
  }

  // ---------- 6. INITIALIZATION ----------

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadFranchises);
    } else {
      loadFranchises();
    }
  }

  init();
})();
