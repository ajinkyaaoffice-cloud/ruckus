from __future__ import annotations

import asyncio
import logging
import os
import re
import socket
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .games import REGISTRY, GameError
from .rooms import MAX_PLAYERS, Player, Room, RoomManager, clean_avatar, clean_name
from .store import make_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("ruckus")

store = make_store()
manager = RoomManager(store)
PID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
EMOTES = {"fire", "lol", "shock", "clap", "rage", "ko", "party", "boom"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(manager.reap())
    yield
    task.cancel()


app = FastAPI(title="Ruckus game server", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "rooms": len(manager.rooms), "store": store.kind}


@app.get("/api/games")
async def games() -> list[dict[str, Any]]:
    return [{"id": g.id, "name": g.name, "min": g.min_players, "max": g.max_players} for g in REGISTRY.values()]


@app.get("/api/net")
async def net() -> dict[str, Any]:
    """Best-guess LAN address so QR codes generated on localhost work for phones on the same Wi-Fi."""
    ip = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
    except OSError:
        pass
    return {"lan": ip, "public": os.getenv("PUBLIC_URL")}


@app.get("/api/rooms/{code}")
async def room_info(code: str) -> dict[str, Any]:
    room = manager.get(code)
    if not room:
        return {"exists": False}
    return {"exists": True, "code": room.code, "players": len(room.players),
            "full": len(room.players) >= MAX_PLAYERS, "phase": room.phase}


@app.get("/api/leaderboard")
async def leaderboard() -> list[dict[str, Any]]:
    try:
        return await store.leaderboard(10)
    except Exception:
        log.exception("leaderboard failed")
        return []


async def leave_current(pid: str, keep: Room | None = None) -> None:
    room = manager.find_player(pid)
    if room and room is not keep:
        room.remove(pid)
        if room.players:
            await room.sync()
            if room.game:
                await room.sync_game()
                if room.game.over:
                    await room._conclude()
        else:
            if room.loop_task:
                room.loop_task.cancel()
            manager.rooms.pop(room.code, None)


IDLE_TIMEOUT = 75.0


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    pid: str | None = None
    name, avatar = "Player", {}

    async def err(msg: str) -> None:
        await ws.send_json({"t": "error", "msg": msg})

    try:
        while True:
            # clients ping every few seconds while visible; long silence = a dead line
            msg = await asyncio.wait_for(ws.receive_json(), IDLE_TIMEOUT)
            if not isinstance(msg, dict):
                continue
            t = msg.get("t")
            if t == "ping":
                await ws.send_json({"t": "pong", "at": time.time()})
                continue
            if t == "hello":
                cand = str(msg.get("pid") or "")
                if not PID_RE.match(cand):
                    await err("Bad player id")
                    continue
                pid = cand
                name, avatar = clean_name(msg.get("name")), clean_avatar(msg.get("avatar"))
                room = manager.find_player(pid)
                if room:                                   # reconnect: re-attach socket
                    p = room.players[pid]
                    old, p.ws, p.left_at = p.ws, ws, None
                    if old is not None and old is not ws:
                        try:
                            await old.close()
                        except Exception:
                            pass
                    room.returned(pid)
                await ws.send_json({"t": "hello", "pid": pid, "room": room.code if room else None})
                if room:
                    await room.sync_all()
                continue
            if pid is None:
                await err("Say hello first")
                continue
            room = manager.find_player(pid)
            try:
                if t == "create":
                    await leave_current(pid)
                    room = manager.create()
                    p = Player(pid, name, avatar, ws=ws)
                    room.add(p)
                    await ws.send_json({"t": "joined", "code": room.code})
                    await room.sync()
                elif t == "join":
                    target = manager.get(msg.get("code"))
                    if not target:
                        raise GameError("No room with that code")
                    if pid in target.players:
                        p = target.players[pid]
                        p.ws, p.left_at = ws, None
                        target.returned(pid)
                    else:
                        if len(target.players) >= MAX_PLAYERS:
                            raise GameError(f"That room is full ({MAX_PLAYERS} max)")
                        await leave_current(pid, keep=target)
                        target.add(Player(pid, name, avatar, ws=ws))
                    await ws.send_json({"t": "joined", "code": target.code})
                    await target.sync()
                    if target.game:
                        await target.sync_game()
                elif t == "profile":
                    name, avatar = clean_name(msg.get("name")), clean_avatar(msg.get("avatar"))
                    if room:
                        p = room.players[pid]
                        p.name, p.avatar = name, avatar
                        if msg.get("ready") is not None:
                            p.status = "ready" if msg.get("ready") else "customizing"
                        await room.sync()
                        asyncio.create_task(manager.save_profile(p))
                elif not room:
                    raise GameError("You're not in a room")
                elif t == "start":
                    await room.start(pid, str(msg.get("game")), msg.get("options") or {})
                elif t == "act":
                    action = msg.get("action")
                    if isinstance(action, dict):
                        try:
                            await room.act(pid, action)
                        except GameError as e:
                            if action.get("type") != "move":
                                raise e
                elif t == "lobby":
                    await room.to_lobby(pid)
                elif t == "rematch":
                    if not room.game or not room.game.over:
                        raise GameError("Nothing to rematch")
                    await room.start(pid, room.game.id, room.game_options)
                elif t == "emote":
                    if msg.get("emoji") in EMOTES:
                        await room.broadcast({"t": "emote", "pid": pid, "emoji": msg["emoji"]})
                elif t == "leave":
                    await leave_current(pid)
                    await ws.send_json({"t": "left"})
                else:
                    raise GameError("Unknown message")
            except GameError as e:
                await err(str(e))
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        log.exception("socket error")
    finally:
        if pid:
            room = manager.find_player(pid)
            if room:
                p = room.players[pid]
                if p.ws is ws:
                    p.ws, p.left_at = None, time.time()
                    room.dropped(pid)
                    try:
                        await room.sync_all()
                    except Exception:
                        pass


# Serve the built frontend (web/dist) when present, with SPA fallback.
DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if DIST.exists():
    class HashedAssets(StaticFiles):
        """Built assets have content hashes in their names, so browsers can keep them forever."""

        async def get_response(self, path, scope):  # type: ignore[override]
            res = await super().get_response(path, scope)
            if res.status_code == 200:
                res.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return res

    app.mount("/assets", HashedAssets(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str) -> FileResponse:
        f = DIST / path
        if path and f.is_file() and DIST in f.resolve().parents:
            return FileResponse(f)
        # never cache the shell, so a new deploy reaches everyone on their next load
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
