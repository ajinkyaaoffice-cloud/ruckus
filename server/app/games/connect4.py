from __future__ import annotations

from typing import Any

from .base import Game, GameError

COLS, ROWS = 7, 6


class ConnectFour(Game):
    id = "connect4"
    name = "Connect Four"

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        # grid[row][col], row 0 is the top
        self.grid: list[list[int | None]] = [[None] * COLS for _ in range(ROWS)]
        self.turn = 0
        self.win_cells: list[tuple[int, int]] = []

    def _drop_row(self, col: int) -> int:
        for r in range(ROWS - 1, -1, -1):
            if self.grid[r][col] is None:
                return r
        return -1

    def _check(self, r: int, c: int) -> list[tuple[int, int]]:
        who = self.grid[r][c]
        for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
            cells = [(r, c)]
            for sign in (1, -1):
                rr, cc = r + dr * sign, c + dc * sign
                while 0 <= rr < ROWS and 0 <= cc < COLS and self.grid[rr][cc] == who:
                    cells.append((rr, cc))
                    rr += dr * sign
                    cc += dc * sign
            if len(cells) >= 4:
                return cells
        return []

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if self.over:
            raise GameError("Game is over")
        if action.get("type") != "drop":
            raise GameError("Unknown action")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        col = action.get("col")
        if not isinstance(col, int) or not 0 <= col < COLS:
            raise GameError("Bad column")
        row = self._drop_row(col)
        if row < 0:
            raise GameError("Column is full")
        self.grid[row][col] = self.turn
        self.emit("drop", row=row, col=col, who=self.turn)
        cells = self._check(row, col)
        if cells:
            self.win_cells = cells
            w = self.players[self.turn]
            self.finish([[w], [p for p in self.players if p != w]], "Four in a row!")
            return
        if all(self.grid[0][c] is not None for c in range(COLS)):
            self.finish([list(self.players)], "Board full — it's a draw")
            return
        self.turn = 1 - self.turn

    def view(self, pid: str) -> dict[str, Any]:
        return {"grid": self.grid, "turn": self.players[self.turn],
                "order": self.players, "win": self.win_cells}
