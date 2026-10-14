/**
 * ============================================================================
 * FEATURE 1: MOOD-BASED MOVIE PICKER (mood.js)
 * Visual Cinema Intelligence — maps user emotions directly to TMDB movies
 * Wrapped in an IIFE to prevent polluting global scope.
 * ============================================================================
 */

(function () {
  'use strict';

  // ---------- 1. EDITABLE MOOD MAPPING OBJECT ----------
  // Students & developers: customize mood genres, keywords & descriptions here
  const MOOD_MAP = {
    happy: {
      id: 'happy',
      label: 'Happy',
      emoji: '😊',
      genreIds: '35,16,10751', // Comedy, Animation, Family
      keywords: 'comedy, heartwarming, feel-good',
      tagline: 'Feel-good comedy, laughter & uplifting adventures',
      sortBy: 'popularity.desc'
    },
    sad: {
      id: 'sad',
      label: 'Sad',
      emoji: '😢',
      genreIds: '18', // Drama
      keywords: 'tearjerker, emotional, melancholy',
      tagline: 'Deep, poignant & soul-stirring emotional journeys',
      sortBy: 'vote_average.desc'
    },
    heartbroken: {
      id: 'heartbroken',
      label: 'Heartbroken',
      emoji: '💔',
      genreIds: '10749,18', // Romance, Drama
      keywords: 'breakup, lost love, healing',
      tagline: 'Bittersweet romances, healing & moving love stories',
      sortBy: 'popularity.desc'
    },
    bored: {
      id: 'bored',
      label: 'Bored',
      emoji: '🥱',
      genreIds: '28,12,9648', // Action, Adventure, Mystery
      keywords: 'fast-paced, twist, gripping',
      tagline: 'Fast-paced plot twists & thrills to wake you right up',
      sortBy: 'popularity.desc'
    },
    hyped: {
      id: 'hyped',
      label: 'Hyped',
      emoji: '⚡',
      genreIds: '28,878,53', // Action, Sci-Fi, Thriller
      keywords: 'adrenaline, explosions, blockbuster',
      tagline: 'High-octane adrenaline, superhero clashes & epic spectacles',
      sortBy: 'popularity.desc'
    },
    scared: {
      id: 'scared',
      label: 'Scared',
      emoji: '😱',
      genreIds: '27,53', // Horror, Thriller
      keywords: 'nightmare, jump scare, psychological',
      tagline: 'Spine-chilling dread, dark suspense & nightmarish terrors',
      sortBy: 'popularity.desc'
    },
    romantic: {
      id: 'romantic',
      label: 'Romantic',
      emoji: '💖',
      genreIds: '10749,35', // Romance, Comedy
      keywords: 'chemistry, date night, true love',
      tagline: 'Sparkling romantic chemistry, passion & charming confessions',
      sortBy: 'popularity.desc'
    },
    motivation: {
      id: 'motivation',
      label: 'Need motivation',
      emoji: '🏆',
      genreIds: '18,36', // Drama, History
      keywords: 'underdog, ambition, triumph',
      tagline: 'Triumphant underdogs, true historical grit & pure inspiration',
      sortBy: 'vote_average.desc'
    },
    tired: {
      id: 'tired',
      label: 'Tired',
      emoji: '😴',
      genreIds: '16,35,10402', // Animation, Comedy, Music
      keywords: 'cozy, mellow, comfort watch',
      tagline: 'Low-effort comfort viewing, gentle pacing & warm smiles',
      sortBy: 'popularity.desc'
    }
  };

  const STORAGE_KEY_LAST_MOOD = 'mood-last-mood';
  const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

  let currentActiveMood = null;
  let cachedMoodResults = {}; // moodId -> [movies]

  // ---------- 2. HELPER UTILITIES ----------

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getStoredMood() {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_MOOD) || null;
    } catch (e) {
      return null;
    }
  }

  function saveStoredMood(moodId) {
    try {
      if (moodId) {
        localStorage.setItem(STORAGE_KEY_LAST_MOOD, moodId);
      } else {
        localStorage.removeItem(STORAGE_KEY_LAST_MOOD);
      }
    } catch (e) {
      // Fail quietly without interrupting UX
    }
  }

  // ---------- 3. UI INJECTION & RENDERING ----------

  function injectMoodSection() {
    try {
      // Prevent duplicate injection
      if (document.getElementById('mood-section')) return;

      const target = document.getElementById('catalog-section');
      if (!target || !target.parentNode) return;

      const section = document.createElement('section');
      section.id = 'mood-section';
      section.className = 'mood-section';
      section.setAttribute('aria-label', 'Mood-based movie picker');

      const lastMoodId = getStoredMood();
      const lastMoodData = lastMoodId ? MOOD_MAP[lastMoodId] : null;

      section.innerHTML = `
        <div class="mood-header">
          <div class="mood-title-wrap">
            <span class="mood-badge">✨ AI Curation</span>
            <h2 class="mood-title">How are you feeling right now?</h2>
          </div>
          ${
            lastMoodData
              ? `<button type="button" class="mood-shortcut-btn" id="mood-resume-shortcut" title="Restore previous session">
                   <span>↺ Back to your ${escapeHTML(lastMoodData.label)} picks</span>
                 </button>`
              : ''
          }
        </div>

        <div class="mood-buttons-grid" role="group" aria-label="Select your mood">
          ${Object.values(MOOD_MAP)
            .map(
              (m) => `
            <button type="button" class="mood-btn" data-mood-id="${m.id}" aria-pressed="false">
              <span class="mood-btn-emoji">${m.emoji}</span>
              <span class="mood-btn-text">${escapeHTML(m.label)}</span>
            </button>
          `
            )
            .join('')}
        </div>

        <div class="mood-action-bar" id="mood-action-bar" style="display: none;">
          <div class="mood-tagline" id="mood-tagline"></div>
          <div class="mood-actions-right">
            <button type="button" class="mood-surprise-btn" id="mood-surprise-btn" title="Pick a random movie from this mood">
              <span>🎲 Surprise Me</span>
            </button>
            <button type="button" class="mood-clear-btn" id="mood-clear-btn" title="Close mood picks">
              <span>✕ Close Picks</span>
            </button>
          </div>
        </div>

        <div class="mood-results-wrap" id="mood-results-wrap" style="display: none;">
          <div id="mood-results-container"></div>
        </div>
      `;

      target.parentNode.insertBefore(section, target);
      bindMoodEvents(section);
    } catch (err) {
      console.warn('Mood picker initialization skipped:', err);
    }
  }

  // ---------- 4. EVENT LISTENERS ----------

  function bindMoodEvents(section) {
    try {
      const buttons = section.querySelectorAll('.mood-btn');
      const actionBar = section.querySelector('#mood-action-bar');
      const resultsWrap = section.querySelector('#mood-results-wrap');
      const tagline = section.querySelector('#mood-tagline');
      const surpriseBtn = section.querySelector('#mood-surprise-btn');
      const clearBtn = section.querySelector('#mood-clear-btn');
      const resumeShortcut = section.querySelector('#mood-resume-shortcut');

      // Click on mood buttons
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const moodId = btn.dataset.moodId;
          if (currentActiveMood === moodId) {
            clearMoodSelection();
          } else {
            selectMood(moodId);
          }
        });
      });

      // Surprise me button
      if (surpriseBtn) {
        surpriseBtn.addEventListener('click', () => {
          handleSurpriseMe();
        });
      }

      // Clear button
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          clearMoodSelection();
        });
      }

      // Resume shortcut button
      if (resumeShortcut) {
        resumeShortcut.addEventListener('click', () => {
          const lastMoodId = getStoredMood();
          if (lastMoodId && MOOD_MAP[lastMoodId]) {
            selectMood(lastMoodId);
          }
        });
      }
    } catch (e) {
      console.warn('Error binding mood events:', e);
    }
  }

  // ---------- 5. LOGIC & API FETCH ----------

  async function selectMood(moodId) {
    try {
      const mood = MOOD_MAP[moodId];
      if (!mood) return;

      currentActiveMood = moodId;
      saveStoredMood(moodId);

      // Update button active state
      const section = document.getElementById('mood-section');
      if (!section) return;

      section.querySelectorAll('.mood-btn').forEach((b) => {
        const isActive = b.dataset.moodId === moodId;
        b.classList.toggle('mood-active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      // Show action bar & tagline
      const actionBar = section.querySelector('#mood-action-bar');
      const resultsWrap = section.querySelector('#mood-results-wrap');
      const tagline = section.querySelector('#mood-tagline');
      const resultsContainer = section.querySelector('#mood-results-container');

      if (actionBar) actionBar.style.display = 'flex';
      if (resultsWrap) resultsWrap.style.display = 'block';
      if (tagline) {
        tagline.innerHTML = `<strong>${mood.emoji} ${escapeHTML(mood.label)}:</strong> ${escapeHTML(mood.tagline)}`;
      }

      // Show loading indicator
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="mood-loading">
            <div class="mood-spinner"></div>
            <span>Gathering ${escapeHTML(mood.label.toLowerCase())} movies for you…</span>
          </div>
        `;
      }

      // Fetch or use cache
      let movies = cachedMoodResults[moodId];
      if (!movies) {
        const params = new URLSearchParams({
          genre: mood.genreIds,
          sort_by: mood.sortBy || 'popularity.desc',
          page: '1'
        });

        const res = await fetch(`/api/movies?${params.toString()}`);
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        movies = (data.results || []).slice(0, 10);
        cachedMoodResults[moodId] = movies;
      }

      renderMoodMovies(movies, mood);
    } catch (err) {
      console.warn('Failed to load mood movies:', err);
      const resultsContainer = document.getElementById('mood-results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="mood-empty">
            <p>Could not load recommendations at this moment. Please try again shortly.</p>
          </div>
        `;
      }
    }
  }

  function renderMoodMovies(movies, mood) {
    const resultsContainer = document.getElementById('mood-results-container');
    if (!resultsContainer) return;

    if (!movies || movies.length === 0) {
      resultsContainer.innerHTML = `
        <div class="mood-empty">
          <p>No titles found for this mood right now. Try another mood button!</p>
        </div>
      `;
      return;
    }

    const cardsHtml = movies
      .map((m) => {
        const year = m.release_date ? m.release_date.slice(0, 4) : '';
        const rating = m.vote_average ? m.vote_average.toFixed(1) : '—';
        const posterUrl = m.poster_path
          ? `${TMDB_POSTER_BASE}${m.poster_path}`
          : 'assets/powderplay-header-logo.png';

        return `
          <div class="mood-card" id="mood-movie-${m.id}" data-movie-id="${m.id}">
            <div class="mood-poster-wrap">
              <img src="${posterUrl}" alt="${escapeHTML(m.title)}" class="mood-poster" loading="lazy" />
              <span class="mood-rating-badge">★ ${rating}</span>
            </div>
            <div class="mood-card-body">
              <h3 class="mood-movie-title" title="${escapeHTML(m.title)}">${escapeHTML(m.title)}</h3>
              <div class="mood-meta-row">
                <span>${year}</span>
                <span>${escapeHTML(mood.label)}</span>
              </div>
              <a href="#/watch/${m.id}" class="mood-watch-btn" title="Stream ${escapeHTML(m.title)}">
                ▶ Stream Movie
              </a>
            </div>
          </div>
        `;
      })
      .join('');

    resultsContainer.innerHTML = `<div class="mood-grid">${cardsHtml}</div>`;
  }

  function clearMoodSelection() {
    currentActiveMood = null;
    const section = document.getElementById('mood-section');
    if (!section) return;

    section.querySelectorAll('.mood-btn').forEach((b) => {
      b.classList.remove('mood-active');
      b.setAttribute('aria-pressed', 'false');
    });

    const actionBar = section.querySelector('#mood-action-bar');
    const resultsWrap = section.querySelector('#mood-results-wrap');
    if (actionBar) actionBar.style.display = 'none';
    if (resultsWrap) resultsWrap.style.display = 'none';
  }

  function handleSurpriseMe() {
    try {
      if (!currentActiveMood) {
        // Pick random mood first
        const moodKeys = Object.keys(MOOD_MAP);
        const randomMoodKey = moodKeys[Math.floor(Math.random() * moodKeys.length)];
        selectMood(randomMoodKey);
        return;
      }

      const movies = cachedMoodResults[currentActiveMood] || [];
      if (movies.length === 0) return;

      const randomMovie = movies[Math.floor(Math.random() * movies.length)];
      const targetCard = document.getElementById(`mood-movie-${randomMovie.id}`);

      if (targetCard) {
        // Remove old highlights
        document.querySelectorAll('.mood-card.mood-highlight').forEach((c) => {
          c.classList.remove('mood-highlight');
        });

        targetCard.classList.add('mood-highlight');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Auto flash announcement
        const surpriseBtn = document.getElementById('mood-surprise-btn');
        if (surpriseBtn) {
          surpriseBtn.innerHTML = `<span>🎯 Picked: ${escapeHTML(randomMovie.title.slice(0, 16))}…</span>`;
          setTimeout(() => {
            surpriseBtn.innerHTML = '<span>🎲 Surprise Me</span>';
          }, 3500);
        }
      }
    } catch (e) {
      console.warn('Surprise me error:', e);
    }
  }

  // ---------- 6. INITIALIZATION HOOK ----------

  function init() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectMoodSection);
      } else {
        injectMoodSection();
      }

      // Also support SPA hash routing back to home list
      window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (!hash || hash === '#/' || hash.startsWith('#/?')) {
          setTimeout(injectMoodSection, 100);
        }
      });
    } catch (e) {
      console.warn('Mood picker initialization failed:', e);
    }
  }

  init();
})();
