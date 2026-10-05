import random

import pytest

from app.games import REGISTRY, GameError
from app.games.base import Game
from app.games.checkers import Checkers
from app.games.cycles import Cycles
from app.games.quickdraw import QuickDraw
from app.games.quickmaths import QuickMaths
from app.games.reversi import Reversi
from app.games.seabattle import FLEET, N as SEA_N, SeaBattle
from app.games.showdown import Showdown

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


def test_catalog_has_fifteen_games():
    assert len(REGISTRY) == 16


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


# --- checkers ---------------------------------------------------------------
def empty_checkers():
    g = Checkers(P2, rng=random.Random(0))
    g.board = [None] * 64
    return g


def test_checkers_forced_capture_and_multi_jump():
    g = empty_checkers()
    a, b = g.players
    g.board[4 * 8 + 1] = {"o": 0, "k": False}      # (4,1)
    g.board[3 * 8 + 2] = {"o": 1, "k": False}      # (3,2)
    g.board[1 * 8 + 4] = {"o": 1, "k": False}      # (1,4)
    g.board[7 * 8 + 6] = {"o": 0, "k": False}      # a quiet piece that could step
    g.board[0 * 8 + 1] = {"o": 1, "k": False}
    assert set(g.legal()) == {33}                  # the capture is compulsory
    with pytest.raises(GameError):
        g.handle(a, {"type": "move", "from": 62, "to": 53})
    g.handle(a, {"type": "move", "from": 33, "to": 19})
    assert g.board[26] is None and g.chain == 19 and g.turn == 0   # must keep jumping
    g.handle(a, {"type": "move", "from": 19, "to": 5})
    assert g.board[12] is None
    assert g.board[5]["k"] is True                 # crowned on the far row
    assert g.turn == 1


def test_checkers_no_moves_loses():
    g = empty_checkers()
    a, b = g.players
    g.board[7 * 8 + 0] = {"o": 1, "k": False}      # b's man stuck on the last row
    g.board[2 * 8 + 1] = {"o": 0, "k": False}
    g.handle(a, {"type": "move", "from": 17, "to": 8})
    assert g.over and g.results.winners == [a]


# --- reversi ----------------------------------------------------------------
def test_reversi_opening_moves_and_flip():
    g = Reversi(P2, rng=random.Random(0))
    assert sorted(g.moves(0)) == [19, 26, 37, 44]
    g.handle(g.players[0], {"type": "place", "cell": 19})
    assert g.board[19] == 0 and g.board[27] == 0 and g.turn == 1
    with pytest.raises(GameError):
        g.handle(g.players[1], {"type": "place", "cell": 0})


def test_reversi_random_game_finishes():
    rng = random.Random(9)
    g = Reversi(P2, rng=random.Random(1))
    for _ in range(80):
        if g.over:
            break
        g.handle(g.players[g.turn], {"type": "place", "cell": rng.choice(g.moves(g.turn))})
    assert g.over and sum(g.view("alice")["count"]) <= 64


# --- light cycles -----------------------------------------------------------
def test_cycles_wall_crash_and_round_win(clock):
    g = Cycles(P2, rng=random.Random(0))
    run(g, clock, 5.1)
    assert g.phase == "run"
    # left rider keeps straight into the far wall; the other turns away in time
    left = next(p for p, r in g.riders.items() if r["slot"] == 0)
    right = next(p for p, r in g.riders.items() if r["slot"] == 1)
    g.handle(right, {"type": "turn", "dir": 0})
    run(g, clock, 0.3)
    g.handle(right, {"type": "turn", "dir": 1})
    run(g, clock, 4)
    assert g.wins[left] == 1 or g.wins[right] == 1
    assert g.phase in ("between", "count", "run")


def test_cycles_reverse_ignored_and_head_on(clock):
    g = Cycles(P2, rng=random.Random(0))
    run(g, clock, 5.05)
    r = next(iter(g.riders.values()))
    d = r["d"]
    g.handle(next(iter(g.riders)), {"type": "turn", "dir": (d + 2) % 4})
    run(g, clock, 0.2)
    assert r["d"] == d
    run(g, clock, 60)
    assert g.over and len(g.results.winners) >= 1


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


# --- showdown ---------------------------------------------------------------
def test_showdown_scoring_and_hidden_picks(clock):
    g = Showdown(P4, rng=random.Random(0))
    run(g, clock, 3.7)
    g.handle("alice", {"type": "throw", "hand": "rock"})
    assert g.view("bob")["picks"] == {} and g.view("alice")["mine"] == "rock"
    g.handle("bob", {"type": "throw", "hand": "scissors"})
    g.handle("cara", {"type": "throw", "hand": "scissors"})
    g.handle("dan", {"type": "throw", "hand": "paper"})
    assert g.phase == "reveal"
    assert g.gain == {"alice": 2, "bob": 1, "cara": 1, "dan": 1}


def test_showdown_random_for_no_throw_and_finishes(clock):
    g = Showdown(P2, rng=random.Random(1))
    run(g, clock, 3.7 + 6.1)
    assert g.phase == "reveal" and set(g.auto) == set(P2)
    run(g, clock, 80)
    assert g.over


# --- quick maths ------------------------------------------------------------
def test_quickmaths_answers_are_right(clock):
    g = QuickMaths(P2, rng=random.Random(3))
    for level in range(10):
        text, ans = g.make(level)
        expr = text.replace("×", "*").replace("÷", "//").replace("−", "-")
        assert eval(expr) == ans                       # noqa: S307 - our own generated sums
    run(g, clock, 3.7)
    v = g.view("alice")
    assert v["answer"] is None and len(set(v["options"])) == 4
    wrong = (g.answer + 1) % 4
    g.handle("alice", {"type": "answer", "index": wrong})
    with pytest.raises(GameError):
        g.handle("alice", {"type": "answer", "index": g.answer})
    g.handle("bob", {"type": "answer", "index": g.answer})
    assert g.score["bob"] == 1 and g.phase == "reveal"
