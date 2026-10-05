"""Rooms: who is in them, which game is running, and the session scoreboard."""
from __future__ import annotations

import asyncio
import logging
import random
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
RECONNECT_GRACE = 60.0   # default for how long a dropped player keeps their seat (and a paused game waits)
GRACE_CHOICES = (30, 60, 120, 300)
DEFAULT_SETTINGS: dict[str, Any] = {
    "locked": False,        # nobody new can join (people already in the room can always come back)
    "maxPlayers": MAX_PLAYERS,
    "anyonePicks": False,   # any player may start a game, not just the host
    "pauseOnDrop": True,    # freeze the game while someone reconnects
    "grace": int(RECONNECT_GRACE),
    "emotes": True,
}
NET_INTERVAL = 1 / 30   # most game snapshots per second sent to clients
SEND_TIMEOUT = 2.5
RESUME_DELAY = 3.0       # countdown once everyone is back, so nobody is caught off guard


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
        self.first_by_game: dict[str, str] = {}       # who opened the last game of each kind
        self.loop_task: asyncio.Task[None] | None = None
        self.created = time.time()
        # players a running game is waiting on (pid -> when they dropped), and when play picks up again
        self.waiting: dict[str, float] = {}
        self.resume_at: float | None = None
        self.held: str | None = None                  # the host paused the game (pid of who did it)
        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self.banned: dict[str, str] = {}             # kicked by the host (pid -> name); kept out until let back

    # --- membership ---------------------------------------------------------
    def public(self) -> dict[str, Any]:
        return {
            "code": self.code, "host": self.host, "phase": self.phase,
            "players": [p.public() for p in self.players.values()],
            "game": ({"id": self.game.id, "participants": self.game.players, "over": self.game.over,
                      "options": self.game_options} if self.game else None),
            "history": self.history[-12:],
            "settings": self.settings,
            "banned": [{"id": k, "name": v} for k, v in self.banned.items()],
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
            "held": self.held,
            "waiting": [{"id": pid, "until": at + self.grace} for pid, at in self.waiting.items()],
            "resumeAt": self.resume_at,
            "now": time.time(),
        }

    @property
    def grace(self) -> float:
        return float(self.settings["grace"])

    def dropped(self, pid: str) -> bool:
        """A player's line went dead. Freeze their game until they're back. True if that changed anything."""
        g = self.game
        if not self.settings["pauseOnDrop"]:
            return False
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
            if not self.held:
                self.resume_at = time.time() + RESUME_DELAY
            self.game.emit("back", pid=pid)
            self._ensure_loop()
        return True

    # --- host controls --------------------------------------------------------
    def require_host(self, by: str) -> None:
        if by != self.host:
            raise GameError("Only the host can change room settings")

    def can_join(self, pid: str) -> None:
        """Raise if pid may not take a new seat here."""
        if pid in self.banned:
            raise GameError("The host removed you from this room")
        if self.settings["locked"]:
            raise GameError("That room is locked")
        if len(self.players) >= self.settings["maxPlayers"]:
            raise GameError(f"That room is full ({self.settings['maxPlayers']} max)")

    def configure(self, by: str, patch: Any) -> None:
        self.require_host(by)
        if not isinstance(patch, dict):
            raise GameError("Bad settings")
        new = dict(self.settings)
        for k, v in patch.items():
            if k in ("locked", "anyonePicks", "pauseOnDrop", "emotes"):
                if not isinstance(v, bool):
                    raise GameError("Bad settings")
                new[k] = v
            elif k == "maxPlayers":
                if not isinstance(v, int) or isinstance(v, bool) or not 2 <= v <= MAX_PLAYERS:
                    raise GameError(f"Room size must be 2 to {MAX_PLAYERS}")
                new[k] = v
            elif k == "grace":
                if v not in GRACE_CHOICES:
                    raise GameError("Bad reconnect time")
                new[k] = v
            else:
                raise GameError("Unknown setting")
        was_pausing = self.settings["pauseOnDrop"]
        self.settings = new
        # switched off mid-pause: stop waiting and pick the game back up
        if was_pausing and not new["pauseOnDrop"] and self.waiting:
            self.waiting.clear()
            if self.game and not self.game.over and not self.held:
                self.resume_at = time.time() + RESUME_DELAY
                self._ensure_loop()

    def kick(self, by: str, target: Any) -> Player:
        self.require_host(by)
        p = self.players.get(str(target))
        if not p:
            raise GameError("They already left")
        if p.id == by:
            raise GameError("You can't kick yourself — use Leave")
        self.banned[p.id] = p.name
        self.remove(p.id)
        return p

    def make_host(self, by: str, target: Any) -> None:
        self.require_host(by)
        if str(target) not in self.players:
            raise GameError("They already left")
        self.host = str(target)

    def reset_scores(self, by: str) -> None:
        self.require_host(by)
        for p in self.players.values():
            p.points = p.wins = p.played = 0
        self.history.clear()

    def unban_all(self, by: str) -> None:
        self.require_host(by)
        self.banned.clear()

    def running(self) -> Game:
        if not self.game or self.game.over:
            raise GameError("No game running")
        return self.game

    def hold(self, by: str) -> None:
        """Host pause: everything freezes for everyone until the host resumes."""
        self.require_host(by)
        g = self.running()
        if self.held:
            raise GameError("Already paused")
        self.held = by
        self.resume_at = None
        g.pause()
        g.emit("hold", pid=by)

    def unhold(self, by: str) -> None:
        self.require_host(by)
        g = self.running()
        if not self.held:
            raise GameError("The game isn't paused")
        self.held = None
        g.emit("unhold", pid=by)
        if not self.waiting:
            self.resume_at = time.time() + RESUME_DELAY
            self._ensure_loop()

    def end_game(self, by: str) -> None:
        """Host abandons the current game: nobody scores, everyone goes back to the lobby."""
        self.require_host(by)
        self.running()
        if self.loop_task:
            self.loop_task.cancel()
            self.loop_task = None
        self.game = None
        self.phase = "lobby"
        self.held = None
        self.waiting.clear()
        self.resume_at = None

    # --- games --------------------------------------------------------------
    def eligible(self) -> list[Player]:
        return [p for p in self.players.values() if p.status == "ready" and p.ws is not None]

    async def start(self, by: str, game_id: str, options: dict[str, Any]) -> None:
        if by != self.host and not self.settings["anyonePicks"]:
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
        # Seats follow join order, and whoever opens passes round the table game after game.
        chosen.sort(key=lambda p: p.joined)
        ids = [p.id for p in chosen]
        last = self.first_by_game.get(game_id)
        seats = sorted(self.players.values(), key=lambda p: p.joined)
        first = ids[random.randrange(len(ids))]
        if last is not None:
            order = [p.id for p in seats]
            start = order.index(last) if last in order else -1
            for k in range(1, len(order) + 1):
                cand = order[(start + k) % len(order)]
                if cand in ids:
                    first = cand
                    break
        self.first_by_game[game_id] = first
        self.game = cls(ids, {**self.game_options, "first": first}, random.Random())
        self.held = None
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
                    if self.resume_at is not None and time.time() >= self.resume_at and not self.waiting and not self.held:
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
            raise GameError("The host paused the game" if self.held else "Paused until everyone is back")
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
        if by != self.host and not self.settings["anyonePicks"]:
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
                        if p.ws is None and p.left_at and now - p.left_at > room.grace]
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
