import random

import pytest

from app.games import REGISTRY, GameError
from app.games.connect4 import ConnectFour
from app.games.dots import Dots
from app.games.echo import Echo
from app.games.memory import Memory
from app.games.oddone import OddOneOut
from app.games.tictactoe import TicTacToe
from app.games.uno import Uno, build_deck

P2 = ["alice", "bob"]
P3 = ["alice", "bob", "cara"]


def card(cid, color, kind, value=None):
    return {"id": cid, "color": color, "kind": kind, "value": value}


def uno_fixture(players, top, hands, turn=0):
    g = Uno(list(players), rng=random.Random(1))
    g.players = list(players)
    g.hands = {p: list(h) for p, h in zip(players, hands)}
    g.discard = [top]
    g.color = top["color"]
    g.turn = turn
    g.direction = 1
    g.phase = "play"
    g.said_uno.clear()
    g.vulnerable.clear()
    g.challenge = None
    g.draw_pile = [card(900 + i, "green", "number", 5) for i in range(40)]
    return g


# --- tic tac toe / connect four --------------------------------------------
def test_tictactoe_win_and_turns():
    g = TicTacToe(P2, rng=random.Random(0))
    x, o = g.players
    with pytest.raises(GameError):
        g.handle(o, {"type": "place", "cell": 0})
    for who, cell in [(x, 0), (o, 3), (x, 1), (o, 4), (x, 2)]:
        g.handle(who, {"type": "place", "cell": cell})
    assert g.over and g.results.winners == [x] and g.line == (0, 1, 2)


def test_tictactoe_draw():
    g = TicTacToe(P2, rng=random.Random(0))
    x, o = g.players
    for i, cell in enumerate([0, 1, 2, 4, 3, 5, 7, 6, 8]):
        g.handle(x if i % 2 == 0 else o, {"type": "place", "cell": cell})
    assert g.over and len(g.results.ranking) == 1


def test_connect4_diagonal():
    g = ConnectFour(P2, rng=random.Random(0))
    a, b = g.players
    for who, col in [(a, 0), (b, 1), (a, 1), (b, 2), (a, 2), (b, 3), (a, 2), (b, 3), (a, 3), (b, 6), (a, 3)]:
        g.handle(who, {"type": "drop", "col": col})
    assert g.over and g.results.winners == [a]


def test_connect4_full_column():
    g = ConnectFour(P2, rng=random.Random(0))
    for i in range(6):
        g.handle(g.players[g.turn], {"type": "drop", "col": 0})
    with pytest.raises(GameError):
        g.handle(g.players[g.turn], {"type": "drop", "col": 0})


# --- UNO -------------------------------------------------------------------
def test_deck_sizes():
    assert len(build_deck(False)) == 108
    assert len(build_deck(True)) == 112


def test_uno_deal():
    g = Uno(P3, rng=random.Random(3))
    total = sum(len(h) for h in g.hands.values()) + len(g.draw_pile) + len(g.discard)
    assert total == 108
    assert all(len(h) >= 7 for h in g.hands.values())
    assert g.top["kind"] != "wild4"


def test_uno_matching_rules():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "blue", "number", 7), card(3, "blue", "number", 3), card(4, "blue", "skip"),
                      card(5, "red", "skip")], [card(6, "green", "number", 1)]])
    assert g.playable(card(2, "blue", "number", 7))
    assert not g.playable(card(3, "blue", "number", 3))
    assert not g.playable(card(4, "blue", "skip"))
    with pytest.raises(GameError):
        g.handle("alice", {"type": "play", "card": 3})
    g.handle("alice", {"type": "play", "card": 2})
    assert g.color == "blue" and g.players[g.turn] == "bob"


def test_two_player_skip_and_reverse_return_turn():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "red", "skip"), card(3, "red", "reverse"), card(4, "red", "number", 1)],
                     [card(6, "green", "number", 1)]])
    g.handle("alice", {"type": "play", "card": 2})
    assert g.players[g.turn] == "alice"
    g.handle("alice", {"type": "play", "card": 3})
    assert g.players[g.turn] == "alice"


