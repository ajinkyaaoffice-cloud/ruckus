"""Ludo for 2-4 players.

* Each player has four tokens in their yard. Colours go clockwise round the
  board (red, green, yellow, blue); two players sit in opposite corners.
* Roll the die on your turn. A 6 is needed to bring a token out onto your start
  square. Move one token exactly the number rolled.
* The track is 52 squares. After 51 steps a token turns into its own home
  column (5 squares) and needs an exact roll to reach home (56 steps in all).
* Land on an opponent and they go back to their yard, unless the square is
  safe (every start square and the four stars). Your own tokens can share.
* Rolling a 6, capturing, or getting a token home earns another roll. Three
  6s in a row and the turn is lost.
* No legal move: the turn passes. A slow player is rolled/moved for after a
  timeout so the table never stalls.
* Get every token home (or two in Quick mode) to finish. Finishers watch; the
  others play on for the remaining places until one player is left.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError, Results

TRACK = 52
LAST_TRACK = 50          # progress 0..50 on the shared track
HOME = 56                # 51..55 home column, 56 home
SAFE = {0, 8, 13, 21, 26, 34, 39, 47}
ROLL_TIME = 20.0
MOVE_TIME = 20.0
COLOR_NAMES = ("red", "green", "yellow", "blue")


def ordinal(n: int) -> str:
    return f"{n}{'tsnrhtdd'[(n // 10 % 10 != 1) * (n % 10 < 4) * n % 10::4]}"


class Ludo(Game):
    id = "ludo"
    name = "Ludo"
    min_players = 2
    max_players = 4

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.seats = list(self.players)
        n = len(self.players)
        corners = {2: (0, 2), 3: (0, 1, 2), 4: (0, 1, 2, 3)}[n]
        self.color = {p: corners[i] for i, p in enumerate(self.players)}
        self.tokens: dict[str, list[int]] = {p: [-1, -1, -1, -1] for p in self.players}
        self.goal = 2 if self.options.get("quick") else 4
        self.left: list[str] = []
        self.captures: dict[str, int] = {p: 0 for p in self.players}
        first = self.options.get("first")
        self.turn = self.players.index(first) if first in self.players else self.rng.randrange(n)
        self.phase = "roll"                 # roll | move | wait
        self.dice: int | None = None
        self.sixes = 0
        self.legal: list[int] = []
        self.last: dict[str, Any] | None = None
        self.deadline = 0.0
        self._gen = 0                       # bumps whenever a pending auto-action becomes stale
        self._arm(ROLL_TIME, self._auto_roll)

    # --- geometry -----------------------------------------------------------
    def square(self, pid: str, progress: int) -> int | None:
        """Absolute track square for a token, or None in the yard / home column / home."""
        if progress < 0 or progress > LAST_TRACK:
            return None
        return (self.color[pid] * 13 + progress) % TRACK

    def legal_moves(self, pid: str, dice: int) -> list[int]:
        out = []
        for i, p in enumerate(self.tokens[pid]):
            if p == HOME:
                continue
            if p < 0:
                if dice == 6:
                    out.append(i)
            elif p + dice <= HOME:
                out.append(i)
        return out

    def home_count(self, pid: str) -> int:
        return sum(1 for p in self.tokens[pid] if p == HOME)

    # --- timers -------------------------------------------------------------
    def _arm(self, delay: float, fn) -> None:
        self._gen += 1
        gen = self._gen
        self.deadline = self.now() + delay

        def fire() -> None:
            if gen == self._gen and not self.over:
                fn()
        self.later(delay, fire)

    def _auto_roll(self) -> None:
        if self.phase == "roll":
            self._roll(self.players[self.turn], auto=True)

    def _auto_move(self) -> None:
        if self.phase == "move" and self.legal:
            pid = self.players[self.turn]
            self._move(pid, self._best(pid), auto=True)

    def _best(self, pid: str) -> int:
        """What a sensible player would do: capture, else get home, else leave the yard, else run the leader."""
        assert self.dice is not None
        best, score = self.legal[0], -1e9
        for i in self.legal:
            p = self.tokens[pid][i]
            to = 0 if p < 0 else p + self.dice
            sq = self.square(pid, to)
            s = to / 10
            if to == HOME:
                s += 50
            if sq is not None and sq not in SAFE and self._victims(pid, sq):
                s += 80
            if p < 0:
                s += 30
            if sq in SAFE:
                s += 5
            if s > score:
                best, score = i, s
        return best

    # --- actions ------------------------------------------------------------
    def handle(self, pid: str, action: dict[str, Any]) -> None:
        if pid in self.finished:
            raise GameError("You're home and dry — enjoy the show")
        self.require_player(pid)
        if self.over:
            raise GameError("Game over")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        t = action.get("type")
        if t == "roll":
            if self.phase != "roll":
                raise GameError("Move a token first")
            self._roll(pid)
        elif t == "move":
            if self.phase != "move":
                raise GameError("Roll first")
            tok = action.get("token")
            if tok not in self.legal:
                raise GameError("That token can't move")
            self._move(pid, tok)
        else:
            raise GameError("Unknown action")

    def _roll(self, pid: str, auto: bool = False) -> None:
        dice = self.rng.randint(1, 6)
        self.dice = dice
        self.sixes = self.sixes + 1 if dice == 6 else 0
        self.emit("roll", pid=pid, dice=dice, auto=auto, sixes=self.sixes)
        if self.sixes == 3:
            self.emit("three6", pid=pid)
            self.legal = []
            return self._wait_then(self._next_turn)
        self.legal = self.legal_moves(pid, dice)
        if not self.legal:
            self.emit("stuck", pid=pid, dice=dice)
            return self._wait_then(self._next_turn)
        self.phase = "move"
        starts = {self.tokens[pid][i] for i in self.legal}
        if len(starts) == 1:
            # only one real choice (or several identical yard tokens): make it for them
            self._arm(0.7, self._auto_move)
        else:
            self._arm(MOVE_TIME, self._auto_move)

    def _wait_then(self, fn) -> None:
        self.phase = "wait"
        self._arm(1.3, fn)

    def _victims(self, pid: str, sq: int) -> list[tuple[str, int]]:
        hit = []
        for q in self.players:
            if q == pid:
                continue
            for i, p in enumerate(self.tokens[q]):
                if self.square(q, p) == sq:
                    hit.append((q, i))
        return hit

    def _move(self, pid: str, tok: int, auto: bool = False) -> None:
        assert self.dice is not None
        frm = self.tokens[pid][tok]
        to = 0 if frm < 0 else frm + self.dice
        self.tokens[pid][tok] = to
        sq = self.square(pid, to)
        caught: list[dict[str, Any]] = []
        if sq is not None and sq not in SAFE:
            for q, i in self._victims(pid, sq):
                caught.append({"pid": q, "token": i, "from": self.tokens[q][i]})
                self.tokens[q][i] = -1
        self.captures[pid] += len(caught)
        self.last = {"pid": pid, "token": tok, "from": frm, "to": to, "caught": caught, "id": self.seq + 1}
        self.emit("move", pid=pid, token=tok, frm=frm, to=to, auto=auto, caught=caught, square=sq)
        for c in caught:
            self.emit("capture", pid=pid, victim=c["pid"], token=c["token"])
        home = to == HOME
        if home:
            self.emit("home", pid=pid, token=tok, count=self.home_count(pid))
        self.legal = []

        if self.home_count(pid) >= self.goal:
            self.finished.append(pid)
            self.emit("out", pid=pid, place=len(self.finished))
            self._retire(pid)
            if len(self.players) < 2:
                return self._finish_game()
            return self._begin_turn()

        if self.dice == 6 or caught or home:
            self.phase = "roll"
            self.emit("bonus", pid=pid, why="six" if self.dice == 6 else "capture" if caught else "home")
            self._arm(ROLL_TIME, self._auto_roll)
        else:
            self._next_turn()

    def _next_turn(self) -> None:
        self.turn = (self.turn + 1) % len(self.players)
        self._begin_turn()

    def _begin_turn(self) -> None:
        self.phase = "roll"
        self.sixes = 0
        self.legal = []
        self._arm(ROLL_TIME, self._auto_roll)
        self.dirty = True

    def _retire(self, pid: str) -> None:
        """Take pid out of the turn order; the turn moves to whoever sat after them."""
        idx = self.players.index(pid)
        cur = self.players[self.turn]
        self.players.remove(pid)
        if not self.players:
            return
        if cur == pid:
            self.turn = idx % len(self.players)
            self.sixes = 0
        else:
            self.turn = self.players.index(cur)

    def _finish_game(self) -> None:
        def progress(p: str) -> int:
            return sum(max(0, x) for x in self.tokens[p])
        ranking: list[list[str]] = [[p] for p in self.finished]
        rest = sorted(self.players, key=progress, reverse=True)
        for p in rest:
            if len(ranking) > len(self.finished) and progress(ranking[-1][0]) == progress(p):
                ranking[-1].append(p)
            else:
                ranking.append([p])
        if self.left:
            ranking.append(list(self.left))
        details: dict[str, str] = {}
        for i, p in enumerate(self.finished):
            details[p] = f"{ordinal(i + 1)} home · {self.captures[p]} capture{'s' if self.captures[p] != 1 else ''}"
        for p in self.players:
            details[p] = f"{self.home_count(p)}/{self.goal} home · {progress(p)} steps"
        for p in self.left:
            details[p] = "left the board"
        summary = "All tokens home!" if self.finished else "Last one on the board"
        self.phase = "wait"
        self.finish(ranking, summary, details)

    def forfeit(self, pid: str) -> None:
        if self.over or pid not in self.players:
            return
        self.left.append(pid)
        was_turn = self.players[self.turn] == pid
        self._retire(pid)
        self.emit("left", pid=pid)
        if len(self.players) < 2:
            return self._finish_game()
        if was_turn:
            self._begin_turn()

    # --- view ---------------------------------------------------------------
    def view(self, pid: str) -> dict[str, Any]:
        return {
            "seats": self.seats,
            "colors": self.color,
            "tokens": self.tokens,
            "turn": self.players[self.turn],
            "phase": self.phase,
            "dice": self.dice,
            "sixes": self.sixes,
            "legal": self.legal,
            "last": self.last,
            "goal": self.goal,
            "left": self.left,
            "captures": self.captures,
            "places": {p: i + 1 for i, p in enumerate(self.finished)},
            "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if self.phase in ("roll", "move") and not self.over else None,
            "timeTotal": ROLL_TIME if self.phase == "roll" else MOVE_TIME,
        }
