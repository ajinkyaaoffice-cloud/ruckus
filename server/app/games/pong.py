"""Server-authoritative realtime ping pong.

The table is vertical: W x H in abstract units. players[0] defends the bottom
edge, players[1] the top. Clients only send their desired paddle x; the server
integrates paddles and ball at 60 Hz with sub-stepping so fast balls can't
tunnel through paddles.
"""
from __future__ import annotations

import math
from typing import Any

from .base import Game, GameError

W, H = 1.0, 1.6
PAD_W, PAD_H, PAD_INSET = 0.22, 0.026, 0.06
BALL_R = 0.02
PAD_SPEED = 2.6
START_SPEED, MAX_SPEED, SPEEDUP = 0.8, 2.1, 1.06
SUBSTEPS = 4


class Pong(Game):
    id = "pong"
    name = "Ping Pong"
    tick_rate = 60.0

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.target = int(self.options.get("target", 7))
        self.paddle = {p: W / 2 for p in self.players}
        self.paddle_v = {p: 0.0 for p in self.players}
        self.want = {p: W / 2 for p in self.players}
        self.score = {p: 0 for p in self.players}
        self.ball = {"x": W / 2, "y": H / 2, "vx": 0.0, "vy": 0.0}
        self.rally = 0
        self.serve_at = 0.0
        self.last = self.now()
        self._serve(self.rng.choice([0, 1]), delay=2.4)

    def _serve(self, toward: int, delay: float = 1.3) -> None:
        self.ball = {"x": W / 2, "y": H / 2, "vx": 0.0, "vy": 0.0}
        self.rally = 0
        self.serve_at = self.now() + delay
        angle = self.rng.uniform(-0.5, 0.5)
        direction = 1 if toward == 0 else -1     # +y heads to the bottom player
        self._serve_v = (math.sin(angle) * START_SPEED, math.cos(angle) * START_SPEED * direction)

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if action.get("type") != "move":
            raise GameError("Unknown action")
        x = action.get("x")
        if isinstance(x, (int, float)) and math.isfinite(x):
            self.want[pid] = min(max(float(x), PAD_W / 2), W - PAD_W / 2)

    def update(self) -> None:
        super().update()
        t = self.now()
        dt = min(t - self.last, 0.05)
        self.last = t
        if self.over:
            return
        for p in self.players:
            dx = self.want[p] - self.paddle[p]
            step = max(-PAD_SPEED * dt, min(PAD_SPEED * dt, dx))
            self.paddle[p] += step
            self.paddle_v[p] = step / dt if dt else 0.0
        if self.serve_at:
            if t >= self.serve_at:
                self.serve_at = 0.0
                self.ball["vx"], self.ball["vy"] = self._serve_v
                self.emit("serve")
            self.dirty = True
            return
        h = dt / SUBSTEPS
        for _ in range(SUBSTEPS):
            if self._step(h):
                break
        self.dirty = True

    def _step(self, h: float) -> bool:
        b = self.ball
        b["x"] += b["vx"] * h
        b["y"] += b["vy"] * h
        if b["x"] < BALL_R:
            b["x"], b["vx"] = BALL_R, abs(b["vx"])
            self.emit("wall")
        elif b["x"] > W - BALL_R:
            b["x"], b["vx"] = W - BALL_R, -abs(b["vx"])
            self.emit("wall")

        for i, p in enumerate(self.players):
            py = H - PAD_INSET if i == 0 else PAD_INSET
            moving_in = b["vy"] > 0 if i == 0 else b["vy"] < 0
            face = py - PAD_H / 2 if i == 0 else py + PAD_H / 2
            reach = b["y"] + BALL_R >= face if i == 0 else b["y"] - BALL_R <= face
            behind = b["y"] > py + PAD_H if i == 0 else b["y"] < py - PAD_H
            if moving_in and reach and not behind and abs(b["x"] - self.paddle[p]) <= PAD_W / 2 + BALL_R:
                off = (b["x"] - self.paddle[p]) / (PAD_W / 2)        # -1 .. 1
                speed = min(math.hypot(b["vx"], b["vy"]) * SPEEDUP, MAX_SPEED)
                angle = max(-1.0, min(1.0, off)) * 1.0 + self.paddle_v[p] * 0.08
                angle = max(-1.1, min(1.1, angle))
                b["vx"] = math.sin(angle) * speed
                b["vy"] = -math.cos(angle) * speed if i == 0 else math.cos(angle) * speed
                b["y"] = face - BALL_R if i == 0 else face + BALL_R
                self.rally += 1
                self.emit("hit", by=p, x=b["x"], power=speed / MAX_SPEED)

        if b["y"] > H + BALL_R or b["y"] < -BALL_R:
            loser = 0 if b["y"] > H else 1
            winner = self.players[1 - loser]
            self.score[winner] += 1
            self.emit("point", by=winner, rally=self.rally)
            if self.score[winner] >= self.target:
                lp = self.players[loser]
                self.finish([[winner], [lp]],
                            f"{self.score[winner]} – {self.score[lp]}",
                            {p: f"{self.score[p]} points" for p in self.players})
            else:
                self._serve(loser)
            return True
        return False

    def view(self, pid: str) -> dict[str, Any]:
        return {
            "ball": {k: round(v, 4) for k, v in self.ball.items()},
            "paddles": {p: round(x, 4) for p, x in self.paddle.items()},
            "score": self.score,
            "serveIn": max(0.0, round(self.serve_at - self.now(), 2)) if self.serve_at else 0,
            "target": self.target,
            "dims": {"w": W, "h": H, "padW": PAD_W, "padH": PAD_H, "inset": PAD_INSET, "r": BALL_R},
        }
