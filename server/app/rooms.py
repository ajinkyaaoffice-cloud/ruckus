"""Rooms: who is in them, which game is running, and the session scoreboard."""
from __future__ import annotations

import asyncio
import logging
import random
import re
import string
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

from .games import REGISTRY, Game, GameError
from .store import Store

log = logging.getLogger("ruckus.rooms")

MAX_PLAYERS = 5
CODE_ALPHABET = "".join(c for c in string.ascii_uppercase if c not in "IOQ")
RECONNECT_GRACE = 60.0   # how long a dropped player keeps their seat (and a paused game waits)
NET_INTERVAL = 1 / 30   # most game snapshots per second sent to clients
SEND_TIMEOUT = 2.5
RESUME_DELAY = 3.0       # countdown once everyone is back, so nobody is caught off guard
TRACK_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")   # a YouTube video id


def clean_name(name: Any) -> str:
    s = "".join(ch for ch in str(name or "") if ch.isprintable()).strip()[:16]
    return s or "Player"


def clean_avatar(avatar: Any) -> dict[str, Any]:
    if not isinstance(avatar, dict):
        return {}
    out: dict[str, Any] = {}
    for k, v in list(avatar.items())[:24]:
        if isinstance(k, str) and isinstance(v, (str, int, float, bool)) and len(str(v)) <= 40:
            out[k[:20]] = v
    return out


@dataclass
class Player:
    id: str
    name: str
    avatar: dict[str, Any]
    ws: WebSocket | None = None
    status: str = "customizing"          # customizing | ready
    joined: float = field(default_factory=time.time)
    left_at: float | None = None
    points: int = 0
    wins: int = 0
    played: int = 0

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "avatar": self.avatar, "status": self.status,
                "connected": self.ws is not None, "points": self.points, "wins": self.wins,
                "played": self.played}


