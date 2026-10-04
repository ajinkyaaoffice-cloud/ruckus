# Ruckus

Realtime party games for small groups. One person opens a room, friends join with a 4-letter code or by scanning a QR code, everyone builds a character, and the room plays from a shared hub. Scores carry across games.

**Games:** UNO (2–5 players, classic or modern deck, full rules including +4 challenges, swap-hands and UNO catches), Ping Pong (realtime), Tic Tac Toe, Connect Four, Dots & Boxes, Memory Match, Odd One Out (IQ race) and Echo.

## Stack

- **web/** — Vite, React, TypeScript, GSAP, Lenis, Zustand
- **server/** — Python FastAPI with a WebSocket per player. The server keeps the authoritative game state; clients only send actions.
- **Persistence** — Supabase when it's configured, otherwise a local SQLite file (`server/ruckus.db`). Stores player profiles, results and the leaderboard. Rooms themselves live in memory.

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

## Supabase (optional)

1. Create a project and run `supabase/schema.sql` in the SQL editor.
2. Set these before starting the server:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | Service-role key (server side only, never ship it to the browser) |
| `RUCKUS_DB` | Path of the SQLite fallback file (default `server/ruckus.db`) |
| `PUBLIC_URL` | Public base URL used in invite links and QR codes when hosted |

If the Supabase variables aren't set, the server uses SQLite.

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
