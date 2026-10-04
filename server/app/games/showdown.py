"""Showdown — rock, paper, scissors for the whole room at once.

Everyone throws in secret before the clock runs out (no throw = a random
one). Then all hands are revealed together and every throw is compared with
every other: one point for each player you beat. Most points after ROUNDS
wins. Picks stay hidden until the reveal.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

ROUNDS = 7
PICK_SECONDS = 6.0
HANDS = ("rock", "paper", "scissors")
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}


class Showdown(Game):
    id = "showdown"
    name = "Showdown"
    max_players = 5

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.round = 0
        self.score = {p: 0 for p in self.players}
        self.phase = "intro"
        self.picks: dict[str, str] = {}
        self.auto: set[str] = set()
        self.gain: dict[str, int] = {}
        self.deadline = 0.0
        self.later(1.8, self._next)

    def _next(self) -> None:
        if self.round >= ROUNDS:
            return self._end()
        self.round += 1
        self.phase = "pick"
        self.picks = {}
        self.auto = set()
        self.gain = {}
        self.deadline = self.now() + PICK_SECONDS
        self.emit("pick", round=self.round)
        rnd = self.round
        self.later(PICK_SECONDS, lambda: self._reveal() if self.round == rnd and self.phase == "pick" else None)

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "throw":
            raise GameError("Unknown action")
        if self.phase != "pick":
            raise GameError("Wait for the next round")
        hand = action.get("hand")
        if hand not in HANDS:
            raise GameError("Rock, paper or scissors!")
        self.picks[pid] = hand
        self.emit("locked", pid=pid)
        if len(self.picks) == len(self.players):
            self._reveal()

    def _reveal(self) -> None:
        for p in self.players:
            if p not in self.picks:
                self.picks[p] = self.rng.choice(HANDS)
                self.auto.add(p)
        self.gain = {p: sum(1 for q in self.players if q != p and BEATS[self.picks[p]] == self.picks[q]) for p in self.players}
        for p, g in self.gain.items():
            self.score[p] += g
        self.phase = "reveal"
        self.emit("reveal", picks=self.picks, gain=self.gain)
        self.later(3.0, self._next)

    def _end(self) -> None:
        ranking = self.rank_by(self.score)
        self.finish(ranking, "Showdown settled!" if len(ranking[0]) == 1 else "Honours even",
                    {p: f"{self.score[p]} points" for p in self.players})

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        self.picks.pop(pid, None)
        self.emit("left", pid=pid)
        if self.phase == "pick" and len(self.picks) == len(self.players):
            self._reveal()

    def view(self, pid: str) -> dict[str, Any]:
        reveal = self.phase == "reveal"
        return {"round": self.round, "rounds": ROUNDS, "phase": self.phase, "score": self.score,
                "locked": sorted(self.picks) if not reveal else self.players,
                "mine": self.picks.get(pid),
                "picks": self.picks if reveal else {}, "auto": sorted(self.auto) if reveal else [],
                "gain": self.gain if reveal else {},
                "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if self.phase == "pick" else None}
