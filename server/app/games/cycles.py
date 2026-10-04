"""Light Cycles — everyone drives at once and leaves a wall behind them.

Steer up/down/left/right (never straight back). Hit a wall, any trail or
another rider and you're out. Last rider moving takes the round; first to
WINS_NEEDED rounds wins. Trails travel as corner lists, so a state update
stays a few hundred bytes however long the round runs.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

W = H = 40
STEP = 1 / 11              # seconds per cell
DXY = [(0, -1), (1, 0), (0, 1), (-1, 0)]   # up, right, down, left
STARTS = [((5, 20), 1), ((34, 19), 3), ((19, 5), 2), ((20, 34), 0), ((34, 34), 0)]
MAX_ROUNDS = 7


class Cycles(Game):
    id = "cycles"
    name = "Light Cycles"
    max_players = 5
    tick_rate = 30.0

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.wins_needed = 3 if len(self.players) == 2 else 2
        self.wins = {p: 0 for p in self.players}
        self.round = 0
        self.riders: dict[str, dict[str, Any]] = {}
        self.grid: list[int] = []
        self.phase = "count"
        self.go_at = 0.0
        self.acc = 0.0
        self.last = self.now()
        self.round_winner: str | None = None
        self._new_round()

    def _new_round(self) -> None:
        self.round += 1
        self.grid = [-1] * (W * H)
        order = self.players[:]
        self.rng.shuffle(order)
        self.riders = {}
        for i, p in enumerate(order):
            (x, y), d = STARTS[i]
            self.riders[p] = {"x": x, "y": y, "d": d, "alive": True, "corners": [[x, y]], "queue": [], "slot": i}
            self.grid[y * W + x] = self.players.index(p)
        self.phase = "count"
        self.round_winner = None
        # the first round waits out the screen transition and the READY/GO slam
        wait = 5.0 if self.round == 1 else 3.0
        self.go_at = self.now() + wait
        self.emit("round", round=self.round)
        self.later(wait, self._go)

    def _go(self) -> None:
        self.phase = "run"
        self.acc = 0.0
        self.last = self.now()
        self.emit("go")

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "turn":
            raise GameError("Unknown action")
        d = action.get("dir")
        if not isinstance(d, int) or not 0 <= d < 4:
            raise GameError("Bad direction")
        r = self.riders.get(pid)
        if not r or not r["alive"]:
            return
        # buffer quick double-taps (e.g. a U-turn) so neither press is lost
        if len(r["queue"]) < 3:
            r["queue"].append(d)

    def update(self) -> None:
        super().update()
        if self.over or self.phase != "run":
            return
        t = self.now()
        self.acc += min(t - self.last, 0.2)
        self.last = t
        while self.acc >= STEP and self.phase == "run":
            self.acc -= STEP
            self._step()

    def _step(self) -> None:
        alive = [p for p, r in self.riders.items() if r["alive"]]
        targets: dict[str, tuple[int, int]] = {}
        for p in alive:
            r = self.riders[p]
            while r["queue"]:
                nd = r["queue"].pop(0)
                if nd != r["d"] and nd != (r["d"] + 2) % 4:
                    r["corners"].append([r["x"], r["y"]])
                    r["d"] = nd
                    break
            dx, dy = DXY[r["d"]]
            targets[p] = (r["x"] + dx, r["y"] + dy)
        dead: set[str] = set()
        for p, (x, y) in targets.items():
            if not (0 <= x < W and 0 <= y < H) or self.grid[y * W + x] != -1:
                dead.add(p)
        # two riders driving into the same square, or through each other
        for p in alive:
            for q in alive:
                if p < q:
                    rp, rq = self.riders[p], self.riders[q]
                    if targets[p] == targets[q] or (targets[p] == (rq["x"], rq["y"]) and targets[q] == (rp["x"], rp["y"])):
                        dead |= {p, q}
        for p in alive:
            r = self.riders[p]
            if p in dead:
                r["alive"] = False
                r["corners"].append([r["x"], r["y"]])
                self.emit("crash", pid=p, x=r["x"], y=r["y"])
                continue
            r["x"], r["y"] = targets[p]
            self.grid[r["y"] * W + r["x"]] = self.players.index(p)
        self.dirty = True
        left = [p for p in self.riders if self.riders[p]["alive"]]
        if len(left) <= 1:
            self._round_over(left[0] if left else None)

    def _round_over(self, winner: str | None) -> None:
        self.phase = "between"
        self.round_winner = winner
        if winner:
            self.wins[winner] += 1
        self.emit("roundover", winner=winner)
        if (winner and self.wins[winner] >= self.wins_needed) or self.round >= MAX_ROUNDS:
            self.later(2.2, self._end)
        else:
            self.later(2.6, self._new_round)

    def _end(self) -> None:
        ranking = self.rank_by(self.wins)
        self.finish(ranking, "Last light standing!" if len(ranking[0]) == 1 else "Neon stalemate",
                    {p: f"{self.wins[p]} round{'s' if self.wins[p] != 1 else ''}" for p in self.players})

    def forfeit(self, pid: str) -> None:
        if self.over or len(self.players) <= 2:
            return super().forfeit(pid)
        self.players.remove(pid)
        self.wins.pop(pid, None)
        r = self.riders.get(pid)
        if r and r["alive"]:
            r["alive"] = False
            left = [p for p in self.riders if self.riders[p]["alive"]]
            if self.phase == "run" and len(left) <= 1:
                self._round_over(left[0] if left else None)
        self.emit("left", pid=pid)

    def view(self, pid: str) -> dict[str, Any]:
        return {
            "w": W, "h": H, "phase": self.phase, "round": self.round, "winsNeeded": self.wins_needed,
            "wins": self.wins, "roundWinner": self.round_winner,
            "countdown": round(max(0.0, self.go_at - self.now()), 2) if self.phase == "count" else None,
            "riders": {p: {"x": r["x"], "y": r["y"], "d": r["d"], "alive": r["alive"], "corners": r["corners"], "slot": r["slot"]}
                       for p, r in self.riders.items()},
        }
