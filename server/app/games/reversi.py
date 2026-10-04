"""Reversi. Place a disc so it sandwiches a straight line of the opponent's
discs between it and another of yours — every sandwiched disc flips. If you
have no such move your turn is skipped. When neither player can move, the
most discs wins."""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

N = 8
DIRS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


class Reversi(Game):
    id = "reversi"
    name = "Reversi"

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        self.board: list[int | None] = [None] * (N * N)
        m = N // 2
        self.board[(m - 1) * N + m - 1] = self.board[m * N + m] = 1
        self.board[(m - 1) * N + m] = self.board[m * N + m - 1] = 0
        self.turn = 0
        self.last: int | None = None
        self.skipped: str | None = None

    def flips(self, cell: int, who: int) -> list[int]:
        if self.board[cell] is not None:
            return []
        r, c = divmod(cell, N)
        out: list[int] = []
        for dr, dc in DIRS:
            run = []
            rr, cc = r + dr, c + dc
            while 0 <= rr < N and 0 <= cc < N and self.board[rr * N + cc] == 1 - who:
                run.append(rr * N + cc)
                rr, cc = rr + dr, cc + dc
            if run and 0 <= rr < N and 0 <= cc < N and self.board[rr * N + cc] == who:
                out += run
        return out

    def moves(self, who: int) -> list[int]:
        return [i for i in range(N * N) if self.flips(i, who)]

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "place":
            raise GameError("Unknown action")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        cell = action.get("cell")
        if not isinstance(cell, int) or not 0 <= cell < N * N:
            raise GameError("Off the board")
        flipped = self.flips(cell, self.turn)
        if not flipped:
            raise GameError("That spot doesn't flip anything")
        self.board[cell] = self.turn
        for f in flipped:
            self.board[f] = self.turn
        self.last = cell
        self.skipped = None
        self.emit("place", cell=cell, flipped=flipped, by=self.turn)
        nxt = 1 - self.turn
        if self.moves(nxt):
            self.turn = nxt
        elif self.moves(self.turn):
            self.skipped = self.players[nxt]
            self.emit("skip", pid=self.players[nxt])
        else:
            self._end()

    def _end(self) -> None:
        count = {p: sum(1 for v in self.board if v == i) for i, p in enumerate(self.players)}
        ranking = self.rank_by(count)
        self.finish(ranking, "Board locked — count 'em!" if len(ranking) > 1 else "Perfectly even!",
                    {p: f"{count[p]} discs" for p in self.players})

    def view(self, pid: str) -> dict[str, Any]:
        return {"board": self.board, "turn": self.players[self.turn], "order": self.players,
                "moves": self.moves(self.turn) if not self.over else [], "last": self.last, "skipped": self.skipped,
                "count": [sum(1 for v in self.board if v == i) for i in (0, 1)]}
