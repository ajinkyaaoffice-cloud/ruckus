"""Mogul: the property-trading board game for 2-4 players (made for 3).

* Everyone starts with $1500 on GO. Roll two dice and walk clockwise round a
  40-space board; passing (or landing on) GO pays $200.
* Land on an unowned street, station or utility: buy it at the printed price
  or it goes to a timed auction that everyone (you included) can bid in.
* Land on someone else's: pay rent. A street's rent doubles once its owner has
  the whole colour set, and climbs with every house (1-4) and the hotel.
  Stations charge 25/50/100/200 for 1-4 owned; utilities 4x the dice for one,
  10x for both. Mortgaged property charges nothing.
* Rolling doubles earns another roll; a third doubles in a row goes to jail.
  So does the Go To Jail corner and a card. In jail: pay $50, play a Get Out
  of Jail Free card, or try for doubles. After a third miss you pay and go.
* Chance and Chest each hold the 16 classic cards (move, collect, pay, repairs,
  pay/collect from everyone, go to jail, get out free).
* Build on a full, unmortgaged set, evenly: no street may get two houses ahead
  of its neighbours. Four houses become a hotel. The bank has 32 houses and 12
  hotels; when they're gone nobody can build. Buildings sell back at half.
* Mortgage an unbuilt property for half its price; lifting it costs that plus
  10%. Trade streets, cash and jail cards with anyone on your turn (mortgaged
  property costs its new owner 10% interest).
* Can't pay? Sell buildings, mortgage and trade to raise the money, or go
  bankrupt: everything goes to whoever you owe (or back to the bank).
* Last one solvent wins. With a time limit, the richest player by net worth
  wins when the clock runs out (at the end of that turn).
* Every decision has a timer, and a stand-in plays for anyone on a break.
"""
from __future__ import annotations

from typing import Any, Callable

from .base import Game, GameError

START_CASH = 1500
SALARY = 200
JAIL = 10
GO_TO_JAIL = 30
JAIL_FINE = 50
HOUSES, HOTELS = 32, 12

ROLL_TIME = 25.0
BUY_TIME = 20.0
END_TIME = 25.0
AUCTION_TIME = 10.0
AUCTION_BUMP = 6.0
DEBT_TIME = 50.0
TRADE_TIME = 30.0
CARD_TIME = 2.4


def _street(name: str, group: str, price: int, rent: list[int], house: int) -> dict[str, Any]:
    return {"kind": "street", "name": name, "group": group, "price": price, "rent": rent, "house": house}


def _station(name: str) -> dict[str, Any]:
    return {"kind": "station", "name": name, "price": 200}


def _util(name: str) -> dict[str, Any]:
    return {"kind": "util", "name": name, "price": 150}


