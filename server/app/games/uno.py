"""UNO, following the official rules summarised at unorules.com.

Implemented rules:
* 108-card classic deck, or the 112-card "modern" deck (+1 Wild Swap Hands,
  +3 Wild Customizable cards with the house rule "everyone else draws 2").
* Match by colour, number or symbol; Wilds can always be played.
* No stacking: one card per turn, Draw Two / Wild Draw Four can't be answered.
* Draw one if you can't (or won't) play; the drawn card may be played at once.
* Wild Draw Four may be challenged: guilty -> offender draws 4, challenger plays
  on; innocent -> challenger draws 6 and loses the turn, and is shown the
  offender's hand as proof. A caught bluffer's hand stays private. "Guilty" means holding another card that
  could have been played (house rule, default) or, with the official rule, a
  card of the colour in play.
* "UNO!" must be called when down to one card; another player can catch you
  before the next player acts, costing you 2 cards.
* Start-card rules for every action / wild type (WD4 is returned and reshuffled).
* Two-player rules: Reverse acts as Skip, Skip / Draw Two / WD4 give the turn back.
* Draw pile is rebuilt from the discard pile when exhausted.
* Playing on: whoever empties their hand finishes (1st, 2nd, ...) and watches;
  the rest keep going until one player is left holding cards. Each finisher
  collects the points still in the other hands at that moment.
* The opening player rotates round the table from game to game.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError, Results

COLORS = ("red", "yellow", "green", "blue")
WILDS = ("wild", "wild4", "swap", "custom")
POINTS = {"skip": 20, "reverse": 20, "draw2": 20, "wild": 50, "wild4": 50, "swap": 40, "custom": 40}


def build_deck(modern: bool) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []

    def add(color: str, kind: str, value: int | None = None) -> None:
        cards.append({"id": len(cards), "color": color, "kind": kind, "value": value})

    for c in COLORS:
        add(c, "number", 0)
        for v in range(1, 10):
            add(c, "number", v)
            add(c, "number", v)
        for kind in ("skip", "reverse", "draw2"):
            add(c, kind)
            add(c, kind)
    for _ in range(4):
        add("wild", "wild")
        add("wild", "wild4")
    if modern:
        add("wild", "swap")
        for _ in range(3):
            add("wild", "custom")
    return cards


def ordinal(n: int) -> str:
    return f"{n}{'tsnrhtdd'[(n // 10 % 10 != 1) * (n % 10 < 4) * n % 10::4]}"


def card_points(card: dict[str, Any]) -> int:
    return card["value"] if card["kind"] == "number" else POINTS[card["kind"]]


class Uno(Game):
    id = "uno"
    name = "UNO"
    min_players = 2
    max_players = 5

    def __init__(self, players, options=None, rng=None):
        super().__init__(players, options, rng)
        self.seats = list(self.players)      # everyone dealt in, in seat order (finishers stay seated)
        self.left: list[str] = []            # quit mid-game
        self.bluff = "color" if self.options.get("bluff") == "color" else "any"
        self.reveal: dict[str, Any] | None = None   # the challenged hand, shown to the challenger
        self.modern = bool(self.options.get("modern", False))
        self.deck_size = len(build_deck(self.modern))
        self.draw_pile = build_deck(self.modern)
        self.rng.shuffle(self.draw_pile)
        self.discard: list[dict[str, Any]] = []
        self.hands: dict[str, list[dict[str, Any]]] = {p: [] for p in self.players}
        self.direction = 1
        self.color = ""
        self.phase = "play"                  # play | drawn | challenge | start_color
        self.drawn_id: int | None = None
        self.challenge: dict[str, Any] | None = None   # {"from", "victim", "guilty"}
        self.said_uno: set[str] = set()
        self.vulnerable: set[str] = set()
        first = self.options.get("first")
        if first in self.players:
            self.dealer = (self.players.index(first) - 1) % len(self.players)
        else:
            self.dealer = self.rng.randrange(len(self.players))
        self.turn = 0
        self.scores: dict[str, int] = {}
        for _ in range(7):
            for p in self.players:
                self._give(p, 1)
        self._start()

    # --- deck plumbing ------------------------------------------------------
    def _pop(self) -> dict[str, Any] | None:
        if not self.draw_pile:
            if len(self.discard) <= 1:
                return None
            top = self.discard.pop()
            self.draw_pile = self.discard
            self.rng.shuffle(self.draw_pile)
            self.discard = [top]
            self.emit("reshuffle")
        return self.draw_pile.pop()

    def _give(self, pid: str, n: int) -> int:
        got = 0
        for _ in range(n):
            card = self._pop()
            if card is None:
                break
            self.hands[pid].append(card)
            got += 1
        if got:
            self.said_uno.discard(pid)
            self.vulnerable.discard(pid)
        return got

    @property
    def top(self) -> dict[str, Any]:
        return self.discard[-1]

    def _idx(self, offset: int, base: int | None = None) -> int:
        b = self.turn if base is None else base
        return (b + self.direction * offset) % len(self.players)

    def _next_pid(self) -> str:
        return self.players[self._idx(1)]

    # --- start of round -----------------------------------------------------
    def _start(self) -> None:
        while True:
            card = self._pop()
            assert card is not None
            if card["kind"] == "wild4":
                self.draw_pile.insert(0, card)
                self.rng.shuffle(self.draw_pile)
                continue
            break
        self.discard.append(card)
        first = (self.dealer + 1) % len(self.players)
        self.turn = first
        kind = card["kind"]
        self.color = card["color"]
        if kind == "skip":
            self.turn = self._idx(1, first)
        elif kind == "reverse":
            self.direction = -1
            self.turn = self.dealer
        elif kind == "draw2":
            self._give(self.players[first], 2)
            self.turn = self._idx(1, first)
        elif kind in WILDS:
            self.color = ""
            self.phase = "start_color"
        self.emit("start", card=card)

    # --- rules --------------------------------------------------------------
    def playable(self, card: dict[str, Any]) -> bool:
        if card["kind"] in WILDS:
            return True
        if card["color"] == self.color:
            return True
        top = self.top
        if card["kind"] == "number":
            return top["kind"] == "number" and top["value"] == card["value"]
        return top["kind"] == card["kind"]

    def _find(self, pid: str, cid: Any) -> dict[str, Any]:
        for c in self.hands[pid]:
            if c["id"] == cid:
                return c
        raise GameError("You don't hold that card")

    def _advance(self, skip: int = 0) -> None:
        self.turn = self._idx(1 + skip)
        self.phase = "play"
        self.drawn_id = None

    def _close_uno_window(self, actor: str) -> None:
        # The next player taking their turn ends everyone else's catch window.
        self.vulnerable = {p for p in self.vulnerable if p == actor}

    def _check_color(self, color: Any) -> str:
        if color not in COLORS:
            raise GameError("Pick a colour")
        return color

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        if pid in self.finished:
            raise GameError("You're already out — enjoy the show")
        self.require_player(pid)
        if self.over:
            raise GameError("Round is over")
        t = action.get("type")
        if t == "uno":
            return self._call_uno(pid)
        if t == "catch":
            return self._catch(pid, action.get("target"))
        if self.players[self.turn] != pid:
            raise GameError("Not your turn")
        self._close_uno_window(pid)
        self.reveal = None
        if t == "start_color":
            if self.phase != "start_color":
                raise GameError("Not now")
            self.color = self._check_color(action.get("color"))
            if self.top["kind"] == "swap":
                self._swap(pid, action.get("target"))
            self.phase = "play"
            self.emit("color", pid=pid, color=self.color)
        elif t == "play":
            self._play(pid, action)
        elif t == "draw":
            self._draw(pid)
        elif t == "pass":
            if self.phase != "drawn":
                raise GameError("Draw first")
            self.emit("pass", pid=pid)
            self._advance()
        elif t in ("accept", "challenge"):
            self._resolve_challenge(pid, t == "challenge")
        else:
            raise GameError("Unknown action")

    def _call_uno(self, pid: str) -> None:
        n = len(self.hands[pid])
        if n > 2:
            raise GameError("You can only call UNO with two cards or fewer")
        self.said_uno.add(pid)
        self.vulnerable.discard(pid)
        self.emit("uno", pid=pid)

    def _catch(self, pid: str, target: Any) -> None:
        if target == pid or target not in self.vulnerable:
            raise GameError("Nobody to catch")
        self.vulnerable.discard(target)
        self._give(target, 2)
        self.emit("caught", pid=target, by=pid)

    def _draw(self, pid: str) -> None:
        if self.phase != "play":
            raise GameError("You can't draw right now")
        got = self._give(pid, 1)
        self.emit("draw", pid=pid, count=got)
        if got and self.playable(self.hands[pid][-1]):
            self.phase = "drawn"
            self.drawn_id = self.hands[pid][-1]["id"]
        else:
            self._advance()

    def _swap(self, pid: str, target: Any) -> None:
        if target not in self.players or target == pid:
            raise GameError("Choose who to swap with")
        self.hands[pid], self.hands[target] = self.hands[target], self.hands[pid]
        for p in (pid, target):
            self.said_uno.discard(p)
            self.vulnerable.discard(p)
        self.emit("swap", pid=pid, target=target)

    def _play(self, pid: str, action: dict[str, Any]) -> None:
        if self.phase not in ("play", "drawn"):
            raise GameError("You can't play right now")
        card = self._find(pid, action.get("card"))
        if self.phase == "drawn" and card["id"] != self.drawn_id:
            raise GameError("You may only play the card you just drew")
        if not self.playable(card):
            raise GameError("That card doesn't match")
        hand = self.hands[pid]
        kind = card["kind"]
        last = len(hand) == 1
        color = card["color"]
        if kind in WILDS:
            color = self._check_color(action.get("color"))
        if kind == "swap" and not last and (action.get("target") not in self.players or action.get("target") == pid):
            raise GameError("Choose who to swap with")
        prev_color = self.color
        bad = [c["id"] for c in hand if c is not card and self._bluffs_with(c)] if kind == "wild4" else []

        hand.remove(card)
        self.discard.append(card)
        self.color = color
        self.drawn_id = None
        self.emit("play", pid=pid, card=card, color=color)

        if len(hand) == 1 and pid not in self.said_uno:
            self.vulnerable.add(pid)

        n = len(self.players)
        if last:
            return self._go_out(pid, card)

        if kind == "number" or kind == "wild":
            self._advance()
        elif kind == "skip":
            self._advance(1)
        elif kind == "reverse":
            if n == 2:
                self._advance(1)
            else:
                self.direction *= -1
                self._advance()
        elif kind == "draw2":
            victim = self._next_pid()
            self._give(victim, 2)
            self.emit("forced_draw", pid=victim, count=2, card=card)
            self._advance(1)
        elif kind == "wild4":
            victim = self._next_pid()
            self.challenge = {"from": pid, "victim": victim, "guilty": bool(bad), "bad": bad, "color": prev_color}
            self._advance()
            self.phase = "challenge"
        elif kind == "swap":
            self._swap(pid, action.get("target"))
            self._advance()
        elif kind == "custom":
            for p in self.players:
                if p != pid:
                    self._give(p, 2)
            self.emit("custom", pid=pid)
            self._advance()

    def _bluffs_with(self, c: dict[str, Any]) -> bool:
        """Would holding this card make a Wild Draw Four illegal?"""
        if c["kind"] in WILDS:
            return False
        if self.bluff == "color":
            return c["color"] == self.color
        return self.playable(c)

    def _resolve_challenge(self, pid: str, challenged: bool) -> None:
        if self.phase != "challenge" or not self.challenge:
            raise GameError("Nothing to respond to")
        ch = self.challenge
        self.challenge = None
        if challenged and not ch["guilty"]:
            # A clean hand is shown to the challenger only, as proof; a caught bluff stays hidden.
            self.reveal = {"to": pid, "of": ch["from"], "cards": [dict(c) for c in self.hands[ch["from"]]],
                           "bad": ch["bad"], "color": ch["color"], "guilty": ch["guilty"], "id": self.seq + 1}
        if not challenged:
            self._give(pid, 4)
            self.emit("forced_draw", pid=pid, count=4)
            self._advance()
        elif ch["guilty"]:
            self._give(ch["from"], 4)
            self.emit("challenge", pid=pid, offender=ch["from"], guilty=True, bad=len(ch["bad"]), color=ch["color"])
            self.phase = "play"
        else:
            self._give(pid, 6)
            self.emit("challenge", pid=pid, offender=ch["from"], guilty=False, bad=0, color=ch["color"])
            self._advance()

    # --- going out ----------------------------------------------------------
    def _go_out(self, pid: str, card: dict[str, Any]) -> None:
        """Last card down: it still does its job for the players left, then pid sits back and watches."""
        kind = card["kind"]
        if kind == "skip" or (kind == "reverse" and len(self.players) == 2):
            self._advance(1)
        elif kind == "reverse":
            self.direction *= -1
            self._advance()
        elif kind in ("draw2", "wild4"):
            victim = self._next_pid()
            count = 2 if kind == "draw2" else 4
            self._give(victim, count)
            self.emit("forced_draw", pid=victim, count=count, card=card)
            self._advance(1)
        elif kind == "custom":
            for p in self.players:
                if p != pid:
                    self._give(p, 2)
            self.emit("custom", pid=pid)
            self._advance()
        else:                                   # numbers, Wild, and Swap (an empty hand swaps nothing)
            self._advance()
        # penalties from the last card land first, then the finisher collects what's left in the other hands
        pts = sum(card_points(c) for p in self.players if p != pid for c in self.hands[p])
        self.finished.append(pid)
        self.scores[pid] = pts
        self.emit("out", pid=pid, place=len(self.finished), points=pts)
        self._retire(pid)
        if len(self.players) < 2:
            self._finish_game()

    def _retire(self, pid: str) -> None:
        """Take pid out of the turn order without disturbing whose go it is."""
        cur = self.players[self.turn]
        idx = self.players.index(pid)
        self.players.remove(pid)
        self.said_uno.discard(pid)
        self.vulnerable.discard(pid)
        if not self.players:
            return
        if cur == pid:
            self.turn = idx % len(self.players) if self.direction == 1 else (idx - 1) % len(self.players)
            if self.phase != "start_color":
                self.phase = "play"
            self.drawn_id = None
        else:
            self.turn = self.players.index(cur)

    def _finish_game(self) -> None:
        pts = {p: sum(card_points(c) for c in self.hands.get(p, [])) for p in self.seats}
        ranking: list[list[str]] = [[p] for p in self.finished]
        rest = sorted(self.players, key=lambda p: pts[p])
        for p in rest:
            if ranking and len(ranking) > len(self.finished) and pts[ranking[-1][0]] == pts[p]:
                ranking[-1].append(p)
            else:
                ranking.append([p])
        if self.left:
            ranking.append(list(self.left))
        details: dict[str, str] = {}
        for i, p in enumerate(self.finished):
            details[p] = f"{ordinal(i + 1)} out · +{self.scores.get(p, 0)} pts"
        for p in self.players:
            n = len(self.hands[p])
            details[p] = f"{n} card{'s' if n != 1 else ''} · {pts[p]} pts left"
        for p in self.left:
            details[p] = "left the table"
        if len(self.seats) - len(self.left) <= 2 and self.finished:
            summary = f"UNO out! {self.scores.get(self.finished[0], 0)} points collected"
        elif self.finished:
            summary = "Everyone's out but one"
        else:
            summary = "Last one at the table"
        self.over = True
        self.phase = "play"
        self.challenge = None
        self.results = Results(ranking, summary, details)
        self.clear_timers()
        self.dirty = True

    def forfeit(self, pid: str) -> None:
        if self.over or pid not in self.players:
            return
        self.draw_pile[:0] = self.hands[pid]
        self.hands[pid] = []
        if self.challenge and pid in (self.challenge["from"], self.challenge["victim"]):
            self.challenge = None
            self.phase = "play"
        self.left.append(pid)
        self._retire(pid)
        self.emit("left", pid=pid)
        if len(self.players) < 2:
            self._finish_game()

    # --- view ---------------------------------------------------------------
    def view(self, pid: str) -> dict[str, Any]:
        me = self.hands.get(pid) if pid in self.players or self.over else None
        my_turn = bool(me is not None and self.players[self.turn] == pid)
        playable: list[int] = []
        if me is not None and my_turn and not self.over:
            if self.phase == "play":
                playable = [c["id"] for c in me if self.playable(c)]
            elif self.phase == "drawn":
                playable = [self.drawn_id] if self.drawn_id is not None else []
        return {
            "hand": me or [],
            "counts": {p: len(h) for p, h in self.hands.items()},
            "top": self.top,
            "color": self.color,
            "direction": self.direction,
            "turn": self.players[self.turn],
            "phase": self.phase,
            "drawnId": self.drawn_id if my_turn else None,
            "playable": playable,
            "challenge": ({"from": self.challenge["from"], "victim": self.challenge["victim"],
                           "color": self.challenge["color"], "rule": self.bluff}
                          if self.challenge else None),
            "reveal": self.reveal if self.reveal and self.reveal["to"] == pid else None,
            "seats": self.seats,
            "left": self.left,
            "places": {p: i + 1 for i, p in enumerate(self.finished)},
            "saidUno": sorted(self.said_uno),
            "vulnerable": sorted(self.vulnerable),
            "drawCount": len(self.draw_pile),
            "modern": self.modern,
            "hands": self.hands if self.over else None,
            "scores": self.scores,
        }
