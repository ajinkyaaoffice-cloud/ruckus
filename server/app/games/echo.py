"""Echo — a Simon-style memory duel played simultaneously.

Each round the pads flash a sequence one step longer than before. Everyone
repeats it at the same time; a wrong pad or running out of time knocks you
out. Last echo standing wins; ties are broken by total input time.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

PADS = 6


class Echo(Game):
    id = "echo"
    name = "Echo"
    max_players = 3

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.sequence: list[int] = [self.rng.randrange(PADS) for _ in range(2)]
        self.round = 0
        self.phase = "intro"
        self.alive = list(self.players)
        self.progress: dict[str, int] = {}
        self.done: dict[str, float] = {}
        self.survived = {p: 0 for p in self.players}
        self.time_used = {p: 0.0 for p in self.players}
        self.out_round: dict[str, int] = {}
        self.step_ms = 600
        self.started = 0.0
        self.deadline = 0.0
        self.later(1.8, self._watch)

    def _watch(self) -> None:
        self.round += 1
        self.sequence.append(self.rng.randrange(PADS))
        self.step_ms = max(300, 620 - self.round * 25)
        self.phase = "watch"
        self.progress = {p: 0 for p in self.alive}
        self.done = {}
        self.emit("watch", round=self.round)
        self.later(len(self.sequence) * self.step_ms / 1000 + 0.9, self._input)

    def _input(self) -> None:
        self.phase = "input"
        self.started = self.now()
        limit = 3.0 + len(self.sequence) * 1.0
        self.deadline = self.started + limit
        self.emit("input")
        rnd = self.round
        self.later(limit, lambda: self._timeout() if self.round == rnd and self.phase == "input" else None)

    def _timeout(self) -> None:
        for p in list(self.alive):
            if p not in self.done:
                self._knock_out(p)
        self._round_over()

    def _knock_out(self, p: str) -> None:
        self.alive.remove(p)
        self.out_round[p] = self.round
        self.emit("out", pid=p)

    def _round_over(self) -> None:
        for p in self.alive:
            self.survived[p] += 1
        self.phase = "between"
        if len(self.alive) <= 1 and len(self.players) > 1:
            self.later(1.2, self._end)
        else:
            self.emit("cleared", round=self.round)
            self.later(1.4, self._watch)

    def _end(self) -> None:
        def key(p: str) -> tuple[int, float]:
            return (-self.survived[p], self.time_used[p])
        ordered = sorted(self.players, key=key)
        ranking: list[list[str]] = []
        for p in ordered:
            prev = ranking[-1][0] if ranking else None
            if prev and self.survived[prev] == self.survived[p] and prev not in self.alive and p not in self.alive:
                ranking[-1].append(p)      # knocked out in the same round -> tie
            else:
                ranking.append([p])
        self.finish(ranking, f"Longest echo: {max(self.survived.values()) + 2} steps",
                    {p: f"{self.survived[p]} rounds · {self.time_used[p]:.1f}s" for p in self.players})

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "pad":
            raise GameError("Unknown action")
        if self.phase != "input" or pid not in self.alive or pid in self.done:
            raise GameError("Not now")
        pad = action.get("pad")
        step = self.progress[pid]
        if pad != self.sequence[step]:
            self.emit("wrong", pid=pid, pad=pad)
            self._knock_out(pid)
        else:
            self.progress[pid] = step + 1
            self.emit("tap", pid=pid, pad=pad)
            if self.progress[pid] == len(self.sequence):
                self.done[pid] = self.now() - self.started
                self.time_used[pid] += self.done[pid]
        if all(p in self.done for p in self.alive):
            self._round_over()

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        if pid in self.alive:
            self.alive.remove(pid)
        self.survived.pop(pid, None)
        self.time_used.pop(pid, None)
        self.emit("left", pid=pid)
        if self.phase == "input" and all(p in self.done for p in self.alive):
            self._round_over()

    def view(self, pid: str) -> dict[str, Any]:
        return {
            "phase": self.phase, "round": self.round, "pads": PADS, "length": len(self.sequence),
            "sequence": self.sequence if self.phase == "watch" else None,
            "stepMs": self.step_ms, "alive": self.alive, "progress": self.progress,
            "done": list(self.done), "survived": self.survived,
            "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if self.phase == "input" else None,
        }
