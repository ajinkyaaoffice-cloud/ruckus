from __future__ import annotations

from typing import Any

from .base import Game, GameError

# Glyph ids the client knows how to draw; each appears exactly twice.
GLYPHS = ["star", "moon", "bolt", "heart", "drop", "leaf", "sun", "ghost", "crown",
          "flower", "cherry", "rocket", "fish", "planet", "diamond", "note", "cloud", "eye"]


class Memory(Game):
    id = "memory"
    name = "Memory Match"
    max_players = 3

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        pairs = 18 if len(self.players) == 3 else 12   # 6x6 or 6x4
        self.cols = 6
        glyphs = self.rng.sample(GLYPHS, pairs)
        self.cards = glyphs * 2
        self.rng.shuffle(self.cards)
        self.owner: list[str | None] = [None] * len(self.cards)
        self.flipped: list[int] = []
        self.turn = 0
        self.locked = False
        self.score = {p: 0 for p in self.players}
        self.streak = 0

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if self.over or action.get("type") != "flip":
            raise GameError("Not now")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        if self.locked:
            raise GameError("Hold on…")
        i = action.get("card")
        if not isinstance(i, int) or not 0 <= i < len(self.cards) or self.owner[i] or i in self.flipped:
            raise GameError("Pick a face-down card")
        self.flipped.append(i)
        self.emit("flip", card=i, glyph=self.cards[i], pid=pid)
        if len(self.flipped) < 2:
            return
        a, b = self.flipped
        self.locked = True
        if self.cards[a] == self.cards[b]:
            self.later(0.7, lambda: self._match(pid))
        else:
            self.later(1.3, self._miss)

    def _match(self, pid: str) -> None:
        a, b = self.flipped
        self.owner[a] = self.owner[b] = pid
        self.score[pid] += 1
        self.streak += 1
        self.flipped = []
        self.locked = False
        self.emit("match", cards=[a, b], pid=pid, streak=self.streak)
        if all(self.owner):
            ranking = self.rank_by(self.score)
            self.finish(ranking, "Sharpest memory wins" if len(ranking[0]) == 1 else "Memory tie!",
                        {p: f"{self.score[p]} pairs" for p in self.players})

    def _miss(self) -> None:
        self.emit("miss", cards=list(self.flipped))
        self.flipped = []
        self.locked = False
        self.streak = 0
        self.turn = (self.turn + 1) % len(self.players)

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        cur = self.players[self.turn]
        self.players.remove(pid)
        if cur == pid:
            self.flipped, self.locked = [], False
            self.clear_timers()
            self.turn %= len(self.players)
        else:
            self.turn = self.players.index(cur)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        faces = [g if (self.owner[i] or i in self.flipped) else None for i, g in enumerate(self.cards)]
        return {"faces": faces, "owner": self.owner, "flipped": self.flipped, "cols": self.cols,
                "turn": self.players[self.turn], "score": self.score, "locked": self.locked}
