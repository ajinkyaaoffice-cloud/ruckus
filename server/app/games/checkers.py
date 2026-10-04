"""Checkers (English draughts) on an 8x8 board.

* Pieces live on dark squares; players[0] starts at the bottom and moves first.
* Men move one step diagonally forward; kings one step in any diagonal.
* Captures are compulsory. A capturing piece must keep jumping while it can,
  and the turn only passes when its chain is finished.
* Reaching the far row crowns a man, which ends the move.
* You lose with no pieces or no legal move. 40 moves in a row without a
  capture or a man moving is a draw.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

N = 8
QUIET_LIMIT = 40


class Checkers(Game):
    id = "checkers"
    name = "Checkers"

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        # board[cell] = None or {"o": owner index, "k": king}
        self.board: list[dict[str, Any] | None] = [None] * (N * N)
        for r in range(N):
            for c in range(N):
                if (r + c) % 2 == 1:
                    if r < 3:
                        self.board[r * N + c] = {"o": 1, "k": False}
                    elif r > 4:
                        self.board[r * N + c] = {"o": 0, "k": False}
        self.turn = 0
        self.chain: int | None = None          # piece that must keep jumping
        self.quiet = 0
        self.last: list[int] = []

    # --- move generation ----------------------------------------------------
    def _dirs(self, piece: dict[str, Any]) -> list[tuple[int, int]]:
        if piece["k"]:
            return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        return [(-1, -1), (-1, 1)] if piece["o"] == 0 else [(1, -1), (1, 1)]

    def _jumps(self, cell: int) -> list[tuple[int, int]]:
        piece = self.board[cell]
        if not piece:
            return []
        r, c = divmod(cell, N)
        out = []
        for dr, dc in self._dirs(piece):
            mr, mc, tr, tc = r + dr, c + dc, r + 2 * dr, c + 2 * dc
            if 0 <= tr < N and 0 <= tc < N:
                mid = self.board[mr * N + mc]
                if mid and mid["o"] != piece["o"] and self.board[tr * N + tc] is None:
                    out.append((tr * N + tc, mr * N + mc))
        return out

    def _steps(self, cell: int) -> list[int]:
        piece = self.board[cell]
        r, c = divmod(cell, N)
        return [(r + dr) * N + c + dc for dr, dc in self._dirs(piece)
                if 0 <= r + dr < N and 0 <= c + dc < N and self.board[(r + dr) * N + c + dc] is None]

    def legal(self, who: int | None = None) -> dict[int, list[int]]:
        """from-cell -> list of destination cells, respecting forced captures."""
        who = self.turn if who is None else who
        if self.chain is not None and who == self.turn:
            return {self.chain: [t for t, _ in self._jumps(self.chain)]}
        mine = [i for i, p in enumerate(self.board) if p and p["o"] == who]
        jumps = {i: [t for t, _ in self._jumps(i)] for i in mine}
        jumps = {i: t for i, t in jumps.items() if t}
        if jumps:
            return jumps
        steps = {i: self._steps(i) for i in mine}
        return {i: t for i, t in steps.items() if t}

    # --- actions ------------------------------------------------------------
    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "move":
            raise GameError("Unknown action")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        a, b = action.get("from"), action.get("to")
        moves = self.legal()
        if a not in moves:
            raise GameError("You must capture!" if any(abs(t - f) > N + 1 for f, ts in moves.items() for t in ts) else "That piece can't move")
        if b not in moves[a]:
            raise GameError("Not a legal move")
        piece = self.board[a]
        assert piece is not None
        jumped = next((m for t, m in self._jumps(a) if t == b), None)
        self.board[b], self.board[a] = piece, None
        captured = None
        if jumped is not None and abs(b - a) > N + 1:
            captured = jumped
            self.board[jumped] = None
        crowned = False
        row = b // N
        if not piece["k"] and ((piece["o"] == 0 and row == 0) or (piece["o"] == 1 and row == N - 1)):
            piece["k"] = True
            crowned = True
        self.quiet = 0 if captured is not None or not piece["k"] or crowned else self.quiet + 1
        self.last = [a, b]
        self.emit("move", frm=a, to=b, captured=captured, crowned=crowned, by=pid)
        # a capturing piece keeps going unless it just got crowned
        if captured is not None and not crowned and self._jumps(b):
            self.chain = b
            return
        self.chain = None
        self.turn = 1 - self.turn
        self._check_end()

    def _check_end(self) -> None:
        counts = [sum(1 for p in self.board if p and p["o"] == o) for o in (0, 1)]
        detail = {self.players[o]: f"{counts[o]} pieces left" for o in (0, 1)}
        if not self.legal():
            loser = self.players[self.turn]
            winner = self.players[1 - self.turn]
            self.finish([[winner], [loser]], "Wiped out!" if counts[self.turn] == 0 else "No moves left!", detail)
        elif self.quiet >= QUIET_LIMIT:
            self.finish([list(self.players)], "Kings dancing forever — a draw", detail)

    def view(self, pid: str) -> dict[str, Any]:
        return {"board": self.board, "turn": self.players[self.turn], "order": self.players,
                "moves": {str(k): v for k, v in self.legal().items()} if not self.over else {},
                "chain": self.chain, "last": self.last, "quiet": self.quiet}
