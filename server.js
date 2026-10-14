// server.js
// Small Express server that proxies requests to TMDB.
// The API key lives only in process.env (loaded from .env) and is
// NEVER sent to the browser — the frontend only ever talks to /api/*.

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5005;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_READ_ACCESS_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY && !TMDB_READ_ACCESS_TOKEN) {
  console.warn(
    '\n⚠️  Neither TMDB_API_KEY nor TMDB_READ_ACCESS_TOKEN is set. Check your .env file.\n'
  );
}

// Disable caching completely for local development & hot reload
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Provide watermark-free Unicorn Studio project file
app.get(['/embeds/Xi0C8EpVjxw1xspetKGl*', '/projects/Xi0C8EpVjxw1xspetKGl*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'Xi0C8EpVjxw1xspetKGl.json'));
});

app.use(express.static(__dirname, { etag: false, maxAge: 0 }));

// Helper: build TMDB request headers and URL
function tmdbRequest(pathname, params = {}) {
  const url = new URL(TMDB_BASE_URL + pathname);
  const headers = { accept: 'application/json' };

  if (TMDB_READ_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${TMDB_READ_ACCESS_TOKEN}`;
  } else if (TMDB_API_KEY) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  return { url, headers };
}

// Robust fetch helper with automatic retries and fresh sockets to prevent ECONNRESET
async function fetchTmdb(reqConfig, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(reqConfig.url, {
        headers: {
          ...reqConfig.headers,
          'User-Agent': 'CineFlex-Cinema/5.2',
          'Connection': 'close',
        },
      });
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
    }
  }
}

// In-memory cache for providers and movies to ensure zero-lag continuous streaming
let providersCache = { data: null, expiresAt: 0 };
const movieCache = new Map(); // id -> { data, expiresAt }

// GET /api/providers?region=US
app.get('/api/providers', async (req, res) => {
  try {
    const { region = 'US' } = req.query;
    if (providersCache.data && Date.now() < providersCache.expiresAt) {
      return res.json(providersCache.data);
    }

    const reqConfig = tmdbRequest('/watch/providers/movie', { watch_region: region });
    const tmdbRes = await fetchTmdb(reqConfig);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(tmdbRes.status).json({ error: data.status_message || 'Failed to fetch providers' });
    }

    // Curated ranking for prominent legal streaming providers
    const priority = [
      'Netflix', 'Amazon Prime Video', 'Disney Plus', 'Apple TV', 'Apple TV Plus', 'Hulu',
      'Max', 'HBO Max', 'Paramount Plus', 'Peacock', 'Crunchyroll', 'Starz', 'AMC Plus',
      'Tubi TV', 'Pluto TV', 'Freevee', 'Vudu'
    ];

    const results = (data.results || []).map(p => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: p.logo_path,
      displayPriority: p.display_priority,
    }));

    // Sort by priority match first, then display_priority
    results.sort((a, b) => {
      const idxA = priority.findIndex(name => a.name.toLowerCase().includes(name.toLowerCase()));
      const idxB = priority.findIndex(name => b.name.toLowerCase().includes(name.toLowerCase()));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.displayPriority - b.displayPriority;
    });

    const payload = { results: results.slice(0, 24) };
    providersCache = { data: payload, expiresAt: Date.now() + 60 * 60 * 1000 }; // 1 hr cache
    res.json(payload);
  } catch (err) {
    console.error('Error fetching watch providers:', err);
    res.status(500).json({ error: 'Failed to fetch watch providers' });
  }
});

// GET /api/movies
// Supports: query, category (trending, popular, top_rated, now_playing, upcoming),
// provider, monetization (free|ads), orig_lang, genre, sort_by, page, lang
app.get('/api/movies', async (req, res) => {
  try {
    const {
      query = '',
      page = '1',
      sort_by = 'popularity.desc',
      genre = '',
      lang = 'en-US',
      category = '',
      provider = '',
      monetization = '',
      orig_lang = '',
      region = 'US',
    } = req.query;

    const trimmed = query.trim();
    let reqConfig;

    const hasFilters = Boolean(provider || genre || orig_lang || monetization);

    if (trimmed) {
      reqConfig = tmdbRequest('/search/movie', {
        query: trimmed,
        page,
        language: lang,
        include_adult: 'false',
      });
    } else if (!hasFilters && category && category !== 'all') {
      switch (category) {
        case 'trending':
          reqConfig = tmdbRequest('/trending/movie/week', { language: lang, page });
          break;
        case 'popular':
          reqConfig = tmdbRequest('/movie/popular', { language: lang, page });
          break;
        case 'top_rated':
          reqConfig = tmdbRequest('/movie/top_rated', { language: lang, page });
          break;
        case 'now_playing':
          reqConfig = tmdbRequest('/movie/now_playing', { language: lang, page });
          break;
        case 'upcoming':
          reqConfig = tmdbRequest('/movie/upcoming', { language: lang, page });
          break;
        default:
          reqConfig = tmdbRequest('/discover/movie', {
            page,
            sort_by,
            include_adult: 'false',
            language: lang,
          });
      }
    } else {
      // Dynamic discover query
      const discoverParams = {
        page,
        sort_by,
        include_adult: 'false',
        include_video: 'false',
        language: lang,
      };

      if (category === 'top_rated') discoverParams.sort_by = 'vote_average.desc';
      if (category === 'now_playing') {
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];
        discoverParams['primary_release_date.gte'] = monthAgo;
        discoverParams['primary_release_date.lte'] = today;
      }
      if (category === 'upcoming') {
        const today = new Date().toISOString().split('T')[0];
        discoverParams['primary_release_date.gte'] = today;
      }

      if (genre) discoverParams.with_genres = genre;
      if (orig_lang) discoverParams.with_original_language = orig_lang;
      if (provider) {
        discoverParams.with_watch_providers = provider;
        discoverParams.watch_region = region;
      }
      if (monetization) {
        discoverParams.with_watch_monetization_types = monetization;
        discoverParams.watch_region = region;
      }

      reqConfig = tmdbRequest('/discover/movie', discoverParams);
    }

    const tmdbRes = await fetchTmdb(reqConfig);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(tmdbRes.status).json({
        error: data.status_message || 'TMDB request failed',
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching movies:', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// GET /api/movies/:id
app.get('/api/movies/:id', async (req, res) => {
  try {
    const { lang = 'en-US' } = req.query;
    const cacheKey = `${req.params.id}_${lang}`;
    const cached = movieCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    const reqConfig = tmdbRequest(`/movie/${req.params.id}`, {
      language: lang,
      append_to_response: 'credits,videos,watch/providers,similar,release_dates',
    });

    const tmdbRes = await fetchTmdb(reqConfig);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(tmdbRes.status).json({
        error: data.status_message || 'TMDB request failed',
      });
    }

    movieCache.set(cacheKey, { data, expiresAt: Date.now() + 15 * 60 * 1000 }); // 15 min cache
    res.json(data);
  } catch (err) {
    console.error('Error fetching movie details:', err);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Simple health check so you can confirm the key is working.
app.get('/api/health', async (req, res) => {
  if (!TMDB_API_KEY && !TMDB_READ_ACCESS_TOKEN) {
    return res.status(500).json({ ok: false, error: 'TMDB key or token not set' });
  }
  try {
    const reqConfig = tmdbRequest('/movie/popular', { page: '1' });
    const tmdbRes = await fetchTmdb(reqConfig);
    if (!tmdbRes.ok) {
      const data = await tmdbRes.json().catch(() => ({}));
      return res
        .status(tmdbRes.status)
        .json({ ok: false, error: data.status_message || 'TMDB rejected the key/token' });
    }
    res.json({ ok: true, auth: TMDB_READ_ACCESS_TOKEN ? 'bearer' : 'api_key' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not reach TMDB' });
  }
});

// Age Rating API
app.get('/api/movies/:id/rating', async (req, res) => {
  try {
    const reqConfig = tmdbRequest(`/movie/${req.params.id}/release_dates`);
    const tmdbRes = await fetchTmdb(reqConfig);
    const data = await tmdbRes.json();
    if (!tmdbRes.ok) return res.json({ certification: '' });
    
    const results = data.results || [];
    const us = results.find(r => r.iso_3166_1 === 'US') || results[0];
    const cert = us && us.release_dates ? (us.release_dates.find(d => d.certification)?.certification || '') : '';
    res.json({ certification: cert });
  } catch {
    res.json({ certification: '' });
  }
});

// SPA fallback: any non-/api route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Movie app running at http://localhost:${PORT}`);
  });
}

module.exports = app;
