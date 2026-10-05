"""Shared contract for every game in the suite.

A game is a pure-ish state machine owned by a Room. The room feeds it player
actions (``handle``) and wall-clock updates (``update``); after either call the
room checks ``dirty`` and broadcasts each player's personalised ``view``.
"""
from __future__ import annotations

import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


class GameError(Exception):
    """Raised for illegal moves. The message is shown to the offending player."""


@dataclass
class Results:
    ranking: list[list[str]]          # groups of tied player ids, best first
    summary: str                      # one-liner headline for the results screen
    details: dict[str, str] = field(default_factory=dict)  # per-player stat line

    @property
    def winners(self) -> list[str]:
        return self.ranking[0] if self.ranking else []

    def to_dict(self) -> dict[str, Any]:
        return {"ranking": self.ranking, "winners": self.winners,
                "summary": self.summary, "details": self.details}


class Game:
    id: str = "base"
    name: str = "Base"
    min_players: int = 2
    max_players: int = 2
    tick_rate: float = 10.0          # update() calls per second while running

    def __init__(self, players: list[str], options: dict[str, Any] | None = None,
                 rng: random.Random | None = None) -> None:
        if not (self.min_players <= len(players) <= self.max_players):
            raise GameError(f"{self.name} needs {self.min_players}-{self.max_players} players")
        self.players = list(players)
        self.options = options or {}
        self.rng = rng or random.Random()
        self.over = False
        self.results: Results | None = None
        self.awards: dict[str, dict[str, int]] | None = None   # session points each player got, set by the room
        self.dirty = True
        self.seq = 0
        self.instance = uuid.uuid4().hex[:10]
        self.events: list[dict[str, Any]] = []      # notable events since last broadcast (animation cues)
        # players who already finished (in finishing order); they leave `players` and watch the rest
        self.finished: list[str] = []
        self._timers: list[tuple[float, Callable[[], None]]] = []

    # pause bookkeeping (class defaults so subclasses can read the clock before super().__init__ ends)
    _paused_at: float | None = None
    _paused_total: float = 0.0

    # --- helpers -----------------------------------------------------------
    @staticmethod
    def wall() -> float:
        return time.monotonic()

    def now(self) -> float:
        """Game time: the wall clock, except it stands still while the game is paused,
        so every timer, deadline and physics step simply freezes and carries on later."""
        t = self._paused_at if self._paused_at is not None else self.wall()
        return t - self._paused_total

    @property
    def paused(self) -> bool:
        return self._paused_at is not None

    def pause(self) -> None:
        if self.over or self.paused:
            return
        self._paused_at = self.wall()
        self.dirty = True

    def resume(self) -> None:
        if self._paused_at is None:
            return
        self._paused_total += self.wall() - self._paused_at
        self._paused_at = None
        self.dirty = True

    def later(self, delay: float, fn: Callable[[], None]) -> None:
        self._timers.append((self.now() + delay, fn))

    def clear_timers(self) -> None:
        self._timers.clear()

    def emit(self, kind: str, /, **data: Any) -> None:
        self.seq += 1
        self.events.append({"kind": kind, "id": self.seq, **data})
        self.dirty = True

    def finish(self, ranking: list[list[str]], summary: str,
               details: dict[str, str] | None = None) -> None:
        self.over = True
        self.results = Results(ranking, summary, details or {})
        self.clear_timers()
        self.dirty = True

    def forfeit(self, pid: str) -> None:
        """A player left mid-game. Default: remaining players share the win."""
        if self.over:
            return
        rest = [p for p in self.players if p != pid]
        self.finish([rest, [pid]], "Opponent left the game")

    # --- room-facing API ---------------------------------------------------
    def update(self) -> None:
        if not self._timers:
            return
        t = self.now()
        due = [x for x in self._timers if x[0] <= t]
        if not due:
            return
        self._timers = [x for x in self._timers if x[0] > t]
        for _, fn in sorted(due, key=lambda x: x[0]):
            if not self.over:
                fn()

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        raise NotImplementedError

    def view(self, pid: str) -> dict[str, Any]:
        raise NotImplementedError

    def full_view(self, pid: str) -> dict[str, Any]:
        v = self.view(pid)
        v["game"] = self.id
        v["players"] = self.players
        v["finished"] = self.finished
        v["over"] = self.over
        v["seq"] = self.seq
        v["instance"] = self.instance
        v["results"] = self.results.to_dict() if self.results else None
        v["awards"] = self.awards
        return v

    def rank_by(self, score: dict[str, int]) -> list[list[str]]:
        """Group players by descending score (ties share a rank)."""
        return [[p for p in self.players if score.get(p, 0) == s]
                for s in sorted({score.get(p, 0) for p in self.players}, reverse=True)]

    def require_player(self, pid: str) -> None:
        if pid not in self.players:
            raise GameError("You are spectating this one")
