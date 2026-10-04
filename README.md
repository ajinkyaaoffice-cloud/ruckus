# Ruckus

Realtime party games for small groups. One person opens a room, friends join with a 4-letter code or by scanning a QR code, everyone builds a character, and the room plays from a shared hub. Scores carry across games.

**Games (15):** UNO (2–5 players, classic or modern deck, full rules including +4 challenges, swap-hands and UNO catches), Ping Pong (realtime), Light Cycles (realtime), Tic Tac Toe, Connect Four, Dots & Boxes, Checkers, Reversi, Sea Battle, Memory Match, Odd One Out (IQ race), Echo, Quick Draw, Showdown and Quick Maths. Every game screen is its own lazy-loaded chunk and has an illustrated rulebook.

## Stack

- **web/** — Vite, React, TypeScript, GSAP, Lenis, Zustand
- **server/** — Python FastAPI with a WebSocket per player. The server keeps the authoritative game state; clients only send actions.
- **Persistence** — Supabase when it's configured, otherwise a local SQLite file (`server/ruckus.db`). Stores player profiles, results and the leaderboard. Rooms themselves live in memory.

### Why the realtime layer isn't Supabase Realtime

Supabase Realtime relays messages between clients. It doesn't run code, so the game logic would have to live in the browsers. That breaks these games:

- UNO hands, Sea Battle fleets and Showdown throws would have to be sent to every player, so anyone could read them in devtools.
- Pong and Light Cycles need one machine stepping the physics on a fixed tick. Peers relaying positions to each other drift apart and argue about who scored.
- Turn timers, the Quick Draw reaction check and "first right answer wins" need one clock everyone trusts.

So the FastAPI server stays the referee over WebSockets, and Supabase is the database.

## Run it locally

Backend:

```bash
python3 -m venv server/.venv
```

```bash
server/.venv/bin/pip install -r server/requirements.txt
```

```bash
server/.venv/bin/uvicorn app.main:app --app-dir server --port 8000 --reload --reload-dir server/app
```

Frontend (in another terminal):

```bash
cd web && npm install && npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/ws` to the backend (override the target with `API_URL`). The dev server listens on your LAN, so phones on the same Wi-Fi can join through the QR code.

> `--reload` restarts the server whenever a file in `server/app` changes, and that clears every open room. Open a new room after editing server code.

### Single-process build

```bash
cd web && npm run build
```

When `web/dist` exists, FastAPI serves it with SPA fallback, so uvicorn alone serves the whole site on port 8000.

## Deploy

The repo ships a `Dockerfile` that builds the frontend and serves everything (site, `/api`, `/ws`) from one uvicorn process. It runs on any host that supports Docker and WebSockets: Render, Fly.io, Railway, Cloud Run and others.

**Render (blueprint included):**

1. Push the repo to GitHub.
2. In Render choose **New → Blueprint** and pick the repo. `render.yaml` sets up the service and its health check (`/api/health`).
3. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `PUBLIC_URL` (the site's address, e.g. `https://ruckus.onrender.com`) when it asks.

**Anywhere else:**

```bash
docker build -t ruckus .
```

```bash
docker run -p 8000:8000 --env-file .env ruckus
```

Copy `.env.example` to `.env` first. The container listens on `$PORT` (default 8000).

Things to know:

- **Run a single instance.** Rooms live in the server's memory, so a second instance would split players across two machines. One small instance handles plenty of rooms, since each room is a few kilobytes and games tick only while they're played.
- **A redeploy or restart ends the games in progress.** Players reconnect automatically, see that the room is gone, and can open a new one in a click. Profiles, scores and the leaderboard live in Supabase and survive.
- **Free tiers that sleep** (Render free, for example) drop open rooms when they spin down. Use an always-on plan for real sessions.
- Hashed assets are cached for a year and `index.html` is never cached, so a deploy reaches players on their next page load.
- If you host the frontend separately (Vercel, Netlify), build it with `VITE_WS_URL=wss://your-server/ws` and point `/api` at the server.

## Supabase

1. Create a project and run `supabase/schema.sql` in the SQL editor.
2. Set these before starting the server:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | Service-role key (server side only, never ship it to the browser) |
| `RUCKUS_DB` | Path of the SQLite fallback file (default `server/ruckus.db`) |
| `PUBLIC_URL` | Public base URL used in invite links and QR codes when hosted |

If the Supabase variables aren't set, the server uses SQLite (inside Docker that's `/data/ruckus.db`, so mount a volume there to keep it).

## Testing

```bash
cd server && .venv/bin/python -m pytest -q
```

The tests cover every game's rules, including randomised full UNO games with 2–5 players that check every card is accounted for.

To play without friends, a bot can join a room and play UNO, Pong, Tic Tac Toe and Connect Four:

```bash
server/.venv/bin/python scripts/bot.py ROOMCODE Bruno
```

Start several bots with different names to fill a 5-player UNO table.
