# Reel Check — TMDB API tester

A small, fast movie site for testing a TMDB API key: search bar, poster grid
with title/rating/release date, a details page, and pagination.

The key never touches the browser. A tiny Express server holds it in an
environment variable and proxies requests to TMDB; the frontend only ever
calls your own `/api/...` routes.

## 1. Get a TMDB API key

1. Create a free account at https://www.themoviedb.org/
2. Go to **Settings → API** and request a key (the "API Read Access Token"
   v3 `api_key` is what this app uses).

## 2. Configure

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```
TMDB_API_KEY=your_real_key_here
PORT=3000
```

## 3. Install & run

```bash
npm install
npm start
```

Open http://localhost:3000

The small dot in the top bar turns **green** if `/api/health` confirms TMDB
accepted your key, and **red** if something's wrong (bad key, no key, or
TMDB unreachable) — hover it to see the error message.

## How it's wired

- `server.js` — Express server. Reads `TMDB_API_KEY` from `process.env`
  (via `dotenv`) and exposes:
  - `GET /api/movies?query=&page=` — search, or popular movies if `query`
    is empty
  - `GET /api/movies/:id` — full details + top cast for one movie
  - `GET /api/health` — pings TMDB once to confirm the key works
- `public/` — plain HTML/CSS/JS frontend, no build step. Uses hash-based
  routing (`#/`, `#/?q=...&page=2`, `#/movie/123`) so back/forward and
  bookmarking work without a bundler or framework.

## Notes

- Never commit `.env` — it's already in `.gitignore`.
- If you deploy this, set `TMDB_API_KEY` as an environment variable on
  the host (Render, Railway, Fly, a VPS, etc.) rather than shipping a
  `.env` file.
- I've pre-filled `.env` with the key you pasted in this chat so it runs
  immediately. That key (and the RapidAPI key from earlier) went through
  plaintext chat, so it's good practice to rotate both in your account
  settings once you're done testing — then just update `.env`.
