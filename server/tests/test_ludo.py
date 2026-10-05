import random

import pytest

from app.games import GameError
from app.games.ludo import HOME, Ludo

P2 = ["alice", "bob"]
P3 = ["alice", "bob", "cara"]


class Dice(random.Random):
    """A die that rolls whatever the test queues up."""
    def __init__(self, rolls):
        super().__init__(0)
        self.rolls = list(rolls)

    def randint(self, a, b):
        return self.rolls.pop(0)


def game(players, rolls, **opts):
    return Ludo(list(players), {"first": players[0], **opts}, rng=Dice(rolls))


def run_timers(g):
    due, g._timers = g._timers, []
    for _, fn in due:
        fn()


def test_need_six_to_leave_yard_and_bonus_roll():
    g = game(P2, [3, 6, 4])
    g.handle("alice", {"type": "roll"})
    assert g.phase == "wait" and not g.legal
    run_timers(g)
    assert g.players[g.turn] == "bob"
    g.handle("bob", {"type": "roll"})                 # 6: any yard token can come out
    assert g.phase == "move" and g.legal == [0, 1, 2, 3]
    g.handle("bob", {"type": "move", "token": 2})
    assert g.tokens["bob"][2] == 0 and g.players[g.turn] == "bob" and g.phase == "roll"
    g.handle("bob", {"type": "roll"})
    assert g.legal == [2]


def test_wrong_turn_and_illegal_token():
    g = game(P2, [6])
    with pytest.raises(GameError):
        g.handle("bob", {"type": "roll"})
    with pytest.raises(GameError):
        g.handle("alice", {"type": "move", "token": 0})
    g.handle("alice", {"type": "roll"})
    g.tokens["alice"][1] = HOME
    g.legal = g.legal_moves("alice", 6)
    with pytest.raises(GameError):
        g.handle("alice", {"type": "move", "token": 1})


def test_capture_on_plain_square():
    g = game(P2, [2])
    g.tokens["alice"][0] = 10                         # red square 10
    g.tokens["bob"][0] = 38                           # yellow: (26 + 38) % 52 = 12
    g.handle("alice", {"type": "roll"})
    run_timers(g)
    assert g.tokens["alice"][0] == 12 and g.tokens["bob"][0] == -1
    assert g.players[g.turn] == "alice" and g.phase == "roll" and g.captures["alice"] == 1


def test_safe_square_protects():
    g = game(P2, [3])
    g.tokens["alice"][0] = 5                          # -> 8, a star
    g.tokens["bob"][0] = 34                           # yellow: (26 + 34) % 52 = 8
    g.handle("alice", {"type": "roll"})
    run_timers(g)
    assert g.tokens["bob"][0] == 34 and g.players[g.turn] == "bob"


def test_exact_roll_needed_for_home():
    g = game(P2, [5, 1, 3])
    g.tokens["alice"] = [53, HOME, HOME, HOME]
    g.handle("alice", {"type": "roll"})               # 53 + 5 overshoots home
    assert g.phase == "wait"
    run_timers(g)
    g.handle("bob", {"type": "roll"})                 # bob stuck in the yard on a 1
    run_timers(g)
    g.handle("alice", {"type": "roll"})               # 53 + 3 = 56, home
    run_timers(g)
    assert g.over and g.results.winners == ["alice"]


def test_three_sixes_loses_turn():
    g = game(P2, [6, 6, 6])
    g.tokens["alice"][0] = 0
    for _ in range(2):
        g.handle("alice", {"type": "roll"})
        g.handle("alice", {"type": "move", "token": 0})
    g.handle("alice", {"type": "roll"})
    assert g.phase == "wait" and g.tokens["alice"][0] == 12
    run_timers(g)
    assert g.players[g.turn] == "bob"


def test_finisher_spectates_and_rest_play_on():
    g = game(P3, [1, 4])
    g.tokens["alice"] = [55, HOME, HOME, HOME]
    g.handle("alice", {"type": "roll"})
    run_timers(g)
    assert g.finished == ["alice"] and g.players == ["bob", "cara"] and not g.over
    assert g.players[g.turn] == "bob"
    with pytest.raises(GameError):
        g.handle("alice", {"type": "roll"})
    g.tokens["bob"] = [52, HOME, HOME, HOME]
    g.handle("bob", {"type": "roll"})
    run_timers(g)
    assert g.over and g.results.ranking == [["alice"], ["bob"], ["cara"]]


def test_quick_mode_needs_two():
    g = game(P2, [1], quick=True)
    g.tokens["alice"] = [55, HOME, -1, -1]
    g.handle("alice", {"type": "roll"})
    run_timers(g)
    assert g.over and g.results.winners == ["alice"]


def test_afk_player_is_rolled_and_moved_for():
    g = game(P2, [6, 2])
    run_timers(g)                                      # roll timeout: auto roll a 6
    assert g.phase == "move"
    run_timers(g)                                      # 4 yard tokens alike: auto move
    assert g.tokens["alice"].count(0) == 1 and g.phase == "roll"


def test_forfeit_on_turn_passes_and_ends():
    g = game(P3, [])
    g.forfeit("alice")
    assert g.players == ["bob", "cara"] and g.players[g.turn] == "bob" and not g.over
    g.forfeit("cara")
    assert g.over and g.results.ranking == [["bob"], ["alice", "cara"]]


def test_two_players_sit_opposite():
    g = game(P2, [])
    assert sorted(g.color.values()) == [0, 2]