SPACES: list[dict[str, Any]] = [
    {"kind": "go", "name": "GO"},
    _street("Gum Alley", "brown", 60, [2, 10, 30, 90, 160, 250], 50),
    {"kind": "chest", "name": "Chest"},
    _street("Pocket Lane", "brown", 60, [4, 20, 60, 180, 320, 450], 50),
    {"kind": "tax", "name": "Income Tax", "amount": 200},
    _station("North Line"),
    _street("Kite Row", "sky", 100, [6, 30, 90, 270, 400, 550], 50),
    {"kind": "chance", "name": "Chance"},
    _street("Fizz Street", "sky", 100, [6, 30, 90, 270, 400, 550], 50),
    _street("Bubble Avenue", "sky", 120, [8, 40, 100, 300, 450, 600], 50),
    {"kind": "jail", "name": "Jail"},
    _street("Disco Drive", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
    _util("Power Plant"),
    _street("Glitter Way", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
    _street("Neon Strip", "pink", 160, [12, 60, 180, 500, 700, 900], 100),
    _station("East Line"),
    _street("Taco Terrace", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
    {"kind": "chest", "name": "Chest"},
    _street("Pretzel Pier", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
    _street("Jam Street", "orange", 200, [16, 80, 220, 600, 800, 1000], 100),
    {"kind": "parking", "name": "Free Parking"},
    _street("Ruby Road", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
    {"kind": "chance", "name": "Chance"},
    _street("Chili Court", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
    _street("Rocket Row", "red", 240, [20, 100, 300, 750, 925, 1100], 150),
    _station("South Line"),
    _street("Banana Boulevard", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
    _street("Sunny Square", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
    _util("Water Works"),
    _street("Lemon Lane", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150),
    {"kind": "gotojail", "name": "Go To Jail"},
    _street("Mint Mews", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
    _street("Cactus Close", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
    {"kind": "chest", "name": "Chest"},
    _street("Fern Gardens", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200),
    _station("West Line"),
    {"kind": "chance", "name": "Chance"},
    _street("Velvet Heights", "navy", 350, [35, 175, 500, 1100, 1300, 1500], 200),
    {"kind": "tax", "name": "Luxury Tax", "amount": 100},
    _street("Royal Rooftops", "navy", 400, [50, 200, 600, 1400, 1700, 2000], 200),
]
assert len(SPACES) == 40
OWNABLE = {i for i, s in enumerate(SPACES) if "price" in s}
GROUPS: dict[str, list[int]] = {}
for _i, _s in enumerate(SPACES):
    if _s["kind"] == "street":
        GROUPS.setdefault(_s["group"], []).append(_i)
STATIONS = [i for i, s in enumerate(SPACES) if s["kind"] == "station"]
UTILS = [i for i, s in enumerate(SPACES) if s["kind"] == "util"]

# (text, effect, arg). Effects: goto, station, util, back, jail, money, each, repairs, free
CARDS: dict[str, list[tuple[str, str, Any]]] = {
    "chance": [
        ("Advance to GO. Collect $200.", "goto", 0),
        ("Advance to Rocket Row. Collect $200 if you pass GO.", "goto", 24),
        ("Advance to Disco Drive. Collect $200 if you pass GO.", "goto", 11),
        ("Advance to the nearest utility. If it's owned, roll and pay 10x the dice.", "util", None),
        ("Advance to the nearest station. If it's owned, pay double rent.", "station", None),
        ("Advance to the nearest station. If it's owned, pay double rent.", "station", None),
        ("The bank pays you a dividend of $50.", "money", 50),
        ("Get Out of Jail Free. Keep this card until you need it.", "free", None),
        ("Go back three spaces.", "back", 3),
        ("Go to jail. Go straight there, do not collect $200.", "jail", None),
        ("General repairs: pay $25 per house and $100 per hotel.", "repairs", (25, 100)),
        ("Speeding fine: pay $15.", "money", -15),
        ("Take a trip to North Line. Collect $200 if you pass GO.", "goto", 5),
        ("Advance to Royal Rooftops.", "goto", 39),
        ("You've been elected chair of the board. Pay each player $50.", "each", -50),
        ("Your building loan matures. Collect $150.", "money", 150),
    ],
    "chest": [
        ("Advance to GO. Collect $200.", "goto", 0),
        ("Bank error in your favour. Collect $200.", "money", 200),
        ("Doctor's fee. Pay $50.", "money", -50),
        ("From the sale of stock you get $50.", "money", 50),
        ("Get Out of Jail Free. Keep this card until you need it.", "free", None),
        ("Go to jail. Go straight there, do not collect $200.", "jail", None),
        ("Holiday fund matures. Collect $100.", "money", 100),
        ("Tax refund. Collect $20.", "money", 20),
        ("It's your birthday! Collect $10 from every player.", "each", 10),
        ("Life insurance matures. Collect $100.", "money", 100),
        ("Hospital fees. Pay $100.", "money", -100),
        ("School fees. Pay $50.", "money", -50),
        ("Consultancy fee. Collect $25.", "money", 25),
        ("Street repairs: pay $40 per house and $115 per hotel.", "repairs", (40, 115)),
        ("Second prize in a beauty contest. Collect $10.", "money", 10),
        ("You inherit $100.", "money", 100),
    ],
}

Debt = tuple[str, "str | None", int, str]      # debtor, creditor (None = bank), amount, why


def ordinal(n: int) -> str:
    return f"{n}{'tsnrhtdd'[(n // 10 % 10 != 1) * (n % 10 < 4) * n % 10::4]}"


def mortgage_value(sq: int) -> int:
    return SPACES[sq]["price"] // 2


def lift_cost(sq: int) -> int:
    m = mortgage_value(sq)
    return m + (m + 9) // 10


class Mogul(Game):
    id = "mogul"
    name = "Mogul"
    min_players = 2
    max_players = 4

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.seats = list(self.players)
        self.cash: dict[str, int] = {p: START_CASH for p in self.players}
        self.pos: dict[str, int] = {p: 0 for p in self.players}
        self.jail: dict[str, int] = {}                    # pid -> failed doubles attempts
        self.jail_cards: dict[str, list[str]] = {p: [] for p in self.players}   # deck each card came from
        self.owner: dict[int, str] = {}
        self.houses: dict[int, int] = {}                  # 1-4 houses, 5 = hotel
        self.mortgaged: set[int] = set()
        self.houses_left, self.hotels_left = HOUSES, HOTELS
        self.broke: list[str] = []                        # bankrupt, in order
        self.left: list[str] = []
        self.decks = {k: self.rng.sample(range(16), 16) for k in CARDS}
        self.earned: dict[str, int] = {p: 0 for p in self.players}   # rent collected
        first = self.options.get("first")
        self.turn = self.players.index(first) if first in self.players else self.rng.randrange(len(self.players))
        self.phase = "roll"            # roll | wait | buy | auction | end | debt
        self.dice: list[int] | None = None
        self.doubles = 0
        self.again = False             # this roll earned another
        self.last: dict[str, Any] | None = None
        self.card: dict[str, Any] | None = None
        self.offer: int | None = None
        self.auction: dict[str, Any] | None = None
        self.debt: dict[str, Any] | None = None
        self.trade: dict[str, Any] | None = None
        self._card_rent: tuple[str, int] | None = None
        self._queue: list[Debt] = []
        self._then: Callable[[], None] = self._post
        minutes = int(self.options.get("length") or 0)
        self.ends_at = self.now() + minutes * 60 if minutes > 0 else None
        self.deadline = 0.0
        self.total = ROLL_TIME
        self._gen = 0
        self._arm(ROLL_TIME, self._timeout)

    # --- queries ------------------------------------------------------------
    @property
    def cur(self) -> str:
        return self.players[self.turn]

    def alive(self) -> list[str]:
        return [p for p in self.players if p not in self.broke]

    def owned(self, pid: str) -> list[int]:
        return sorted(i for i, o in self.owner.items() if o == pid)

    def full_set(self, pid: str, group: str) -> bool:
        return all(self.owner.get(i) == pid for i in GROUPS[group])

    def rent(self, sq: int, dice_total: int, card: str | None = None) -> int:
        sp = SPACES[sq]
        own = self.owner[sq]
        if sp["kind"] == "street":
            h = self.houses.get(sq, 0)
            if h:
                return sp["rent"][h]
            return sp["rent"][0] * (2 if self.full_set(own, sp["group"]) else 1)
        if sp["kind"] == "station":
            n = sum(1 for i in STATIONS if self.owner.get(i) == own)
            return 25 * 2 ** (n - 1) * (2 if card == "station" else 1)
        n = sum(1 for i in UTILS if self.owner.get(i) == own)
        return dice_total * (10 if n == 2 or card == "util" else 4)

    def worth(self, pid: str) -> int:
        w = self.cash[pid]
        for i in self.owned(pid):
            sp = SPACES[i]
            w += mortgage_value(i) if i in self.mortgaged else sp["price"]
            w += self.houses.get(i, 0) * sp.get("house", 0)
        return w

    def can_raise(self, pid: str) -> int:
        """Cash plus everything that could still be sold or mortgaged."""
        w = self.cash[pid]
        for i in self.owned(pid):
            sp = SPACES[i]
            w += self.houses.get(i, 0) * sp.get("house", 0) // 2
            if i not in self.mortgaged:
                w += mortgage_value(i)
        return w

    def build_error(self, pid: str, sq: int) -> str | None:
        sp = SPACES[sq] if 0 <= sq < 40 else {}
        if sp.get("kind") != "street" or self.owner.get(sq) != pid:
            return "You can only build on your own streets"
        g = GROUPS[sp["group"]]
        if not self.full_set(pid, sp["group"]):
            return "You need the whole colour set first"
        if any(i in self.mortgaged for i in g):
            return "Lift the mortgages on this set first"
        h = self.houses.get(sq, 0)
        if h >= 5:
            return "That street already has a hotel"
        if h > min(self.houses.get(i, 0) for i in g):
            return "Build evenly: the others in the set need a house first"
        if h == 4 and self.hotels_left == 0:
            return "The bank is out of hotels"
        if h < 4 and self.houses_left == 0:
            return "The bank is out of houses"
        if self.cash[pid] < sp["house"]:
            return f"A {'hotel' if h == 4 else 'house'} here costs ${sp['house']}"
        return None

    def sell_error(self, pid: str, sq: int) -> str | None:
        sp = SPACES[sq] if 0 <= sq < 40 else {}
        if sp.get("kind") != "street" or self.owner.get(sq) != pid:
            return "That's not your street"
        h = self.houses.get(sq, 0)
        if not h:
            return "No buildings to sell there"
        if h < max(self.houses.get(i, 0) for i in GROUPS[sp["group"]]):
            return "Sell evenly: start with the street that has the most"
        return None

    def mortgage_error(self, pid: str, sq: int) -> str | None:
        if self.owner.get(sq) != pid:
            return "That's not yours"
        if sq in self.mortgaged:
            return "Already mortgaged"
        sp = SPACES[sq]
        if sp["kind"] == "street" and any(self.houses.get(i, 0) for i in GROUPS[sp["group"]]):
            return "Sell the buildings on this set first"
        return None

    # --- timers -------------------------------------------------------------
    def _arm(self, delay: float, fn: Callable[[], None]) -> None:
        self._gen += 1
        gen = self._gen
        self.deadline = self.now() + delay
        self.total = delay
        self.dirty = True              # every new wait is a new phase (or clock) worth broadcasting

        def fire() -> None:
            if gen == self._gen and not self.over:
                fn()
        self.later(delay, fire)

    def _wait(self, delay: float, fn: Callable[[], None]) -> None:
        self.phase = "wait"
        self._arm(delay, fn)

    def _rearm(self) -> None:
        """Restart the clock for whatever we're waiting on now."""
        t = {"roll": ROLL_TIME, "buy": BUY_TIME, "end": END_TIME, "debt": DEBT_TIME}.get(self.phase)
        if t:
            self._arm(t, self._timeout)
        self.dirty = True

    def _timeout(self) -> None:
        if self.trade:
            return self._close_trade(False, timeout=True)
        pid = self.waiting_on()
        if pid:
            self._robot(pid, lazy=True)

    def waiting_on(self) -> str | None:
        if self.over:
            return None
        if self.trade:
            return self.trade["to"]
        if self.phase == "debt" and self.debt:
            return self.debt["pid"]
        if self.phase in ("roll", "buy", "end"):
            return self.cur
        return None

    # --- stand-in -------------------------------------------------------------
    can_stand_in = True

    def stand_in(self, pid: str) -> bool:
        if self.over or pid in self.broke or self.waiting_on() != pid:
            return False
        if self.trade:
            if self.trade["to"] == pid:
                self._close_trade(False)
                return True
            return False
        self._robot(pid)
        return True

    def _robot(self, pid: str, lazy: bool = False) -> None:
        """A sensible move for pid. `lazy` (a timeout) skips the optional extras like building."""
        if self.phase == "debt":
            return self._auto_debt()
        if self.phase == "roll":
            if pid in self.jail:
                if self.jail_cards[pid]:
                    return self._free(pid, "card")
                if self.cash[pid] >= 400 and not lazy:
                    return self._free(pid, "bail")
            return self._roll(pid)
        if self.phase == "buy":
            assert self.offer is not None
            if self.cash[pid] - SPACES[self.offer]["price"] >= (0 if lazy else 120):
                return self._buy(pid)
            return self._start_auction()
        if self.phase == "end":
            if not lazy:
                for sq in sorted((i for i in self.owned(pid) if SPACES[i]["kind"] == "street"), key=lambda i: SPACES[i]["house"]):
                    if not self.build_error(pid, sq) and self.cash[pid] - SPACES[sq]["house"] >= 350:
                        self._build(pid, sq)
                        return self._rearm()
            return self._next_turn()

    # --- actions ------------------------------------------------------------
    def handle(self, pid: str, action: dict[str, Any]) -> None:
        self.require_player(pid)
        if self.over:
            raise GameError("Game over")
        if pid in self.broke:
            raise GameError("You're out of the money — watch the rest")
        t = action.get("type")
        sq = action.get("space")
        if t == "bid":
            return self._bid(pid, action.get("amount"))
        if t in ("accept", "decline"):
            if not self.trade or self.trade["to"] != pid:
                raise GameError("No offer waiting for you")
            return self._close_trade(t == "accept")
        if t == "cancel":
            if not self.trade or self.trade["from"] != pid:
                raise GameError("No offer to take back")
            return self._close_trade(False, cancelled=True)
        if self.trade:
            raise GameError("Waiting on the trade offer")
        if t in ("build", "sell", "mortgage", "unmortgage", "offer"):
            if self.manager() != pid:
                raise GameError("You can manage your property on your turn")
            if not isinstance(sq, int) and t != "offer":
                raise GameError("Pick a property")
            if t == "build":
                err = self.build_error(pid, sq)
                if err:
                    raise GameError(err)
                return self._build(pid, sq)
            if t == "sell":
                err = self.sell_error(pid, sq)
                if err:
                    raise GameError(err)
                return self._sell(pid, sq)
            if t == "mortgage":
                err = self.mortgage_error(pid, sq)
                if err:
                    raise GameError(err)
                return self._mortgage(pid, sq)
            if t == "unmortgage":
                if self.owner.get(sq) != pid or sq not in self.mortgaged:
                    raise GameError("That isn't mortgaged")
                if self.cash[pid] < lift_cost(sq):
                    raise GameError(f"Lifting it costs ${lift_cost(sq)}")
                return self._unmortgage(pid, sq)
            return self._offer(pid, action)
        if t in ("pay", "bankrupt"):
            if self.phase != "debt" or not self.debt or self.debt["pid"] != pid:
                raise GameError("You don't owe anything right now")
            if t == "pay":
                if self.cash[pid] < self.debt["amount"]:
                    raise GameError(f"You're still ${self.debt['amount'] - self.cash[pid]} short")
                return self._pay_debt()
            return self._go_broke()
        if self.cur != pid:
            raise GameError("Not your turn")
        if t == "roll":
            if self.phase != "roll":
                raise GameError("You can't roll right now")
            return self._roll(pid)
        if t in ("bail", "card"):
            if self.phase != "roll" or pid not in self.jail:
                raise GameError("You're not in jail")
            if t == "bail" and self.cash[pid] < JAIL_FINE:
                raise GameError(f"Bail is ${JAIL_FINE}")
            if t == "card" and not self.jail_cards[pid]:
                raise GameError("You don't have a Get Out of Jail Free card")
            return self._free(pid, t)
        if t in ("buy", "pass"):
            if self.phase != "buy":
                raise GameError("Nothing to buy")
            if t == "buy":
                assert self.offer is not None
                if self.cash[pid] < SPACES[self.offer]["price"]:
                    raise GameError(f"You need ${SPACES[self.offer]['price']} — mortgage something or let it go to auction")
                return self._buy(pid)
            return self._start_auction()
        if t == "end":
            if self.phase != "end":
                raise GameError("You can't end your turn yet")
            return self._next_turn()
        raise GameError("Unknown action")

    def manager(self) -> str | None:
        """Who may build, mortgage and trade right now."""
        if self.phase == "debt" and self.debt:
            return self.debt["pid"]
        if self.phase in ("roll", "buy", "end"):
            return self.cur
        return None

    # --- turn flow -----------------------------------------------------------
    def _roll(self, pid: str) -> None:
        a, b = self.rng.randint(1, 6), self.rng.randint(1, 6)
        self.dice = [a, b]
        dbl = a == b
        self.again = False
        if pid in self.jail:
            if dbl:
                del self.jail[pid]
                self.emit("roll", pid=pid, dice=self.dice, jail=True, free=True)
                self.emit("free", pid=pid, how="doubles")
                return self._wait(1.0, lambda: self._walk(pid, a + b))
            self.jail[pid] += 1
            self.emit("roll", pid=pid, dice=self.dice, jail=True, free=False, tries=self.jail[pid])
            if self.jail[pid] >= 3:
                del self.jail[pid]
                self.emit("free", pid=pid, how="fine")
                return self._wait(1.0, lambda: self._settle([(pid, None, JAIL_FINE, "bail")], lambda: self._walk(pid, a + b)))
            return self._wait(1.3, self._post)
        self.doubles = self.doubles + 1 if dbl else 0
        self.emit("roll", pid=pid, dice=self.dice, doubles=self.doubles)
        if self.doubles == 3:
            self.emit("speeding", pid=pid)
            return self._wait(1.1, lambda: self._jail_then_end(pid))
        self.again = dbl
        self._wait(1.0, lambda: self._walk(pid, a + b))

    def _free(self, pid: str, how: str) -> None:
        if how == "bail":
            self.cash[pid] -= JAIL_FINE
        else:
            deck = self.jail_cards[pid].pop()
            self.decks[deck].append(self._card_slot(deck))
        del self.jail[pid]
        self.doubles = 0
        self.emit("free", pid=pid, how=how)
        self.dirty = True

    def _walk(self, pid: str, steps: int, kind: str = "walk") -> None:
        if pid in self.broke:
            return self._next_turn()
        frm = self.pos[pid]
        to = (frm + steps) % 40
        self.pos[pid] = to
        self.last = {"id": self.seq + 1, "pid": pid, "from": frm, "to": to, "steps": steps, "kind": kind}
        self.emit("move", pid=pid, frm=frm, to=to, steps=steps, kind=kind)
        if steps > 0 and frm + steps >= 40:
            self.cash[pid] += SALARY
            self.emit("salary", pid=pid, amount=SALARY)
        self._wait(min(0.45 + 0.17 * abs(steps), 2.8), self._land)

    def _land(self) -> None:
        pid = self.cur
        if pid in self.broke:
            return self._next_turn()
        sq = self.pos[pid]
        sp = SPACES[sq]
        k = sp["kind"]
        card, self._card_rent = self._card_rent, None
        if sq in OWNABLE:
            own = self.owner.get(sq)
            if own is None:
                self.offer = sq
                self.phase = "buy"
                self.emit("offer", pid=pid, space=sq)
                return self._arm(BUY_TIME, self._timeout)
            if own == pid or sq in self.mortgaged or own in self.broke:
                if own != pid and sq in self.mortgaged:
                    self.emit("mortgaged", pid=pid, space=sq, owner=own)
                return self._post()
            roll = None
            if card and card[0] == "util":
                roll = [self.rng.randint(1, 6), self.rng.randint(1, 6)]
            total = sum(roll) if roll else sum(self.dice or [0])
            amount = self.rent(sq, total, card[0] if card else None)
            self.emit("rent", pid=pid, to=own, space=sq, amount=amount, roll=roll)
            return self._settle([(pid, own, amount, "rent")], self._post)
        if k == "tax":
            self.emit("tax", pid=pid, space=sq, amount=sp["amount"])
            return self._settle([(pid, None, sp["amount"], "tax")], self._post)
        if k == "gotojail":
            return self._jail_then_end(pid)
        if k in CARDS:
            return self._draw(pid, k)
        self._post()

    def _jail_then_end(self, pid: str) -> None:
        frm = self.pos[pid]
        self.pos[pid] = JAIL
        self.jail[pid] = 0
        self.doubles = 0
        self.again = False
        self.last = {"id": self.seq + 1, "pid": pid, "from": frm, "to": JAIL, "steps": 0, "kind": "jail"}
        self.emit("jailed", pid=pid)
        self._wait(1.4, self._post)

    def _post(self) -> None:
        """The landing is settled: roll again on doubles, otherwise wrap up the turn."""
        self.offer = None
        pid = self.cur
        if pid in self.broke:
            return self._next_turn()
        if self.again and pid not in self.jail:
            self.again = False
            self.phase = "roll"
            self.emit("again", pid=pid)
            return self._arm(ROLL_TIME, self._timeout)
        self.phase = "end"
        self._arm(END_TIME, self._timeout)

    def _next_turn(self) -> None:
        if self.over:
            return
        alive = self.alive()
        if len(alive) <= 1:
            return self._finish_game()
        if self.ends_at is not None and self.now() >= self.ends_at:
            self.emit("timeup")
            return self._finish_game(timed=True)
        n = len(self.players)
        for step in range(1, n + 1):
            i = (self.turn + step) % n
            if self.players[i] not in self.broke:
                self.turn = i
                break
        self.doubles = 0
        self.again = False
        self.offer = None
        self.phase = "roll"
        self.emit("turn", pid=self.cur)
        self._arm(ROLL_TIME, self._timeout)

    # --- cards ---------------------------------------------------------------
    def _draw(self, pid: str, deck: str) -> None:
        i = self.decks[deck].pop(0)
        text, effect, arg = CARDS[deck][i]
        if effect == "free":
            self.jail_cards[pid].append(deck)
        else:
            self.decks[deck].append(i)
        self.card = {"id": self.seq + 1, "pid": pid, "deck": deck, "text": text, "effect": effect}
        self.emit("card", pid=pid, deck=deck, text=text, effect=effect)
        self._wait(CARD_TIME, lambda: self._apply(pid, effect, arg))

    def _apply(self, pid: str, effect: str, arg: Any) -> None:
        if pid in self.broke:
            return self._next_turn()
        here = self.pos[pid]
        if effect == "goto":
            return self._walk(pid, (arg - here) % 40 or 40, "card")
        if effect in ("station", "util"):
            spots = STATIONS if effect == "station" else UTILS
            to = min(spots, key=lambda s: (s - here) % 40 or 40)
            self._card_rent = (effect, 0)
            return self._walk(pid, (to - here) % 40 or 40, "card")
        if effect == "back":
            return self._walk(pid, -arg, "back")
        if effect == "jail":
            return self._jail_then_end(pid)
        if effect == "money":
            if arg > 0:
                self.cash[pid] += arg
                self.emit("collect", pid=pid, amount=arg)
                return self._post()
            return self._settle([(pid, None, -arg, "card")], self._post)
        if effect == "each":
            others = [p for p in self.alive() if p != pid]
            if arg > 0:
                return self._settle([(p, pid, arg, "card") for p in others], self._post)
            return self._settle([(pid, p, -arg, "card") for p in others], self._post)
        if effect == "repairs":
            per_house, per_hotel = arg
            mine = [self.houses.get(i, 0) for i in self.owned(pid)]
            cost = sum(per_hotel if h == 5 else per_house * h for h in mine)
            if not cost:
                return self._post()
            return self._settle([(pid, None, cost, "repairs")], self._post)
        self._post()                                  # a jail card: keep it and carry on

    # --- money ----------------------------------------------------------------
    def _settle(self, queue: list[Debt], then: Callable[[], None]) -> None:
        """Pay each debt in turn. Anyone short opens the debt phase; `then` runs once all are paid."""
        while queue:
            d, c, amount, why = queue[0]
            if c in self.broke:
                c = None
            if d in self.broke or amount <= 0:
                queue.pop(0)
                continue
            if self.cash[d] >= amount:
                queue.pop(0)
                self._transfer(d, c, amount, why)
                continue
            self._queue, self._then = queue, then
            self.debt = {"pid": d, "to": c, "amount": amount, "why": why}
            self.phase = "debt"
            self.emit("debt", pid=d, to=c, amount=amount, why=why)
            return self._arm(DEBT_TIME, self._timeout)
        self.debt = None
        then()

    def _transfer(self, d: str, c: str | None, amount: int, why: str) -> None:
        self.cash[d] -= amount
        if c:
            self.cash[c] += amount
            if why == "rent":
                self.earned[c] += amount
        self.emit("pay", pid=d, to=c, amount=amount, why=why)

    def _pay_debt(self) -> None:
        assert self.debt
        d, c, amount, why = self._queue.pop(0)
        if c in self.broke:
            c = None
        self._transfer(d, c, amount, why)
        self.debt = None
        self._settle(self._queue, self._then)

    def _go_broke(self) -> None:
        assert self.debt
        d, c, _, _ = self._queue.pop(0)
        self.debt = None
        self._bankrupt(d, c)
        if self.over:
            return
        self._settle(self._queue, self._then)

    def _auto_debt(self) -> None:
        """Raise the money the cheap way (buildings, then mortgages), then pay or fold."""
        assert self.debt
        pid, need = self.debt["pid"], self.debt["amount"]
        while self.cash[pid] < need:
            sell = [i for i in self.owned(pid) if not self.sell_error(pid, i)]
            if sell:
                self._sell(pid, max(sell, key=lambda i: (self.houses[i], -SPACES[i]["house"])), quiet=True)
                continue
            mort = [i for i in self.owned(pid) if not self.mortgage_error(pid, i)]
            if not mort:
                break
            self._mortgage(pid, min(mort, key=lambda i: SPACES[i]["price"]), quiet=True)
        if self.cash[pid] >= need:
            return self._pay_debt()
        self._go_broke()

    def _bankrupt(self, pid: str, to: str | None) -> None:
        if to in self.broke:
            to = None
        cash = self.cash[pid]
        for i in self.owned(pid):
            h = self.houses.pop(i, 0)
            if h:
                cash += h * SPACES[i]["house"] // 2
                if h == 5:
                    self.hotels_left += 1
                else:
                    self.houses_left += h
        self.cash[pid] = 0
        props = self.owned(pid)
        if to:
            self.cash[to] += max(0, cash)
            for i in props:
                self.owner[i] = to
            self.jail_cards[to] += self.jail_cards[pid]
        else:
            for i in props:
                del self.owner[i]
                self.mortgaged.discard(i)
            for deck in self.jail_cards[pid]:
                self.decks[deck].append(self._card_slot(deck))
        self.jail_cards[pid] = []
        self.jail.pop(pid, None)
        self.broke.append(pid)
        self.emit("bankrupt", pid=pid, to=to, props=props)
        if len(self.alive()) <= 1:
            self._finish_game()

    @staticmethod
    def _card_slot(deck: str) -> int:
        return next(i for i, c in enumerate(CARDS[deck]) if c[1] == "free")

    # --- buying ---------------------------------------------------------------
    def _buy(self, pid: str) -> None:
        sq = self.offer
        assert sq is not None
        self.cash[pid] -= SPACES[sq]["price"]
        self.owner[sq] = pid
        self.emit("buy", pid=pid, space=sq, price=SPACES[sq]["price"])
        self._post()

    def _start_auction(self) -> None:
        sq = self.offer
        assert sq is not None
        self.offer = None
        self.auction = {"space": sq, "bid": 0, "bidder": None, "bids": 0}
        self.phase = "auction"
        self.emit("auction", space=sq, pid=self.cur)
        self._arm(AUCTION_TIME, self._close_auction)

    def _bid(self, pid: str, amount: Any) -> None:
        a = self.auction
        if self.phase != "auction" or not a:
            raise GameError("No auction running")
        if not isinstance(amount, int) or isinstance(amount, bool) or amount <= a["bid"]:
            raise GameError(f"Bid more than ${a['bid']}")
        if amount > self.cash[pid]:
            raise GameError(f"You only have ${self.cash[pid]}")
        if a["bidder"] == pid:
            raise GameError("You're already the top bid")
        a.update(bid=amount, bidder=pid, bids=a["bids"] + 1)
        self.emit("bid", pid=pid, amount=amount, space=a["space"])
        self._arm(max(self.deadline - self.now(), AUCTION_BUMP), self._close_auction)

    def _close_auction(self) -> None:
        a = self.auction
        assert a
        self.auction = None
        w = a["bidder"]
        if w and w not in self.broke and self.cash[w] >= a["bid"]:
            self.cash[w] -= a["bid"]
            self.owner[a["space"]] = w
            self.emit("won", pid=w, space=a["space"], amount=a["bid"])
        else:
            self.emit("unsold", space=a["space"])
        self._post()

    # --- building and mortgages ----------------------------------------------
    def _build(self, pid: str, sq: int) -> None:
        h = self.houses.get(sq, 0)
        if h == 4:
            self.hotels_left -= 1
            self.houses_left += 4
        else:
            self.houses_left -= 1
        self.houses[sq] = h + 1
        self.cash[pid] -= SPACES[sq]["house"]
        self.emit("build", pid=pid, space=sq, houses=h + 1)

    def _sell(self, pid: str, sq: int, quiet: bool = False) -> None:
        h = self.houses[sq]
        half = SPACES[sq]["house"] // 2
        if h == 5:
            # a hotel breaks back into four houses, or as many as the bank still has
            back = min(4, self.houses_left)
            self.hotels_left += 1
            self.houses_left -= back
            refund = half * (5 - back)
            h = back
        else:
            self.houses_left += 1
            refund = half
            h -= 1
        if h:
            self.houses[sq] = h
        else:
            self.houses.pop(sq, None)
        self.cash[pid] += refund
        self.emit("sell", pid=pid, space=sq, houses=h, amount=refund, quiet=quiet)

    def _mortgage(self, pid: str, sq: int, quiet: bool = False) -> None:
        self.mortgaged.add(sq)
        self.cash[pid] += mortgage_value(sq)
        self.emit("mortgage", pid=pid, space=sq, amount=mortgage_value(sq), quiet=quiet)

    def _unmortgage(self, pid: str, sq: int) -> None:
        self.mortgaged.discard(sq)
        self.cash[pid] -= lift_cost(sq)
        self.emit("unmortgage", pid=pid, space=sq, amount=lift_cost(sq))

    # --- trading ----------------------------------------------------------------
    def _side(self, pid: str, raw: Any) -> dict[str, Any]:
        raw = raw if isinstance(raw, dict) else {}
        cash = raw.get("cash", 0)
        spaces = raw.get("spaces", [])
        cards = raw.get("cards", 0)
        if not isinstance(cash, int) or isinstance(cash, bool) or cash < 0:
            raise GameError("Cash has to be a whole amount")
        if not isinstance(cards, int) or isinstance(cards, bool) or not 0 <= cards <= len(self.jail_cards[pid]):
            raise GameError("Not that many jail cards")
        if not isinstance(spaces, list) or not all(isinstance(s, int) for s in spaces) or len(set(spaces)) != len(spaces):
            raise GameError("Bad property list")
        for s in spaces:
            if self.owner.get(s) != pid:
                raise GameError(f"{SPACES[s]['name'] if 0 <= s < 40 else 'That'} isn't theirs to trade")
            sp = SPACES[s]
            if sp["kind"] == "street" and any(self.houses.get(i, 0) for i in GROUPS[sp["group"]]):
                raise GameError(f"Sell the buildings on the {sp['group']} set before trading it")
        if cash > self.cash[pid]:
            raise GameError(f"Only ${self.cash[pid]} to offer")
        return {"cash": cash, "spaces": sorted(spaces), "cards": cards}

    def _offer(self, pid: str, action: dict[str, Any]) -> None:
        to = action.get("to")
        if to == pid or to not in self.players or to in self.broke:
            raise GameError("Pick someone to trade with")
        give, get = self._side(pid, action.get("give")), self._side(to, action.get("get"))
        if not any((give["cash"], give["spaces"], give["cards"], get["cash"], get["spaces"], get["cards"])):
            raise GameError("Put something on the table")
        self.trade = {"id": self.seq + 1, "from": pid, "to": to, "give": give, "get": get}
        self.emit("offer_trade", pid=pid, to=to)
        self._arm(TRADE_TIME, self._timeout)

    def _interest(self, spaces: list[int]) -> int:
        return sum((mortgage_value(s) + 9) // 10 for s in spaces if s in self.mortgaged)

    def _close_trade(self, accept: bool, cancelled: bool = False, timeout: bool = False) -> None:
        tr = self.trade
        assert tr
        a, b = tr["from"], tr["to"]
        if accept:
            give, get = self._side(a, tr["give"]), self._side(b, tr["get"])
            a_cash = self.cash[a] - give["cash"] + get["cash"]
            b_cash = self.cash[b] - get["cash"] + give["cash"]
            a_int, b_int = self._interest(get["spaces"]), self._interest(give["spaces"])
            if a_cash < a_int or b_cash < b_int:
                raise GameError("Not enough cash left for the 10% interest on the mortgaged property")
            self.cash[a], self.cash[b] = a_cash - a_int, b_cash - b_int
            for s in give["spaces"]:
                self.owner[s] = b
            for s in get["spaces"]:
                self.owner[s] = a
            for _ in range(give["cards"]):
                self.jail_cards[b].append(self.jail_cards[a].pop())
            for _ in range(get["cards"]):
                self.jail_cards[a].append(self.jail_cards[b].pop())
        self.trade = None
        self.emit("trade", pid=a, to=b, ok=accept, cancelled=cancelled, timeout=timeout,
                  give=tr["give"], get=tr["get"])
        self._rearm()

    # --- the end ----------------------------------------------------------------
    def _finish_game(self, timed: bool = False) -> None:
        alive = sorted(self.alive(), key=self.worth, reverse=True)
        ranking: list[list[str]] = []
        for p in alive:
            if ranking and self.worth(ranking[-1][0]) == self.worth(p):
                ranking[-1].append(p)
            else:
                ranking.append([p])
        ranking += [[p] for p in reversed(self.broke) if p not in self.left]
        if self.left:
            ranking.append(list(self.left))
        details: dict[str, str] = {}
        for p in alive:
            n = len(self.owned(p))
            details[p] = f"${self.worth(p)} net worth · {n} propert{'y' if n == 1 else 'ies'}"
        for p in self.broke:
            details[p] = "left the table" if p in self.left else f"bankrupt · {ordinal(len(self.players) - self.broke.index(p))}"
        summary = "Time's up — richest mogul wins" if timed else "Last mogul standing"
        self.phase = "over"
        self.finish(ranking, summary, details)

    def forfeit(self, pid: str) -> None:
        if self.over or pid not in self.players or pid in self.broke:
            return
        self.left.append(pid)
        self.emit("left", pid=pid)
        was_turn = self.cur == pid
        if self.trade and pid in (self.trade["from"], self.trade["to"]):
            self.trade = None
            self._rearm()
        if self.auction and self.auction["bidder"] == pid:
            self.auction.update(bid=0, bidder=None)
        if self.phase == "debt" and self.debt and self.debt["pid"] == pid:
            return self._go_broke() if not self.over else None
        # they might be owed money in the queue: their creditors pay the bank instead (handled in _settle)
        self._bankrupt(pid, None)
        if self.over:
            return
        if was_turn and self.phase in ("roll", "buy", "end", "wait"):
            self._next_turn()

    # --- view -------------------------------------------------------------------
    def view(self, pid: str) -> dict[str, Any]:
        timed = self.phase in ("roll", "buy", "end", "auction", "debt") or self.trade
        return {
            "seats": self.seats,
            "turn": self.cur,
            "phase": self.phase,
            "cash": self.cash,
            "pos": self.pos,
            "jail": self.jail,
            "jailCards": {p: len(c) for p, c in self.jail_cards.items()},
            "owner": {str(k): v for k, v in self.owner.items()},
            "houses": {str(k): v for k, v in self.houses.items()},
            "mortgaged": sorted(self.mortgaged),
            "housesLeft": self.houses_left,
            "hotelsLeft": self.hotels_left,
            "dice": self.dice,
            "doubles": self.doubles,
            "last": self.last,
            "card": self.card,
            "offer": self.offer,
            "auction": self.auction,
            "debt": self.debt,
            "trade": self.trade,
            "manager": self.manager(),
            "broke": self.broke,
            "left": self.left,
            "worth": {p: self.worth(p) for p in self.seats},
            "raisable": self.can_raise(pid) if pid in self.cash else 0,
            "endsIn": round(max(0.0, self.ends_at - self.now())) if self.ends_at is not None else None,
            "timeLeft": round(max(0.0, self.deadline - self.now()), 2) if timed and not self.over else None,
            "timeTotal": self.total,
        }
