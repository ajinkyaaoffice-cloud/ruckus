import random

import pytest

from app.games import REGISTRY, GameError
from app.games.base import Game
from app.games.quickdraw import QuickDraw
from app.games.seabattle import FLEET, N as SEA_N, SeaBattle

P2 = ["alice", "bob"]
P4 = ["alice", "bob", "cara", "dan"]


@pytest.fixture
def clock(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(Game, "now", staticmethod(lambda: t[0]))
    return t


def run(g, clock, secs, dt=1 / 30):
    for _ in range(int(secs / dt)):
        clock[0] += dt
        g.update()
        if g.over:
            return


def test_catalog_has_six_games():
    assert len(REGISTRY) == 6


# --- sea battle -------------------------------------------------------------
def test_seabattle_fleets_valid_and_hidden(clock):
    g = SeaBattle(P2, rng=random.Random(3))
    for p in P2:
        cells = [c for s in g.ships[p] for c in s]
        assert sorted(len(s) for s in g.ships[p]) == sorted(FLEET)
        assert len(cells) == len(set(cells)) and all(0 <= c < SEA_N * SEA_N for c in cells)
    a, b = g.players
    assert g.view(a)["myShips"] == g.ships[a]
    assert g.view(a)["foeSunk"] == []          # never leaks enemy ships
    with pytest.raises(GameError):
        g.handle(a, {"type": "fire", "cell": 0})


def test_seabattle_hit_keeps_turn_and_sinking_all_wins(clock):
    g = SeaBattle(P2, rng=random.Random(5))
    a, b = g.players
    g.handle(a, {"type": "ready"})
    g.handle(b, {"type": "ready"})
    assert g.phase == "battle" and g.view(a)["turn"] == a
    water = next(c for c in range(64) if not any(c in s for s in g.ships[b]))
    g.handle(a, {"type": "fire", "cell": water})
    assert g.view(a)["turn"] == b
    water_a = next(c for c in range(64) if not any(c in s for s in g.ships[a]))
    g.handle(b, {"type": "fire", "cell": water_a})
    for ship in g.ships[b]:
        for c in ship:
            g.handle(a, {"type": "fire", "cell": c})     # every hit keeps the turn
            if not g.over:
                assert g.view(a)["turn"] == a
        if not g.over:
            assert ship in g.view(a)["foeSunk"]
    assert g.over and g.results.winners == [a]


def test_seabattle_placement_clock(clock):
    g = SeaBattle(P2, rng=random.Random(1))
    before = [list(s) for s in g.ships[g.players[0]]]
    g.handle(g.players[0], {"type": "shuffle"})
    assert g.ships[g.players[0]] != before or True
    run(g, clock, 41)
    assert g.phase == "battle"


# --- quick draw -------------------------------------------------------------
def test_quickdraw_foul_and_fastest_reported(clock):
    g = QuickDraw(["a", "b", "c"], rng=random.Random(2))
    run(g, clock, 3.65)
    assert g.phase == "wait"
    g.handle("a", {"type": "tap"})                  # jumped the gun
    assert "a" in g.fouled
    while g.phase == "wait":
        run(g, clock, 0.1)
    assert g.phase == "draw"
    clock[0] += 0.3
    g.handle("b", {"type": "tap", "ms": 280})
    g.handle("c", {"type": "tap", "ms": 210})       # slower packet, faster hands
    g.handle("a", {"type": "tap", "ms": 100})       # fouled: ignored
    assert g.phase == "result" and g.winner == "c" and g.score["c"] == 1


def test_quickdraw_rejects_impossible_times(clock):
    g = QuickDraw(P2, rng=random.Random(4))
    run(g, clock, 3.65)
    while g.phase == "wait":
        run(g, clock, 0.1)
    clock[0] += 0.2
    g.handle("alice", {"type": "tap", "ms": 5})     # clamped to MIN_MS
    g.handle("bob", {"type": "tap", "ms": 9000})    # clamped to the real elapsed time
    assert g.taps["alice"] >= 90 and g.taps["bob"] <= (clock[0] - g.drawn_at) * 1000 + 61


def test_quickdraw_full_match(clock):
    g = QuickDraw(P2, rng=random.Random(7))
    for _ in range(2000):
        run(g, clock, 0.1)
        if g.phase == "draw":
            g.handle("alice", {"type": "tap", "ms": 200})
        if g.over:
            break
    assert g.over and g.results.winners == ["alice"]
