"""Odd One Out — a visual-perception race.

Every round shows a grid of near-identical glyphs; exactly one differs (a
colour shade, rotation, mirror image, point count or size). First to tap it
scores. A wrong tap locks you out of that round. The answer never leaves the
server until the round is revealed.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

ROUNDS = 10
ASYM = ["arrow", "ell", "flag", "half", "bolt"]
SYMM = ["star", "blob", "ring", "gem", "flower"]
PALETTE = [(312, 80, 62), (195, 85, 55), (265, 70, 66), (25, 95, 60), (150, 60, 48), (48, 95, 55)]


class OddOneOut(Game):
    id = "oddone"
    name = "Odd One Out"
    max_players = 3

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.round = 0
        self.score = {p: 0 for p in self.players}
        self.phase = "intro"
        self.items: list[dict[str, Any]] = []
        self.size = 3
        self.answer = -1
        self.locked: set[str] = set()
        self.wrong: dict[str, int] = {}
        self.found_by: str | None = None
        self.kind = ""
        self.deadline = 0.0
        self.later(2.0, self._next_round)

    def _make_round(self) -> None:
        r = self.round
        self.size = min(3 + r // 2, 7)
        n = self.size * self.size
        hard = r / (ROUNDS - 1)                      # 0 .. 1
        kinds = ["hue", "rotate", "mirror", "size", "shape"]
        self.kind = kinds[(r + self.rng.randrange(len(kinds))) % len(kinds)] if r else "hue"
        h, s, l = self.rng.choice(PALETTE)
        if self.kind in ("rotate", "mirror"):
            shape = self.rng.choice(ASYM)
        elif self.kind == "shape":
            shape = "star"
        else:
            shape = self.rng.choice(ASYM + SYMM)
        base_rot = self.rng.choice([0, 90, 180, 270]) if shape in ASYM else 0
        base = {"shape": shape, "h": h, "s": s, "l": l, "rot": base_rot, "scale": 1.0, "flip": False, "pts": 5}
        odd = dict(base)
        if self.kind == "hue":
            odd["l"] = l + (14 - 9 * hard) * self.rng.choice([-1, 1])
            odd["h"] = h + (10 - 7 * hard)
        elif self.kind == "rotate":
            odd["rot"] = base_rot + self.rng.choice([-1, 1]) * (60 - 40 * hard)
        elif self.kind == "mirror":
            odd["flip"] = True
        elif self.kind == "size":
            odd["scale"] = 1.0 + (0.32 - 0.2 * hard) * self.rng.choice([-1, 1])
        elif self.kind == "shape":
            odd["pts"] = 6
        self.answer = self.rng.randrange(n)
        self.items = []
        for i in range(n):
            it = dict(odd if i == self.answer else base)
            # identical jitter on every glyph so the odd one can't be spotted by layout
            it["wob"] = round(self.rng.uniform(-1, 1), 2)
            self.items.append(it)

    def _next_round(self) -> None:
        if self.round >= ROUNDS:
            return self._end()
        self.round += 1
        self._make_round()
        self.locked = set()
        self.found_by = None
        self.phase = "ready"
        self.emit("ready", round=self.round)
        self.later(1.4, self._go)

    def _go(self) -> None:
        self.phase = "play"
        self.deadline = self.now() + 15
        self.emit("go", round=self.round)
        rnd = self.round
        self.later(15, lambda: self._reveal(None) if self.round == rnd and self.phase == "play" else None)

    def _reveal(self, by: str | None) -> None:
        self.phase = "reveal"
        self.found_by = by
        self.emit("reveal", answer=self.answer, by=by)
        self.later(2.2, self._next_round)

    def _end(self) -> None:
        ranking = self.rank_by(self.score)
        self.finish(ranking, "Eagle eyes!" if len(ranking[0]) == 1 else "Dead heat",
                    {p: f"{self.score[p]} found · {self.wrong.get(p, 0)} misses" for p in self.players})

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "pick":
            raise GameError("Unknown action")
        if self.phase != "play":
            raise GameError("Wait for it…")
        if pid in self.locked:
            raise GameError("Locked out this round")
        i = action.get("index")
        if not isinstance(i, int) or not 0 <= i < len(self.items):
            raise GameError("Bad pick")
        if i == self.answer:
            self.score[pid] += 1
            self._reveal(pid)
        else:
            self.locked.add(pid)
            self.wrong[pid] = self.wrong.get(pid, 0) + 1
            self.emit("wrong", pid=pid, index=i)
            if all(p in self.locked for p in self.players):
                self._reveal(None)

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        show = self.phase in ("play", "reveal")
        return {
            "round": self.round, "rounds": ROUNDS, "phase": self.phase, "size": self.size,
            "items": self.items if show else [],
            "answer": self.answer if self.phase == "reveal" else None,
            "foundBy": self.found_by, "locked": sorted(self.locked), "score": self.score,
            "kind": self.kind if self.phase == "reveal" else None,
            "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if self.phase == "play" else None,
        }