class Room:
    def __init__(self, code: str, manager: "RoomManager") -> None:
        self.code = code
        self.manager = manager
        self.players: dict[str, Player] = {}
        self.host: str | None = None
        self.phase = "lobby"                  # lobby | playing
        self.game: Game | None = None
        self.game_options: dict[str, Any] = {}
        self.history: list[dict[str, Any]] = []
        self.loop_task: asyncio.Task[None] | None = None
        self.created = time.time()
        # players a running game is waiting on (pid -> when they dropped), and when play picks up again
        self.waiting: dict[str, float] = {}
        self.resume_at: float | None = None
        # shared background music: everyone hears the same track at the same spot
        self.music: dict[str, Any] = {"track": None, "playing": False, "pos": 0.0, "at": time.time(), "vol": 60, "by": None}

    # --- membership ---------------------------------------------------------
    def public(self) -> dict[str, Any]:
        return {
            "code": self.code, "host": self.host, "phase": self.phase,
            "players": [p.public() for p in self.players.values()],
            "game": ({"id": self.game.id, "participants": self.game.players, "over": self.game.over,
                      "options": self.game_options} if self.game else None),
            "history": self.history[-12:],
            "music": self.music,
            "now": time.time(),
        }

    def add(self, p: Player) -> None:
        self.players[p.id] = p
        if self.host is None or self.host not in self.players:
            self.host = p.id

    def remove(self, pid: str) -> None:
        self.players.pop(pid, None)
        if self.waiting.pop(pid, None) is not None and not self.waiting:
            self.resume_at = time.time() + RESUME_DELAY
        if self.game and not self.game.over and pid in self.game.players:
            self.game.forfeit(pid)
        if self.host == pid:
            live = [p for p in self.players.values() if p.ws]
            pool = live or list(self.players.values())
            self.host = pool[0].id if pool else None

    # --- messaging ----------------------------------------------------------
    async def send(self, p: Player, msg: dict[str, Any]) -> None:
        if p.ws is None:
            return
        ws = p.ws
        try:
            # a phone that went to sleep can stall a send forever; never let one
            # stuck socket hold up the rest of the room
            await asyncio.wait_for(ws.send_json(msg), SEND_TIMEOUT)
        except Exception:
            if p.ws is ws:
                p.ws, p.left_at = None, time.time()
                if self.dropped(p.id):
                    asyncio.create_task(self.sync_all())
                try:
                    await ws.close()
                except Exception:
                    pass

    async def broadcast(self, msg: dict[str, Any]) -> None:
        await asyncio.gather(*(self.send(p, msg) for p in list(self.players.values())))

    async def sync(self) -> None:
        await self.broadcast({"t": "room", "room": self.public()})

    async def sync_all(self) -> None:
        await self.sync()
        await self.sync_game()

    async def sync_game(self) -> None:
        g = self.game
        if not g:
            return
        events, g.events = g.events, []
        g.dirty = False
        pause = self.pause_info()

        def state(pid: str) -> dict[str, Any]:
            v = g.full_view(pid)
            v["pause"] = pause
            return v
        await asyncio.gather(*(self.send(p, {"t": "game", "state": state(p.id), "events": events})
                               for p in list(self.players.values())))

    # --- pausing when someone drops ------------------------------------------
    def pause_info(self) -> dict[str, Any] | None:
        g = self.game
        if not g or g.over or not g.paused:
            return None
        return {
            "waiting": [{"id": pid, "until": at + RECONNECT_GRACE} for pid, at in self.waiting.items()],
            "resumeAt": self.resume_at,
            "now": time.time(),
        }

    def dropped(self, pid: str) -> bool:
        """A player's line went dead. Freeze their game until they're back. True if that changed anything."""
        g = self.game
        if not g or g.over or pid not in g.players or pid in self.waiting:
            return False
        p = self.players.get(pid)
        self.waiting[pid] = (p.left_at if p and p.left_at else time.time())
        self.resume_at = None
        g.pause()
        g.emit("paused", pid=pid)
        return True

    def returned(self, pid: str) -> bool:
        """They reconnected. Once nobody is missing, play resumes after a short countdown."""
        if self.waiting.pop(pid, None) is None:
            return False
        if not self.waiting and self.game and not self.game.over:
            self.resume_at = time.time() + RESUME_DELAY
            self.game.emit("back", pid=pid)
            self._ensure_loop()
        return True

    # --- music ----------------------------------------------------------------
    def music_pos(self) -> float:
        m = self.music
        return m["pos"] + (time.time() - m["at"] if m["playing"] else 0.0)

    def music_op(self, pid: str, msg: dict[str, Any]) -> bool:
        m, op, now = self.music, msg.get("op"), time.time()
        who = self.players[pid].name if pid in self.players else None
        if op in ("select", "next"):
            track = str(msg.get("track") or "")
            if not TRACK_RE.match(track):
                raise GameError("Unknown song")
            # "next" comes from every player whose song just ended; only the first one counts
            if op == "next" and msg.get("from") != m["track"]:
                return False
            m.update(track=track, playing=True, pos=0.0, at=now)
        elif op == "play":
            if not m["track"]:
                return False
            m.update(pos=self.music_pos(), playing=True, at=now)
        elif op == "pause":
            m.update(pos=self.music_pos(), playing=False, at=now)
        elif op == "seek":
            try:
                pos = max(0.0, min(float(msg.get("pos")), 60 * 60.0))
            except (TypeError, ValueError):
                raise GameError("Bad position")
            m.update(pos=pos, at=now)
        elif op == "vol":
            try:
                m["vol"] = max(0, min(int(msg.get("vol")), 100))
            except (TypeError, ValueError):
                raise GameError("Bad volume")
        else:
            raise GameError("Unknown music action")
        m["by"] = who
        return True

    # --- games --------------------------------------------------------------
    def eligible(self) -> list[Player]:
        return [p for p in self.players.values() if p.status == "ready" and p.ws is not None]

    async def start(self, by: str, game_id: str, options: dict[str, Any]) -> None:
        if by != self.host:
            raise GameError("Only the host picks the game")
        cls = REGISTRY.get(game_id)
        if not cls:
            raise GameError("Unknown game")
        if self.game and not self.game.over:
            raise GameError("A game is already running")
        pool = self.eligible()
        if len(pool) < cls.min_players:
            raise GameError(f"{cls.name} needs {cls.min_players} ready players")
        # Fewest games played goes first so whoever sat out last time gets in.
        pool.sort(key=lambda p: (p.played, p.joined))
        chosen = pool[: cls.max_players]
        self.game_options = {k: v for k, v in (options or {}).items() if isinstance(v, (bool, int, str))}
        self.game = cls([p.id for p in chosen], self.game_options, random.Random())
        self.waiting.clear()
        self.resume_at = None
        self.phase = "playing"
        await self.sync()
        await self.sync_game()
        self._ensure_loop()

    def _ensure_loop(self) -> None:
        if self.loop_task and not self.loop_task.done():
            return
        self.loop_task = asyncio.create_task(self._loop())

    async def _loop(self) -> None:
        last_sync = 0.0
        try:
            while self.game and not self.game.over:
                g = self.game
                await asyncio.sleep(1 / g.tick_rate)
                if g is not self.game:
                    break
                if g.paused:
                    if self.resume_at is not None and time.time() >= self.resume_at and not self.waiting:
                        self.resume_at = None
                        g.resume()
                        g.emit("resumed")
                        await self.sync_game()
                    continue
                g.update()
                # physics may tick at 60 Hz, but phones only need ~30 snapshots a second
                # (clients extrapolate between them); events like hits still go out at once
                now = time.monotonic()
                if g.dirty and (g.events or now - last_sync >= NET_INTERVAL):
                    last_sync = now
                    await self.sync_game()
                if g.over:
                    await self._conclude()
        except Exception:
            log.exception("room loop crashed (%s)", self.code)

    async def act(self, pid: str, action: dict[str, Any]) -> None:
        g = self.game
        if not g or g.over:
            raise GameError("No game running")
        if g.paused:
            raise GameError("Paused until everyone is back")
        g.handle(pid, action)
        if g.dirty:
            await self.sync_game()
        if g.over:
            await self._conclude()

    async def _conclude(self) -> None:
        g = self.game
        if not g or not g.results or getattr(g, "_concluded", False):
            return
        g._concluded = True                     # type: ignore[attr-defined]
        res = g.results
        participants = list(dict.fromkeys(g.players + [p for grp in res.ranking for p in grp]))
        everyone_tied = len(res.ranking) == 1
        awards: dict[str, dict[str, int]] = {}
        for place, group in enumerate(res.ranking):
            for pid in group:
                if everyone_tied:
                    pts, win = 1, 0
                elif place == 0:
                    pts, win = 3, 1
                elif place == 1 and len(res.ranking) > 2:
                    pts, win = 1, 0
                else:
                    pts, win = 0, 0
                awards[pid] = {"points": pts, "win": win}
        for pid in participants:
            p = self.players.get(pid)
            if p:
                a = awards.get(pid, {"points": 0, "win": 0})
                p.points += a["points"]
                p.wins += a["win"]
                p.played += 1
        self.history.append({"game": g.id, "winners": res.winners, "tie": everyone_tied,
                             "summary": res.summary, "at": time.time()})
        await self.sync_game()
        await self.sync()
        roster = [{"id": pid, "name": self.players[pid].name, "avatar": self.players[pid].avatar}
                  for pid in participants if pid in self.players]
        asyncio.create_task(self.manager.persist_match(self.code, g.id, roster, res.to_dict(), awards))

    async def to_lobby(self, by: str) -> None:
        if by != self.host:
            raise GameError("Only the host can do that")
        if self.game and not self.game.over:
            raise GameError("Finish the game first")
        self.phase = "lobby"
        self.game = None
        await self.sync()