def test_three_player_reverse_changes_direction():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "reverse"), card(9, "red", "number", 2)], [card(3, "green", "number", 1)],
                     [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2})
    assert g.direction == -1 and g.players[g.turn] == "cara"


def test_draw_two_forces_draw_and_skip():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "draw2"), card(9, "red", "number", 2)], [card(3, "green", "number", 1)],
                     [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2})
    assert len(g.hands["bob"]) == 3 and g.players[g.turn] == "cara"


def test_no_stacking_draw_two_on_draw_two_turn():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "draw2"), card(9, "red", "number", 2)], [card(3, "blue", "draw2")],
                     [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2})
    with pytest.raises(GameError):        # bob was skipped, can't answer with his own +2
        g.handle("bob", {"type": "play", "card": 3})


def test_wild_requires_color():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild"), card(9, "red", "number", 2)], [card(3, "green", "number", 1)]])
    with pytest.raises(GameError):
        g.handle("alice", {"type": "play", "card": 2})
    g.handle("alice", {"type": "play", "card": 2, "color": "green"})
    assert g.color == "green"


def test_wild4_challenge_guilty():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild4"), card(5, "red", "number", 2), card(6, "blue", "number", 3)],
                     [card(3, "green", "number", 1)], [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2, "color": "blue"})
    assert g.phase == "challenge" and g.players[g.turn] == "bob"
    g.handle("bob", {"type": "challenge"})
    assert len(g.hands["alice"]) == 6 and len(g.hands["bob"]) == 1
    assert g.players[g.turn] == "bob" and g.phase == "play"


def test_wild4_challenge_innocent_costs_six():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild4"), card(5, "blue", "number", 2), card(6, "yellow", "number", 3)],
                     [card(3, "green", "number", 1)], [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2, "color": "blue"})
    g.handle("bob", {"type": "challenge"})
    assert len(g.hands["bob"]) == 7 and g.players[g.turn] == "cara"
    rv = g.view("bob")["reveal"]                            # innocent: the challenger sees the proof
    assert not rv["guilty"] and len(rv["cards"]) == 2
    assert g.view("cara")["reveal"] is None


def test_wild4_accept():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild4"), card(5, "blue", "number", 2)], [card(3, "green", "number", 1)]])
    g.handle("alice", {"type": "play", "card": 2, "color": "blue"})
    g.handle("bob", {"type": "accept"})
    assert len(g.hands["bob"]) == 5 and g.players[g.turn] == "alice"


def test_draw_then_play_drawn_only():
    g = uno_fixture(P2, card(1, "green", "number", 7),
                    [[card(2, "red", "number", 1), card(8, "red", "number", 2)], [card(3, "blue", "number", 1)]])
    g.handle("alice", {"type": "draw"})          # draws green 5 -> playable
    assert g.phase == "drawn"
    with pytest.raises(GameError):
        g.handle("alice", {"type": "play", "card": 2})
    g.handle("alice", {"type": "play", "card": g.drawn_id})
    assert g.players[g.turn] == "bob"


def test_draw_unplayable_passes_turn():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "blue", "number", 1)], [card(3, "blue", "number", 1)]])
    g.draw_pile = [card(77, "yellow", "number", 2)]
    g.handle("alice", {"type": "draw"})
    assert g.players[g.turn] == "bob" and len(g.hands["alice"]) == 2


def test_uno_catch_penalty_and_window():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "number", 1), card(9, "blue", "number", 4)],
                     [card(3, "red", "number", 3), card(8, "red", "number", 5), card(7, "red", "number", 6)],
                     [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2})
    assert "alice" in g.vulnerable
    g.handle("cara", {"type": "catch", "target": "alice"})
    assert len(g.hands["alice"]) == 3 and not g.vulnerable


def test_uno_called_is_safe_and_window_closes():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "number", 1), card(9, "blue", "number", 4)],
                     [card(3, "red", "number", 3), card(8, "red", "number", 5)],
                     [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "uno"})
    g.handle("alice", {"type": "play", "card": 2})
    assert "alice" not in g.vulnerable
    # forgetful bob: window closes once cara acts
    g.handle("bob", {"type": "play", "card": 3})
    assert "bob" in g.vulnerable
    g.handle("cara", {"type": "draw"})
    with pytest.raises(GameError):
        g.handle("alice", {"type": "catch", "target": "bob"})


