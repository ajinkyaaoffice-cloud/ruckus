import random

import pytest

from app.games import GameError
from app.games.uno import MERCY_LIMIT, Uno, build_mercy_deck

P2 = ["alice", "bob"]
P3 = ["alice", "bob", "cara"]


def card(cid, color, kind, value=None):
    return {"id": cid, "color": color, "kind": kind, "value": value, "mercy": True}


def mercy(players, top, hands, turn=0, pile=None):
    g = Uno(list(players), {"modern": "mercy"}, rng=random.Random(1))
    g.players = list(players)
    g.hands = {p: list(h) for p, h in zip(players, hands)}
    g.discard = [top]
    g.color = top["color"]
    g.turn = turn
    g.direction = 1
    g.phase = "play"
    g.said_uno.clear()
    g.vulnerable.clear()
    g.draw_pile = pile if pile is not None else [card(900 + i, "green", "number", 5) for i in range(60)]
    return g


def filler(start, n=3):
    return [card(start + i, "yellow", "number", 3) for i in range(n)]


def test_deck_is_168_and_opens_on_a_number():
    deck = build_mercy_deck()
    assert len(deck) == 168
    assert sum(c["kind"] == "roulette" for c in deck) == 8
    for seed in range(20):
        g = Uno(P3, {"modern": "mercy"}, rng=random.Random(seed))
        assert g.top["kind"] == "number" and all(len(h) == 7 for h in g.hands.values())


def test_draw_cards_stack_and_the_loser_takes_the_lot():
    g = mercy(P3, card(1, "red", "number", 5), [
        [card(10, "red", "draw2")] + filler(100),
        [card(20, "blue", "draw4")] + filler(200),
        [card(30, "green", "draw2")] + filler(300),
    ])
    g.handle("alice", {"type": "play", "card": 10})
    assert g.phase == "stack" and g.players[g.turn] == "bob"
    g.handle("bob", {"type": "play", "card": 20})          # +4 on +2, any colour
    assert g.stack == 6 and g.players[g.turn] == "cara"
    with pytest.raises(GameError):
        g.handle("cara", {"type": "play", "card": 30})     # +2 is smaller than +4
    g.handle("cara", {"type": "draw"})
    assert len(g.hands["cara"]) == 4 + 6 and g.stack == 0
    assert g.players[g.turn] == "alice" and g.phase == "play"


def test_wild_reverse_draw_four_sends_it_back():
    g = mercy(P3, card(1, "red", "number", 5), [
        [card(10, "red", "draw2")] + filler(100),
        [card(20, "wild", "wildrev4")] + filler(200),
        filler(300),
    ])
    g.handle("alice", {"type": "play", "card": 10})
    g.handle("bob", {"type": "play", "card": 20, "color": "blue"})
    assert g.direction == -1 and g.players[g.turn] == "alice" and g.stack == 6


def test_draw_until_you_can_play():
    pile = [card(905, "red", "number", 9)] + [card(900 + i, "green", "number", 6) for i in range(4)]
    g = mercy(P2, card(1, "red", "number", 5), [filler(100), filler(200)], pile=pile)
    g.handle("alice", {"type": "draw"})                    # pile pops from the end: four greens, then the red
    assert len(g.hands["alice"]) == 3 + 5 and g.phase == "drawn" and g.drawn_id == 905


def test_seven_swaps_and_zero_passes_hands_along():
    g = mercy(P3, card(1, "red", "number", 5), [
        [card(10, "red", "number", 7), card(11, "red", "number", 0)] + filler(100, 4),
        filler(200, 1),
        filler(300, 2),
    ])
    with pytest.raises(GameError):
        g.handle("alice", {"type": "play", "card": 10})    # who with?
    g.handle("alice", {"type": "play", "card": 10, "target": "bob"})
    assert len(g.hands["alice"]) == 1 and len(g.hands["bob"]) == 5
    g.turn = 1                                              # bob now holds the 0
    g.handle("bob", {"type": "play", "card": 11})
    assert [len(g.hands[p]) for p in P3] == [2, 1, 4]       # each hand moves on a seat: alice←cara, bob←alice, cara←bob


def test_discard_all_throws_the_colour_away():
    g = mercy(P2, card(1, "red", "number", 5), [
        [card(10, "red", "discard"), card(11, "red", "number", 2), card(12, "red", "skip"), card(13, "blue", "number", 4)],
        filler(200),
    ])
    g.handle("alice", {"type": "play", "card": 10})
    assert [c["id"] for c in g.hands["alice"]] == [13] and g.top["id"] == 10


def test_colour_roulette():
    pile = [card(905, "blue", "number", 9)] + [card(900 + i, "green", "number", 5) for i in range(3)]
    g = mercy(P3, card(1, "red", "number", 5), [[card(10, "wild", "roulette")] + filler(100), filler(200), filler(300)], pile=pile)
    g.handle("alice", {"type": "play", "card": 10})
    assert g.phase == "roulette" and g.players[g.turn] == "bob"
    g.handle("bob", {"type": "roulette", "color": "blue"})
    assert len(g.hands["bob"]) == 3 + 4 and g.color == "blue" and g.players[g.turn] == "cara"


def test_mercy_rule_knocks_out_at_25():
    g = mercy(P3, card(1, "red", "number", 5), [
        [card(10, "wild", "wild10")] + filler(100),
        filler(200, MERCY_LIMIT - 5),
        filler(300),
    ])
    g.handle("alice", {"type": "play", "card": 10, "color": "red"})
    g.handle("bob", {"type": "draw"})
    assert "bob" in g.mercied and "bob" not in g.players and g.players[g.turn] == "cara"
    g.forfeit("cara")
    assert g.over and g.results.ranking == [["alice"], ["bob"], ["cara"]]
    assert "knocked out" in g.results.details["bob"]


def test_stand_ins_finish_a_no_mercy_game():
    for seed in range(6):
        g = Uno(P3, {"modern": "mercy"}, rng=random.Random(seed))
        for _ in range(3000):
            if g.over:
                break
            for p in list(g.players):
                g.stand_in(p)
        assert g.over, seed
        assert sum(len(r) for r in g.results.ranking) == 3
