import random

import pytest

from app.games import GameError
from app.games.base import Game
from app.games.mogul import CARDS, GROUPS, JAIL, SPACES, START_CASH, Mogul

P3 = ["ana", "ben", "cy"]


@pytest.fixture
def clock(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(Game, "now", lambda self: t[0])
    return t


def run(g, clock, secs, dt=0.1):
    for _ in range(int(secs / dt)):
        clock[0] += dt
        g.update()
        if g.over:
            return


class Dice(random.Random):
    """A random source whose dice come from a list (then fall back to real randomness)."""
    def __init__(self, rolls):
        super().__init__(1)
        self.rolls = list(rolls)

    def randint(self, a, b):
        if a == 1 and b == 6 and self.rolls:
            return self.rolls.pop(0)
        return super().randint(a, b)


def game(rolls=(), **opts):
    return Mogul(P3, {"first": "ana", **opts}, rng=Dice(rolls))


def settle(g, clock, phase=None, secs=6):
    """Let the paced moves play out until we're waiting on someone."""
    for _ in range(int(secs / 0.1)):
        if g.phase != "wait" and (phase is None or g.phase == phase):
            return
        run(g, clock, 0.1)


def test_board_shape():
    assert len(SPACES) == 40 and len(GROUPS) == 8
    assert sum(len(v) for v in GROUPS.values()) == 22
    assert all(len(d) == 16 for d in CARDS.values())


def test_buy_and_rent_doubles_on_a_set(clock):
    g = game([1, 2])                     # ana walks 3 to Pocket Lane
    g.handle("ana", {"type": "roll"})
    settle(g, clock, "buy")
    assert g.offer == 3
    g.handle("ana", {"type": "buy"})
    assert g.owner[3] == "ana" and g.cash["ana"] == START_CASH - 60 and g.phase == "end"
    g.owner[1] = "ana"
    assert g.rent(3, 7) == 8             # base 4, doubled for the full brown set
    g.houses[3] = 2
    assert g.rent(3, 7) == 60


def test_rent_is_paid_and_turn_moves_on(clock):
    g = game([1, 2, 2, 1])
    g.owner[3] = "cy"
    g.handle("ana", {"type": "roll"})
    settle(g, clock, "end")
    assert g.cash["ana"] == START_CASH - 4 and g.cash["cy"] == START_CASH + 4
    g.handle("ana", {"type": "end"})
    assert g.cur == "ben"


def test_declining_starts_an_auction_anyone_can_win(clock):
    g = game([2, 3])                     # ana walks 5 to North Line
    g.handle("ana", {"type": "roll"})
    settle(g, clock, "buy")
    g.handle("ana", {"type": "pass"})
    assert g.phase == "auction"
    g.handle("ben", {"type": "bid", "amount": 50})
    with pytest.raises(GameError):
        g.handle("cy", {"type": "bid", "amount": 40})
    g.handle("cy", {"type": "bid", "amount": 80})
    run(g, clock, 11)
    assert g.owner[5] == "cy" and g.cash["cy"] == START_CASH - 80 and g.phase == "end"


def test_doubles_roll_again_and_three_go_to_jail(clock):
    g = game([1, 1, 2, 2, 3, 3])
    g.decks["chest"] = [3] + [i for i in range(16) if i != 3]     # a harmless card on the way
    for _ in range(2):
        g.handle("ana", {"type": "roll"})
        settle(g, clock)
        if g.phase == "buy":
            g.handle("ana", {"type": "pass"})
            run(g, clock, 11)
        assert g.phase == "roll" and g.cur == "ana"
    g.handle("ana", {"type": "roll"})
    settle(g, clock)
    assert g.pos["ana"] == JAIL and "ana" in g.jail and g.phase == "end"


def test_jail_bail_card_and_third_miss(clock):
    g = game([1, 2, 1, 2, 1, 2])
    g.jail["ana"] = 0
    g.pos["ana"] = JAIL
    g.handle("ana", {"type": "roll"})          # miss
    settle(g, clock)
    assert g.phase == "end" and g.jail["ana"] == 1
    g.turn = 0
    g.phase = "roll"
    g.jail["ana"] = 2
    g.handle("ana", {"type": "roll"})          # third miss: pay $50 and walk
    settle(g, clock)
    assert "ana" not in g.jail and g.cash["ana"] <= START_CASH - 50 and g.pos["ana"] == 13
    g2 = game()
    g2.jail["ana"] = 0
    g2.jail_cards["ana"] = ["chance"]
    g2.decks["chance"].remove(7)
    g2.handle("ana", {"type": "card"})
    assert "ana" not in g2.jail and g2.decks["chance"][-1] == 7


def test_building_must_be_even_and_uses_the_bank(clock):
    g = game()
    for s in GROUPS["sky"]:
        g.owner[s] = "ana"
    g.handle("ana", {"type": "build", "space": 6})
    with pytest.raises(GameError, match="evenly"):
        g.handle("ana", {"type": "build", "space": 6})
    g.handle("ana", {"type": "build", "space": 8})
    g.handle("ana", {"type": "build", "space": 9})
    assert g.houses_left == 29 and g.cash["ana"] == START_CASH - 150
    with pytest.raises(GameError, match="buildings"):
        g.handle("ana", {"type": "mortgage", "space": 6})
    g.handle("ana", {"type": "build", "space": 6})
    with pytest.raises(GameError, match="evenly"):
        g.handle("ana", {"type": "sell", "space": 8})
    g.handle("ana", {"type": "sell", "space": 6})
    assert g.cash["ana"] == START_CASH - 150 - 50 + 25
    for s in GROUPS["sky"]:
        g.houses[s] = 4
    g.handle("ana", {"type": "build", "space": 6})
    assert g.houses[6] == 5 and g.hotels_left == 11


def test_mortgage_and_lift(clock):
    g = game()
    g.owner[39] = "ana"
    g.handle("ana", {"type": "mortgage", "space": 39})
    assert g.cash["ana"] == START_CASH + 200 and 39 in g.mortgaged
    g.handle("ana", {"type": "unmortgage", "space": 39})
    assert g.cash["ana"] == START_CASH - 20 and 39 not in g.mortgaged


def test_trade_swaps_property_cash_and_charges_interest(clock):
    g = game()
    g.owner[1] = "ana"
    g.owner[3] = "ben"
    g.mortgaged.add(3)
    g.handle("ana", {"type": "offer", "to": "ben", "give": {"cash": 100}, "get": {"spaces": [3]}})
    with pytest.raises(GameError):
        g.handle("ana", {"type": "roll"})
    g.handle("ben", {"type": "accept"})
    assert g.owner[3] == "ana" and g.cash["ben"] == START_CASH + 100
    assert g.cash["ana"] == START_CASH - 100 - 3       # 10% of the $30 mortgage
    g.handle("ana", {"type": "offer", "to": "cy", "give": {"spaces": [1]}, "get": {"cash": 999}})
    run(g, clock, 31)
    assert g.trade is None and g.owner[1] == "ana" and g.phase == "roll"


def test_debt_then_bankrupt_hands_everything_to_the_creditor(clock):
    g = game([1, 2])
    g.owner[3] = "cy"
    g.houses[3] = 5
    g.owner[1] = "cy"
    g.cash["ana"] = 100
    g.owner[39] = "ana"
    g.handle("ana", {"type": "roll"})
    settle(g, clock, "debt")
    assert g.debt["amount"] == 450 and g.debt["to"] == "cy"
    with pytest.raises(GameError, match="short"):
        g.handle("ana", {"type": "pay"})
    g.handle("ana", {"type": "mortgage", "space": 39})
    with pytest.raises(GameError):
        g.handle("ana", {"type": "pay"})
    g.handle("ana", {"type": "bankrupt"})
    assert "ana" in g.broke and g.owner[39] == "cy" and 39 in g.mortgaged
    assert g.cash["cy"] == START_CASH + 300 and g.cur == "ben" and g.phase == "roll"


def test_debt_timeout_raises_money_automatically(clock):
    g = game([1, 2])
    g.owner[3] = "cy"
    g.cash["ana"] = 0
    g.owner[39] = "ana"
    g.handle("ana", {"type": "roll"})
    settle(g, clock, "debt")
    run(g, clock, 51)
    assert 39 in g.mortgaged and g.cash["ana"] == 200 - 4 and g.cash["cy"] == START_CASH + 4


def test_birthday_collects_from_everyone(clock):
    g = game()
    g.decks["chest"] = [8] + [i for i in range(16) if i != 8]
    g.pos["ana"] = 2
    g._draw("ana", "chest")
    run(g, clock, 3)
    assert g.cash["ana"] == START_CASH + 20 and g.cash["ben"] == START_CASH - 10


def test_nearest_station_card_pays_double(clock):
    g = game()
    for s in (5, 15):
        g.owner[s] = "ben"
    g.decks["chance"] = [4] + [i for i in range(16) if i != 4]
    g.pos["ana"] = 7
    g._draw("ana", "chance")
    settle(g, clock, "end")
    assert g.pos["ana"] == 15 and g.cash["ben"] == START_CASH + 100


def test_last_one_solvent_wins(clock):
    g = game()
    g.cash["ana"] = 0
    g._bankrupt("ana", None)
    g._bankrupt("cy", "ben")
    assert g.over and g.results.ranking == [["ben"], ["cy"], ["ana"]]


def test_time_limit_ranks_by_net_worth(clock):
    g = game([1, 2], length=10)
    g.owner[39] = "cy"
    clock[0] += 601
    g.handle("ana", {"type": "roll"})
    settle(g, clock)
    if g.phase == "buy":
        g.handle("ana", {"type": "pass"})
        run(g, clock, 11)
    g.handle("ana", {"type": "end"})
    assert g.over and g.results.winners == ["cy"]


def test_forfeit_returns_property_to_bank(clock):
    g = game()
    g.owner[1] = "ben"
    g.forfeit("ben")
    assert 1 not in g.owner and "ben" in g.broke
    g.forfeit("ana")
    assert g.over and g.results.winners == ["cy"]


def test_stand_ins_and_timeouts_keep_a_full_game_moving(clock):
    g = Mogul(P3, {}, rng=random.Random(11))
    for _ in range(40000):
        w = g.waiting_on()
        if w:
            g.stand_in(w)
        run(g, clock, 0.2)
        if g.over:
            break
        total = sum(g.cash.values())
        assert all(v >= 0 for v in g.cash.values()), total
        assert g.houses_left >= 0 and g.hotels_left >= 0
    # the stand-ins are cautious, so a long game may still be going; it must never stall
    assert g.over or g.waiting_on() or g.phase in ("wait", "auction")
    assert len(g.events) > 200
