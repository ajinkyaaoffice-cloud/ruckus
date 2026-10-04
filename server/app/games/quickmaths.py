"""Quick Maths — a sum appears with four answers; first right tap scores.

Sums get harder each question (adding, then times tables, then two-step
sums). A wrong tap locks you out of that question. The answer stays on the
server until someone gets it or the clock runs out.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

QUESTIONS = 10
SECONDS = 12.0


class QuickMaths(Game):
    id = "quickmaths"
    name = "Quick Maths"
    max_players = 5

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.q = 0
        self.score = {p: 0 for p in self.players}
        self.wrong: dict[str, int] = {}
        self.phase = "intro"
        self.text = ""
        self.choices: list[int] = []
        self.answer = -1
        self.locked: set[str] = set()
        self.solved_by: str | None = None
        self.deadline = 0.0
        self.later(1.8, self._next)

    def make(self, level: int) -> tuple[str, int]:
        r = self.rng.randint
        if level < 3:
            a, b = r(2, 9 + level * 8), r(2, 9 + level * 8)
            return (f"{a} + {b}", a + b) if self.rng.random() < 0.6 else (f"{max(a, b)} − {min(a, b)}", max(a, b) - min(a, b))
        if level < 6:
            a, b = r(2, 6 + level), r(2, 9)
            return (f"{a} × {b}", a * b) if self.rng.random() < 0.7 else (f"{a * b} ÷ {b}", a)
        if level < 8:
            a, b, c = r(2, 9), r(2, 9), r(2, 20)
            return (f"{a} × {b} + {c}", a * b + c) if self.rng.random() < 0.5 else (f"{a} × {b} − {c}", a * b - c)
        a, b, c = r(11, 19), r(3, 9), r(2, 9)
        return (f"{a} × {b} − {c}", a * b - c) if self.rng.random() < 0.5 else (f"({a} + {c}) × {b}", (a + c) * b)

    def _options(self, ans: int) -> list[int]:
        near = [ans + d for d in (-10, -2, -1, 1, 2, 10) if ans + d >= 0]
        self.rng.shuffle(near)
        opts = {ans}
        for n in near:
            if len(opts) == 4:
                break
            opts.add(n)
        while len(opts) < 4:
            opts.add(ans + self.rng.randint(3, 15))
        out = list(opts)
        self.rng.shuffle(out)
        return out

    def _next(self) -> None:
        if self.q >= QUESTIONS:
            return self._end()
        self.q += 1
        self.text, ans = self.make(self.q - 1)
        self.choices = self._options(ans)
        self.answer = self.choices.index(ans)
        self.locked = set()
        self.solved_by = None
        self.phase = "play"
        self.deadline = self.now() + SECONDS
        self.emit("question", q=self.q)
        q = self.q
        self.later(SECONDS, lambda: self._reveal(None) if self.q == q and self.phase == "play" else None)

    def _reveal(self, by: str | None) -> None:
        self.phase = "reveal"
        self.solved_by = by
        self.emit("reveal", answer=self.answer, by=by)
        self.later(2.0, self._next)

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "answer":
            raise GameError("Unknown action")
        if self.phase != "play":
            raise GameError("Wait for the next one")
        if pid in self.locked:
            raise GameError("Locked out for this one")
        i = action.get("index")
        if not isinstance(i, int) or not 0 <= i < 4:
            raise GameError("Pick an answer")
        if i == self.answer:
            self.score[pid] += 1
            self._reveal(pid)
        else:
            self.locked.add(pid)
            self.wrong[pid] = self.wrong.get(pid, 0) + 1
            self.emit("wrong", pid=pid, index=i)
            if len(self.locked) == len(self.players):
                self._reveal(None)

    def _end(self) -> None:
        ranking = self.rank_by(self.score)
        self.finish(ranking, "Calculator brain!" if len(ranking[0]) == 1 else "Equal and opposite",
                    {p: f"{self.score[p]} right · {self.wrong.get(p, 0)} wrong" for p in self.players})

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        show = self.phase in ("play", "reveal")
        return {"q": self.q, "questions": QUESTIONS, "phase": self.phase, "score": self.score,
                "text": self.text if show else "", "options": self.choices if show else [],
                "answer": self.answer if self.phase == "reveal" else None, "solvedBy": self.solved_by,
                "locked": sorted(self.locked),
                "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if self.phase == "play" else None}
