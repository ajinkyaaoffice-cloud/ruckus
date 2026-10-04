"""Dots and Boxes. Lines are addressed as ("h", r, c) or ("v", r, c).

With an N x M box grid there are (N+1) x M horizontal lines and N x (M+1)
vertical ones. Closing a box scores it and grants another move.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError


class Dots(Game):
    id = "dots"
    name = "Dots & Boxes"
    max_players = 3

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        self.rows = self.cols = 4 if len(self.players) == 2 else 5
        self.h = [[None] * self.cols for _ in range(self.rows + 1)]   # who drew it
        self.v = [[None] * (self.cols + 1) for _ in range(self.rows)]
        self.boxes: list[list[str | None]] = [[None] * self.cols for _ in range(self.rows)]
        self.turn = 0
        self.score = {p: 0 for p in self.players}

    def _closed(self, r: int, c: int) -> bool:
        return (self.h[r][c] is not None and self.h[r + 1][c] is not None
                and self.v[r][c] is not None and self.v[r][c + 1] is not None)

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if self.over or action.get("type") != "line":
            raise GameError("Not now")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        kind, r, c = action.get("kind"), action.get("r"), action.get("c")
        if not isinstance(r, int) or not isinstance(c, int):
            raise GameError("Bad line")
        if kind == "h":
            if not (0 <= r <= self.rows and 0 <= c < self.cols) or self.h[r][c] is not None:
                raise GameError("Line taken")
            self.h[r][c] = pid
            near = [(r - 1, c), (r, c)]
        elif kind == "v":
            if not (0 <= r < self.rows and 0 <= c <= self.cols) or self.v[r][c] is not None:
                raise GameError("Line taken")
            self.v[r][c] = pid
            near = [(r, c - 1), (r, c)]
        else:
            raise GameError("Bad line")
        won = []
        for br, bc in near:
            if 0 <= br < self.rows and 0 <= bc < self.cols and self.boxes[br][bc] is None and self._closed(br, bc):
                self.boxes[br][bc] = pid
                won.append([br, bc])
        self.score[pid] += len(won)
        self.emit("line", dir=kind, r=r, c=c, pid=pid, boxes=won)
        if all(all(row) for row in self.boxes):
            self.finish(self.rank_by(self.score), "Every box claimed", {p: f"{self.score[p]} boxes" for p in self.players})
            return
        if not won:
            self.turn = (self.turn + 1) % len(self.players)

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        cur = self.players[self.turn]
        self.players.remove(pid)
        self.turn = self.players.index(cur) if cur != pid else self.turn % len(self.players)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        return {"rows": self.rows, "cols": self.cols, "h": self.h, "v": self.v, "boxes": self.boxes,
                "turn": self.players[self.turn], "score": self.score}
