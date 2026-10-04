"""Quick Draw — a reflex duel for the whole room.

Each round everyone waits for the signal. Tumbleweeds and fake-outs roll by
first; tapping before the real "DRAW!" fouls you out of that round. After the
signal the fastest clean tap takes the point.

Fairness: phones show the signal at slightly different moments, so each
client reports how long *it* took from seeing the signal to the tap. The
server sanity-checks that number against its own clock and collects taps for
a short window before naming the winner, so a laggy connection isn't punished.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

ROUNDS = 7
WINDOW = 0.45          # seconds to keep collecting taps after the first one
TIMEOUT = 3.0
MIN_MS = 90            # faster than this is a guess, not a reaction


class QuickDraw(Game):
    id = "quickdraw"
    name = "Quick Draw"
    max_players = 5

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.round = 0
        self.score = {p: 0 for p in self.players}
        self.best: dict[str, int] = {}
        self.phase = "intro"
        self.fouled: set[str] = set()
        self.taps: dict[str, int] = {}
        self.drawn_at = 0.0
        self.winner: str | None = None
        self.fakes = 0
        self.later(2.0, self._next)

    def _next(self) -> None:
        if self.round >= ROUNDS:
            return self._end()
        self.round += 1
        self.phase = "wait"
        self.fouled = set()
        self.taps = {}
        self.winner = None
        self.emit("wait", round=self.round)
        delay = self.rng.uniform(1.8, 4.6)
        # later rounds get sneakier: one or two fake-outs before the real thing
        self.fakes = self.rng.choice([0, 0, 1] if self.round < 3 else [0, 1, 1, 2])
        rnd = self.round
        for i in range(self.fakes):
            t = delay * (i + 1) / (self.fakes + 1.2)
            self.later(t, lambda k=self.rng.choice(["tumbleweed", "bird", "dust"]): self.emit("fake", what=k) if self.round == rnd and self.phase == "wait" else None)
        self.later(delay, self._draw)

    def _draw(self) -> None:
        if self.phase != "wait":
            return
        self.phase = "draw"
        self.drawn_at = self.now()
        self.emit("draw", round=self.round)
        rnd = self.round
        self.later(TIMEOUT, lambda: self._resolve() if self.round == rnd and self.phase == "draw" else None)

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "tap":
            raise GameError("Unknown action")
        if pid in self.fouled or pid in self.taps:
            return
        if self.phase == "wait":
            self.fouled.add(pid)
            self.emit("foul", pid=pid)
            if len(self.fouled) == len(self.players):
                self.clear_timers()
                self._settle(None)
            return
        if self.phase != "draw":
            return
        elapsed = (self.now() - self.drawn_at) * 1000
        ms = action.get("ms")
        # trust the client's own reaction time, but never beyond what's physically possible
        if not isinstance(ms, (int, float)) or ms != ms:
            ms = elapsed
        ms = int(max(MIN_MS, min(float(ms), elapsed + 60)))
        first = not self.taps
        self.taps[pid] = ms
        self.emit("tap", pid=pid)
        if first:
            rnd = self.round
            self.later(WINDOW, lambda: self._resolve() if self.round == rnd and self.phase == "draw" else None)
        if len(self.taps) + len(self.fouled) == len(self.players):
            self._resolve()

    def _resolve(self) -> None:
        if not self.taps:
            return self._settle(None)
        pid = min(self.taps, key=lambda p: self.taps[p])
        self.score[pid] += 1
        for p, ms in self.taps.items():
            self.best[p] = min(self.best.get(p, 99999), ms)
        self._settle(pid)

    def _settle(self, pid: str | None) -> None:
        self.phase = "result"
        self.winner = pid
        self.emit("result", winner=pid, taps=self.taps)
        self.later(2.4, self._next)

    def _end(self) -> None:
        ranking = self.rank_by(self.score)
        # ties go to the single fastest draw of the match
        if len(ranking[0]) > 1:
            top = sorted(ranking[0], key=lambda p: self.best.get(p, 99999))
            if self.best.get(top[0], 99999) < self.best.get(top[1], 99999):
                ranking = [[top[0]], top[1:]] + ranking[1:]
        self.finish(ranking, "Fastest hands in the West", {
            p: f"{self.score[p]} wins · best {self.best[p]}ms" if p in self.best else f"{self.score[p]} wins" for p in self.players})

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        return {"round": self.round, "rounds": ROUNDS, "phase": self.phase, "score": self.score,
                "fouled": sorted(self.fouled), "tapped": sorted(self.taps),
                "taps": self.taps if self.phase == "result" else {}, "winner": self.winner}
