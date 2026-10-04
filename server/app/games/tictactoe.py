from __future__ import annotations

from typing import Any

from .base import Game, GameError

LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]


class TicTacToe(Game):
    id = "tictactoe"
    name = "Tic Tac Toe"

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)            # random starter; players[0] is X
        self.board: list[int | None] = [None] * 9  # index into players
        self.turn = 0
        self.line: tuple[int, int, int] | None = None

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if self.over:
            raise GameError("Game is over")
        if action.get("type") != "place":
            raise GameError("Unknown action")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        cell = action.get("cell")
        if not isinstance(cell, int) or not 0 <= cell < 9 or self.board[cell] is not None:
            raise GameError("That square is taken")
        self.board[cell] = self.turn
        self.emit("place", cell=cell, mark=self.turn)
        for line in LINES:
            a, b, c = (self.board[i] for i in line)
            if a is not None and a == b == c:
                self.line = line
                winner = self.players[a]
                self.finish([[winner], [p for p in self.players if p != winner]],
                            f"{'XO'[a]} takes it with three in a row")
                return
        if all(v is not None for v in self.board):
            self.finish([list(self.players)], "A perfectly balanced draw")
            return
        self.turn = 1 - self.turn

    def view(self, pid: str) -> dict[str, Any]:
        return {"board": self.board, "turn": self.players[self.turn],
                "marks": {p: "XO"[i] for i, p in enumerate(self.players)},
                "line": self.line}