def test_round_scoring_includes_final_draw_two():
    g = uno_fixture(P2, card(1, "red", "number", 7),
                    [[card(2, "red", "draw2")], [card(3, "blue", "number", 9), card(4, "wild", "wild")]])
    g.draw_pile = [card(50, "red", "skip"), card(51, "green", "number", 4)]
    g.handle("alice", {"type": "uno"})
    g.handle("alice", {"type": "play", "card": 2})
    assert g.over and g.results.winners == ["alice"]
    assert g.scores["alice"] == 9 + 50 + 20 + 4


def test_swap_hands_and_custom():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "wild", "swap"), card(5, "red", "number", 1), card(6, "red", "number", 2)],
                     [card(3, "green", "number", 1)], [card(4, "green", "number", 2), card(7, "wild", "custom")]])
    g.handle("alice", {"type": "play", "card": 2, "color": "green", "target": "bob"})
    assert [c["id"] for c in g.hands["alice"]] == [3]
    assert len(g.hands["bob"]) == 2
    g.turn = 2
    g.handle("cara", {"type": "play", "card": 7, "color": "red"})
    assert len(g.hands["alice"]) == 3 and len(g.hands["bob"]) == 4


def test_start_card_rules():
    for kind, expect in [("skip", 2), ("draw2", 2), ("reverse", 0)]:
        g = Uno(P3, rng=random.Random(5))
        g.hands = {p: [] for p in P3}
        g.players = list(P3)
        g.discard, g.direction, g.dealer = [], 1, 0
        g.draw_pile = [card(500, "red", "number", 1)] * 5 + [card(501, "red", kind)]
        g._start()
        assert g.turn == expect, kind
        if kind == "draw2":
            assert len(g.hands["bob"]) == 2
        if kind == "reverse":
            assert g.direction == -1


def test_start_wild_lets_first_choose():
    g = Uno(P2, rng=random.Random(5))
    g.hands = {p: [] for p in P2}
    g.discard, g.dealer, g.direction, g.phase = [], 0, 1, "play"
    g.draw_pile = [card(500, "red", "number", 1)] * 5 + [card(502, "wild", "wild")]
    g._start()
    assert g.phase == "start_color"
    g.handle(g.players[g.turn], {"type": "start_color", "color": "yellow"})
    assert g.color == "yellow" and g.phase == "play"


def test_reshuffle_when_empty():
    g = uno_fixture(P2, card(1, "red", "number", 7), [[card(2, "blue", "number", 1)], [card(3, "blue", "number", 2)]])
    g.discard = [card(10, "yellow", "number", 3), card(11, "green", "number", 3), card(1, "red", "number", 7)]
    g.draw_pile = []
    g.handle("alice", {"type": "draw"})
    assert len(g.discard) == 1 and g.top["id"] == 1 and len(g.draw_pile) == 1


# --- other games -----------------------------------------------------------
def test_dots_box_gives_extra_turn():
    g = Dots(P2, rng=random.Random(0))
    a, b = g.players
    g.handle(a, {"type": "line", "kind": "h", "r": 0, "c": 0})
    g.handle(b, {"type": "line", "kind": "h", "r": 1, "c": 0})
    g.handle(a, {"type": "line", "kind": "v", "r": 0, "c": 0})
    g.handle(b, {"type": "line", "kind": "v", "r": 0, "c": 1})
    assert g.boxes[0][0] == b and g.players[g.turn] == b and g.score[b] == 1


