"""Sea Battle — hidden fleets on an 8x8 grid.

Each player gets a random fleet they can reshuffle until they press ready
(or the placement clock runs out). Then players take turns firing at the
other grid; a hit earns another shot. Sink the whole enemy fleet to win.
Ship positions are only ever sent to their owner, except once sunk.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError

N = 8
FLEET = [4, 3, 3, 2, 2]
PLACE_SECONDS = 40


class SeaBattle(Game):
    id = "seabattle"
    name = "Sea Battle"

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.rng.shuffle(self.players)
        self.ships: dict[str, list[list[int]]] = {p: self._random_fleet() for p in self.players}
        self.shots: dict[str, dict[int, bool]] = {p: {} for p in self.players}   # shots fired BY p: cell -> hit
        self.ready: set[str] = set()
        self.phase = "place"
        self.turn = 0
        self.deadline = self.now() + PLACE_SECONDS
        self.later(PLACE_SECONDS, self._begin)

    def _random_fleet(self) -> list[list[int]]:
        while True:
            taken: set[int] = set()
            fleet: list[list[int]] = []
            ok = True
            for size in FLEET:
                for _ in range(200):
                    horiz = self.rng.random() < 0.5
                    r = self.rng.randrange(N if horiz else N - size + 1)
                    c = self.rng.randrange(N - size + 1 if horiz else N)
                    cells = [r * N + c + (i if horiz else i * N) for i in range(size)]
                    # ships never touch, not even at the corners
                    halo = {rr * N + cc for x in cells for rr in range(x // N - 1, x // N + 2)
                            for cc in range(x % N - 1, x % N + 2) if 0 <= rr < N and 0 <= cc < N}
                    if not halo & taken:
                        taken |= set(cells)
                        fleet.append(cells)
                        break
                else:
                    ok = False
                    break
            if ok:
                return fleet

    def _other(self, pid: str) -> str:
        return self.players[1 - self.players.index(pid)]

    def _sunk(self, owner: str) -> list[list[int]]:
        hits = self.shots[self._other(owner)]
        return [s for s in self.ships[owner] if all(hits.get(c) for c in s)]

    def _begin(self) -> None:
        if self.phase != "place":
            return
        self.phase = "battle"
        self.ready = set(self.players)
        self.emit("battle")

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        kind = action.get("type")
        if self.phase == "place":
            if kind == "shuffle":
                if pid in self.ready:
                    raise GameError("You're already locked in")
                self.ships[pid] = self._random_fleet()
                self.dirty = True
            elif kind == "ready":
                self.ready.add(pid)
                self.emit("ready", pid=pid)
                if len(self.ready) == len(self.players):
                    self.clear_timers()
                    self._begin()
            else:
                raise GameError("Ships are still being placed")
            return
        if kind != "fire":
            raise GameError("Unknown action")
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        cell = action.get("cell")
        if not isinstance(cell, int) or not 0 <= cell < N * N:
            raise GameError("Off the map")
        if cell in self.shots[pid]:
            raise GameError("You already fired there")
        enemy = self._other(pid)
        hit = any(cell in s for s in self.ships[enemy])
        self.shots[pid][cell] = hit
        sunk = None
        if hit:
            ship = next(s for s in self.ships[enemy] if cell in s)
            if all(self.shots[pid].get(c) for c in ship):
                sunk = ship
        self.emit("shot", by=pid, cell=cell, hit=hit, sunk=sunk)
        if hit and len(self._sunk(enemy)) == len(FLEET):
            self.finish([[pid], [enemy]], "Fleet sunk!",
                        {p: f"{sum(self.shots[p].values())} hits from {len(self.shots[p])} shots" for p in self.players})
            return
        if not hit:
            self.turn = 1 - self.turn

    def view(self, pid: str) -> dict[str, Any]:
        me = pid if pid in self.players else self.players[0]
        foe = self._other(me)
        reveal = self.over
        return {
            "phase": self.phase, "turn": self.players[self.turn] if self.phase == "battle" else None,
            "ready": sorted(self.ready),
            "timeLeft": round(max(0.0, self.deadline - self.now()), 1) if self.phase == "place" else None,
            "me": me, "foe": foe,
            "fleet": FLEET, "size": N,
            # my own sea: my ships + where the enemy has fired
            "myShips": self.ships[me] if pid in self.players or reveal else [],
            "incoming": [[c, h] for c, h in self.shots[foe].items()],
            # their sea: my shots, and only the ships I've finished off
            "outgoing": [[c, h] for c, h in self.shots[me].items()],
            "foeSunk": self.ships[foe] if reveal else self._sunk(foe),
            "mySunk": len(self._sunk(me)),
        }