class RoomManager:
    def __init__(self, store: Store) -> None:
        self.store = store
        self.rooms: dict[str, Room] = {}

    def new_code(self) -> str:
        while True:
            code = "".join(random.choice(CODE_ALPHABET) for _ in range(4))
            if code not in self.rooms:
                return code

    def create(self) -> Room:
        room = Room(self.new_code(), self)
        self.rooms[room.code] = room
        return room

    def get(self, code: Any) -> Room | None:
        return self.rooms.get(str(code or "").upper().strip())

    def find_player(self, pid: str) -> Room | None:
        for r in self.rooms.values():
            if pid in r.players:
                return r
        return None

    async def persist_match(self, code, game, roster, results, awards) -> None:
        try:
            await self.store.record_match(code, game, roster, results, awards)
        except Exception:
            log.exception("could not persist match")

    async def save_profile(self, p: Player) -> None:
        try:
            await self.store.save_profile(p.id, p.name, p.avatar)
        except Exception:
            log.exception("could not persist profile")

    async def reap(self) -> None:
        """Drop players whose reconnect grace expired and rooms that emptied."""
        while True:
            await asyncio.sleep(5)
            now = time.time()
            for code, room in list(self.rooms.items()):
                gone = [p.id for p in room.players.values()
                        if p.ws is None and p.left_at and now - p.left_at > RECONNECT_GRACE]
                for pid in gone:
                    room.remove(pid)
                if gone and room.players:
                    await room.sync()
                    if room.game:
                        await room.sync_game()
                        if room.game.over:
                            await room._conclude()
                if not room.players:
                    if room.loop_task:
                        room.loop_task.cancel()
                    del self.rooms[code]