def test_memory_pair_and_miss(monkeypatch):
    g = Memory(P2, rng=random.Random(0))
    p = g.players[0]
    first = 0
    twin = next(i for i in range(1, len(g.cards)) if g.cards[i] == g.cards[0])
    other = next(i for i in range(1, len(g.cards)) if g.cards[i] != g.cards[0])
    g.handle(p, {"type": "flip", "card": first})
    g.handle(p, {"type": "flip", "card": twin})
    g._timers[0][1]()
    assert g.score[p] == 1 and g.players[g.turn] == p
    nxt = next(i for i in range(len(g.cards)) if not g.owner[i] and i != other)
    g.handle(p, {"type": "flip", "card": other})
    if g.cards[nxt] == g.cards[other]:
        nxt = next(i for i in range(len(g.cards)) if not g.owner[i] and g.cards[i] != g.cards[other] and i != other)
    g.handle(p, {"type": "flip", "card": nxt})
    g._timers[-1][1]()
    assert g.players[g.turn] != p
    assert g.view(p)["faces"][other] is None


def test_oddone_scoring_and_lockout():
    g = OddOneOut(P2, rng=random.Random(0))
    g._next_round()
    g._go()
    a, b = P2
    wrong = (g.answer + 1) % len(g.items)
    g.handle(a, {"type": "pick", "index": wrong})
    with pytest.raises(GameError):
        g.handle(a, {"type": "pick", "index": g.answer})
    g.handle(b, {"type": "pick", "index": g.answer})
    assert g.score[b] == 1 and g.phase == "reveal"
    assert g.view(a)["answer"] == g.answer


def test_oddone_answer_hidden_during_play():
    g = OddOneOut(P2, rng=random.Random(0))
    g._next_round()
    g._go()
    assert g.view("alice")["answer"] is None


def test_echo_knockout():
    g = Echo(P2, rng=random.Random(0))
    g._watch()
    g._input()
    seq = list(g.sequence)
    wrong = (seq[0] + 1) % 6
    g.handle("alice", {"type": "pad", "pad": wrong})
    assert "alice" not in g.alive
    for s in seq:
        g.handle("bob", {"type": "pad", "pad": s})
    g._timers[-1][1]()       # end timer
    assert g.over and g.results.winners == ["bob"]


def test_registry_player_counts():
    assert REGISTRY["tictactoe"].max_players == 2
    assert REGISTRY["uno"].max_players == 5
    assert REGISTRY["uno"].min_players == 2
    with pytest.raises(GameError):
        TicTacToe(P3)


def test_pong_tracking_paddles_rally_and_misses():
    from app.games import pong as pm
    clock = [0.0]
    g = pm.Pong(P2, rng=random.Random(2))
    g.now = lambda: clock[0]          # type: ignore[method-assign]
    g.last = 0.0
    g.serve_at = 0.5
    hits = 0
    for _ in range(60 * 90):
        clock[0] += 1 / 60
        g.handle("alice", {"type": "move", "x": g.ball["x"]})   # alice tracks perfectly
        g.update()
        hits += sum(1 for e in g.events if e["kind"] == "hit")
        g.events.clear()
        if g.over:
            break
    assert hits > 0
    assert g.over and g.results.winners == ["alice"] and g.score["alice"] == 7


@pytest.mark.parametrize("n,modern,seed", [(4, False, 1), (5, False, 2), (5, True, 3), (5, True, 4)])
def test_uno_random_games_with_many_players(n, modern, seed):
    from app.games.uno import Uno
    rng = random.Random(seed)
    players = [f"p{i}" for i in range(n)]
    g = Uno(players, {"modern": modern}, random.Random(seed))
    total = len(g.draw_pile) + len(g.discard) + sum(len(h) for h in g.hands.values())
    for _ in range(5000):
        if g.over:
            break
        pid = g.players[g.turn]
        v = g.view(pid)
        others = [p for p in g.players if p != pid]
        if len(v["hand"]) <= 2 and rng.random() < 0.7:
            g.handle(pid, {"type": "uno"})
        if v["phase"] == "start_color":
            g.handle(pid, {"type": "start_color", "color": rng.choice(["red", "blue"]), "target": rng.choice(others)})
        elif v["phase"] == "challenge":
            g.handle(pid, {"type": rng.choice(["accept", "challenge"])})
        elif v["playable"]:
            g.handle(pid, {"type": "play", "card": rng.choice(v["playable"]), "color": "green", "target": rng.choice(others)})
        elif v["phase"] == "drawn":
            g.handle(pid, {"type": "pass"})
        else:
            g.handle(pid, {"type": "draw"})
        for p in list(g.vulnerable):
            if rng.random() < 0.3:
                g.handle(rng.choice([q for q in g.players if q != p]), {"type": "catch", "target": p})
        # cards are conserved
        assert len(g.draw_pile) + len(g.discard) + sum(len(h) for h in g.hands.values()) == total
    assert g.over
    assert g.results.ranking[0] and len(sum(g.results.ranking, [])) == n


# --- UNO: play on after someone goes out, +4 reveal, opener rotation -------
def test_uno_finisher_watches_and_rest_play_on():
    P4 = ["alice", "bob", "cara", "dan"]
    g = uno_fixture(P4, card(1, "red", "number", 7),
                    [[card(2, "red", "skip")], [card(3, "blue", "number", 1), card(13, "blue", "number", 2)],
                     [card(4, "red", "number", 2), card(14, "red", "number", 3)], [card(5, "green", "number", 2)]])
    g.said_uno.add("alice")
    g.handle("alice", {"type": "play", "card": 2})      # goes out on a skip: bob is still skipped
    assert not g.over and g.finished == ["alice"] and "alice" not in g.players
    assert g.players[g.turn] == "cara"
    with pytest.raises(GameError):
        g.handle("alice", {"type": "draw"})
    g.handle("cara", {"type": "play", "card": 4})
    g.handle("dan", {"type": "play", "card": 5})          # green 2 on red 2, dan out second
    assert g.finished == ["alice", "dan"] and g.players == ["bob", "cara"]
    assert g.players[g.turn] == "bob"
    g.handle("bob", {"type": "draw"})                     # green 5 drawn and playable
    g.handle("bob", {"type": "pass"})
    g.handle("cara", {"type": "draw"})
    g.handle("cara", {"type": "pass"})
    assert not g.over
    g.hands["bob"] = [card(60, "green", "number", 9)]
    g.handle("bob", {"type": "play", "card": 60})
    assert g.over and g.results.ranking == [["alice"], ["dan"], ["bob"], ["cara"]]


def test_uno_two_left_one_goes_out_ends():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "red", "number", 1)], [card(3, "blue", "number", 1)], [card(4, "red", "number", 3)]])
    g.handle("alice", {"type": "play", "card": 2})
    assert not g.over and g.players == ["bob", "cara"] and g.players[g.turn] == "bob"
    g.forfeit("bob")
    assert g.over and g.results.ranking[0] == ["alice"] and g.results.ranking[-1] == ["bob"]


def test_wild4_house_rule_counts_number_match_and_reveals():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild4"), card(5, "blue", "number", 7), card(6, "yellow", "number", 3)],
                     [card(3, "green", "number", 1)], [card(4, "green", "number", 2)]])
    g.handle("alice", {"type": "play", "card": 2, "color": "blue"})
    assert g.view("bob")["challenge"]["color"] == "red"
    g.handle("bob", {"type": "challenge"})
    assert len(g.hands["alice"]) == 6                      # blue 7 matched the number: bluff
    assert g.view("bob")["reveal"] is None                  # a caught bluff isn't shown
    assert g.view("cara")["reveal"] is None


def test_wild4_official_rule_is_colour_only():
    g = uno_fixture(P3, card(1, "red", "number", 7),
                    [[card(2, "wild", "wild4"), card(5, "blue", "number", 7), card(6, "yellow", "number", 3)],
                     [card(3, "green", "number", 1)], [card(4, "green", "number", 2)]])
    g.bluff = "color"
    g.handle("alice", {"type": "play", "card": 2, "color": "blue"})
    g.handle("bob", {"type": "challenge"})
    assert len(g.hands["bob"]) == 7 and g.players[g.turn] == "cara"


def test_uno_opener_follows_option():
    for first in P3:
        g = Uno(list(P3), {"first": first}, rng=random.Random(9))
        assert g.players == P3
        assert g.dealer == (P3.index(first) - 1) % 3
