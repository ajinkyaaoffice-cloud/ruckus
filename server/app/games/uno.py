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

UNO Flip (option modern="flip"), per unorules.com/uno-flip-rules:
* 112 double-sided cards. Light side: red/yellow/green/blue 1-9, Draw One,
  Skip, Reverse, Flip, plus Wild and Wild Draw Two. Dark side: pink/teal/
  purple/orange 1-9, Draw Five, Skip Everyone, Reverse, Flip, plus Wild and
  Wild Draw Colour. Every card pairs a light face with a dark face at random.
* Play starts on the light side. A Flip card turns every card over (hands, draw
  pile and discard pile, whose order reverses), so the old bottom discard is the
  new top and play continues on the other side. Opponents see the inactive
  side of your hand; nobody sees the inactive side of their own.
* If the card turned up by a Flip is a Wild, the flipper names the colour.
* Draw One / Draw Five: next player draws and is skipped. Skip Everyone: all
  others are skipped, so you go again.
* Wild Draw Two and Wild Draw Colour are legal only without a card of the colour
  in play (or, with the house rule, any other playable card) and may be
  challenged: Draw Two guilty -> offender draws 2, innocent -> challenger draws 4;
  Draw Colour: the victim draws until they hit the named colour; guilty ->
  offender does instead, innocent -> challenger does, plus 2 more.
* A Flip turned up as the first card flips the table before the first turn.
  Wild Draw Two can't open a round. Cards score by the side in play at the end.

UNO Show 'Em No Mercy (option modern="mercy"):
* 168 cards: per colour 0-9 twice, Skip x3, Reverse x3, Draw Two x3, Draw Four x2,
  Skip Everyone x2, Discard All x3; plus Wild Reverse Draw Four x8, Wild Draw Six x4,
  Wild Draw Ten x4 and Wild Colour Roulette x8. No plain Wild, no challenges.
* Stacking: a draw card may be answered with any draw card of equal or higher
  value (any colour). Whoever can't or won't stack takes the whole pile and misses
  their go. Wild Reverse Draw Four reverses play first, so the penalty goes back.
* Can't play? Keep drawing until you can (the card that fits may be played or kept).
* 7: swap hands with a player of your choice. 0: every hand passes along in the
  direction of play.
* Discard All: also throw away every other card of that colour you hold.
* Colour Roulette: the next player names a colour and turns cards over until it
  shows, keeping them all, and misses their go.
* Mercy rule: anyone holding 50 or more cards is knocked out.
* Play on as usual; the round opens on a number card.
"""
from __future__ import annotations

from typing import Any

from .base import Game, GameError, Results

COLORS = ("red", "yellow", "green", "blue")
WILDS = ("wild", "wild4", "swap", "custom")
POINTS = {"skip": 20, "reverse": 20, "draw2": 20, "wild": 50, "wild4": 50, "swap": 40, "custom": 40}

# UNO Flip
DARK = ("pink", "teal", "purple", "orange")
FLIP_WILDS = ("wild", "wild2", "wildcolor")
FLIP_POINTS = {"draw1": 10, "draw5": 20, "reverse": 20, "skip": 20, "flip": 20, "skipall": 30,
               "wild": 40, "wild2": 50, "wildcolor": 60}
CHALLENGEABLE = ("wild4", "wild2", "wildcolor")

# UNO Show 'Em No Mercy
MERCY_WILDS = ("wildrev4", "wild6", "wild10", "roulette")
MERCY_POINTS = {"skip": 20, "reverse": 20, "draw2": 20, "draw4": 30, "skipall": 30, "discard": 30,
                "wildrev4": 50, "wild6": 50, "wild10": 60, "roulette": 50}
DRAW_VALUE = {"draw2": 2, "draw4": 4, "wildrev4": 4, "wild6": 6, "wild10": 10}
MERCY_LIMIT = 50
UNO_GRACE = 2.0   # seconds a player on one card has to call UNO before anyone may catch them
UNO_CATCH = 3.0   # once catching opens, it stays open at least this long


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


def build_mercy_deck() -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []

    def add(color: str, kind: str, value: int | None = None, n: int = 1) -> None:
        for _ in range(n):
            cards.append({"id": len(cards), "color": color, "kind": kind, "value": value, "mercy": True})

    for c in COLORS:
        for v in range(10):
            add(c, "number", v, 2)
        for kind, n in (("skip", 3), ("reverse", 3), ("draw2", 3), ("draw4", 2), ("skipall", 2), ("discard", 3)):
            add(c, kind, None, n)
    for kind, n in (("wildrev4", 8), ("wild6", 4), ("wild10", 4), ("roulette", 8)):
        add("wild", kind, None, n)
    return cards


def build_flip_deck(rng) -> list[dict[str, Any]]:
    """112 cards, each a light face (active) with a dark face underneath in "other"."""
    def side(colors: tuple[str, ...], actions: tuple[str, ...], wilds: tuple[str, ...]) -> list[dict[str, Any]]:
        faces: list[dict[str, Any]] = []
        for c in colors:
            for v in range(1, 10):
                faces += [{"color": c, "kind": "number", "value": v}] * 2
            for kind in actions:
                faces += [{"color": c, "kind": kind, "value": None}] * 2
        for kind in wilds:
            faces += [{"color": "wild", "kind": kind, "value": None}] * 4
        return [dict(f) for f in faces]

    light = side(COLORS, ("draw1", "skip", "reverse", "flip"), ("wild", "wild2"))
    dark = side(DARK, ("draw5", "skipall", "reverse", "flip"), ("wild", "wildcolor"))
    rng.shuffle(dark)
    return [{"id": i, **lf, "other": df} for i, (lf, df) in enumerate(zip(light, dark))]


STAT_KEYS = ("hits", "actions", "catches", "caught", "challenges", "busted", "knockouts", "dumped")


def ordinal(n: int) -> str:
    return f"{n}{'tsnrhtdd'[(n // 10 % 10 != 1) * (n % 10 < 4) * n % 10::4]}"


def card_points(card: dict[str, Any]) -> int:
    if card["kind"] == "number":
        return card["value"]
    if "other" in card:
        return FLIP_POINTS[card["kind"]]
    return MERCY_POINTS[card["kind"]] if card.get("mercy") else POINTS[card["kind"]]


def face(card: dict[str, Any]) -> dict[str, Any]:
    """The side its holder can see; the other face stays private."""
    return {k: v for k, v in card.items() if k not in ("other", "mercy")}


def back(card: dict[str, Any]) -> dict[str, Any]:
    """What everyone else sees of a Flip card: its inactive face (no id, so it can't be tracked)."""
    return dict(card["other"])


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
        self.flip = self.options.get("modern") == "flip"
        self.mercy = self.options.get("modern") == "mercy"
        self.modern = self.options.get("modern") is True
        self.dark = False                    # Flip: which side is in play
        self.wilds = FLIP_WILDS if self.flip else MERCY_WILDS if self.mercy else WILDS
        self.stack = 0                       # No Mercy: cards piled up on the player who must answer
        self.stack_min = 0                   # ...and the smallest draw card that may be stacked on it
        self.mercied: list[str] = []         # No Mercy: knocked out at the card limit, in order
        self.draw_pile = (build_flip_deck(self.rng) if self.flip else build_mercy_deck() if self.mercy
                          else build_deck(self.modern))
        self.deck_size = len(self.draw_pile)
        self.rng.shuffle(self.draw_pile)
        self.discard: list[dict[str, Any]] = []
        self.hands: dict[str, list[dict[str, Any]]] = {p: [] for p in self.players}
        self.direction = 1
        self.color = ""
        self.phase = "play"                  # play | drawn | challenge | start_color (also after a Flip turns up a Wild) | stack | roulette
        self.drawn_id: int | None = None
        self.challenge: dict[str, Any] | None = None   # {"from", "victim", "guilty"}
        self.said_uno: set[str] = set()
        self.vulnerable: set[str] = set()
        self.slipped_at: dict[str, float] = {}  # when each vulnerable player went down to one card
        self.flip_pick = False               # the start_color phase belongs to whoever just flipped
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
        # what everyone did this round, for the session score: hits = cards made others draw
        self.stats: dict[str, dict[str, int]] = {p: {k: 0 for k in STAT_KEYS} for p in self.players}
        self.last_play: str | None = None
        self._start()

    # --- round stats --------------------------------------------------------
    def emit(self, kind: str, /, **data: Any) -> None:
        super().emit(kind, **data)
        if hasattr(self, "stats"):
            self._tally(kind, data)

    def _tally(self, kind: str, d: dict[str, Any]) -> None:
        st, pid = self.stats, d.get("pid")
        if kind == "play":
            self.last_play = pid
            if d["card"]["kind"] != "number":
                st[pid]["actions"] += 1
        elif kind == "forced_draw" and self.last_play not in (None, pid):
            st[self.last_play]["hits"] += d.get("count", 0)
        elif kind == "custom":
            st[pid]["hits"] += 2 * (len(self.players) - 1)
        elif kind == "caught":
            st[d["by"]]["catches"] += 1
            st[pid]["caught"] += 1
        elif kind == "challenge":
            if d["guilty"]:
                st[pid]["challenges"] += 1
                st[d["offender"]]["busted"] += 1
            else:
                st[pid]["busted"] += 1
                st[d["offender"]]["hits"] += d.get("count", 0)
        elif kind == "mercy" and self.last_play not in (None, pid):
            st[self.last_play]["knockouts"] += 1
        elif kind == "discard_all":
            st[pid]["dumped"] += d.get("count", 0)

    def session_awards(self) -> dict[str, dict[str, Any]] | None:
        """UNO scores the whole round, not just who went out first:
        placing        2 for every player finished ahead of (not counting quitters), +2 for the win
        haul           going out while the others hold plenty: 1 per 20 card points (max 4)
        attacks        1 per 4 cards you made others draw, per 10 in No Mercy (max 3)
        catches        +1 per UNO catch (max 2), -1 each time you were caught
        challenges     +1 for calling out a bluff, -1 for a wrong call or a bluff caught
        knockouts      No Mercy: +2 for every player your cards knocked out
        dumps          No Mercy: 1 per 6 cards thrown away by Discard All (max 2)
        close call     still in at the end with 1-2 cards: +1
        stuck          still in at the end: -1 per 60 card points left (max -3)
        A round never scores below zero."""
        if not self.results:
            return None
        ranking = self.results.ranking
        out: dict[str, dict[str, Any]] = {}
        for place, group in enumerate(ranking):
            for pid in group:
                if pid in self.left:
                    out[pid] = {"points": 0, "win": 0, "why": [["left", 0]]}
                    continue
                st = self.stats.get(pid) or {k: 0 for k in STAT_KEYS}
                why: list[list[Any]] = []
                beaten = sum(p not in self.left for g in ranking[place + 1:] for p in g)   # quitters don't count
                why.append(["win" if place == 0 else "placing", 2 * beaten + (2 if place == 0 else 0)])
                if pid in self.finished:
                    why.append(["haul", min(4, self.scores.get(pid, 0) // 20)])
                why.append(["attacks", min(3, st["hits"] // (10 if self.mercy else 4))])
                why.append(["catches", min(2, st["catches"]) - st["caught"]])
                why.append(["challenges", st["challenges"] - st["busted"]])
                why.append(["knockouts", 2 * st["knockouts"]])
                why.append(["dumps", min(2, st["dumped"] // 6)])
                if pid in self.players:
                    hand = self.hands[pid]
                    if len(hand) <= 2:
                        why.append(["close call", 1])
                    why.append(["stuck", -min(3, sum(card_points(c) for c in hand) // 60)])
                why = [w for w in why if w[1]] or [["placing", 0]]
                out[pid] = {"points": max(0, sum(n for _, n in why)), "win": int(place == 0), "why": why}
        return out

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
            if card["kind"] in ("wild4", "wild2") or (self.mercy and card["kind"] != "number"):
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
        elif kind in ("draw2", "draw1"):
            self._give(self.players[first], 2 if kind == "draw2" else 1)
            self.turn = self._idx(1, first)
        elif kind == "flip":
            self.emit("start", card=card)
            self._flip(None)
            if self.top["kind"] in self.wilds:
                self.phase = "start_color"
            return
        elif kind in self.wilds:
            self.color = ""
            self.phase = "start_color"
        self.emit("start", card=card)

    def _flip(self, pid: str | None) -> None:
        """Turn the whole table over. The discard pile flips as a stack, so its old bottom card is the new top."""
        for pile in (self.draw_pile, self.discard, *self.hands.values()):
            for c in pile:
                active = {k: c[k] for k in ("color", "kind", "value")}
                c.update(c["other"])
                c["other"] = active
        self.discard.reverse()
        self.draw_pile.reverse()
        self.dark = not self.dark
        top = self.top
        self.color = "" if top["kind"] in self.wilds else top["color"]
        self.emit("flip", pid=pid, side="dark" if self.dark else "light", top=face(top))

    # --- rules --------------------------------------------------------------
    def playable(self, card: dict[str, Any]) -> bool:
        if self.phase == "stack":
            return DRAW_VALUE.get(card["kind"], 0) >= self.stack_min
        if card["kind"] in self.wilds:
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

    def _touch(self) -> None:
        self.dirty = True

    def _catchable(self, pid: str) -> bool:
        return pid in self.vulnerable and self.now() - self.slipped_at.get(pid, 0.0) >= UNO_GRACE

    def _close_uno_window(self, actor: str) -> None:
        # The next player taking their turn ends everyone else's catch window, but
        # never before the others have had UNO_CATCH seconds of actual catching.
        t = self.now()
        self.vulnerable = {p for p in self.vulnerable
                           if p == actor or t - self.slipped_at.get(p, 0.0) < UNO_GRACE + UNO_CATCH}

    @property
    def palette(self) -> tuple[str, ...]:
        return DARK if self.dark else COLORS

    def _check_color(self, color: Any) -> str:
        if color not in self.palette:
            raise GameError("Pick a colour")
        return color

    def handle(self, pid: str, action: dict[str, Any]) -> None:
        try:
            self._handle(pid, action)
        finally:
            if self.mercy and not self.over:
                self._mercy_check()

    def _mercy_check(self) -> None:
        """No Mercy: 50 cards or more and you're out of the round."""
        for p in list(self.players):
            if len(self.hands[p]) >= MERCY_LIMIT and len(self.players) > 1:
                self.draw_pile[:0] = self.hands[p]
                n = len(self.hands[p])
                self.hands[p] = []
                self.mercied.append(p)
                if self.players[self.turn] == p:
                    self.stack = self.stack_min = 0
                self._retire(p)
                self.emit("mercy", pid=p, count=n)
        if len(self.players) < 2:
            self._finish_game()

    def _handle(self, pid: str, action: dict[str, Any]) -> None:
        if pid in self.finished or pid in self.mercied:
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
            if self.flip_pick:
                # a Flip turned up a Wild: the flipper named the colour, now the next player goes
                self.flip_pick = False
                self._advance()
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
        elif t == "roulette":
            if self.phase != "roulette":
                raise GameError("Not now")
            color = self._check_color(action.get("color"))
            got = self._draw_until(pid, color)
            self.color = color
            self.emit("color", pid=pid, color=color)
            self.emit("forced_draw", pid=pid, count=got, card={"kind": "roulette", "color": "wild", "value": None})
            self._advance()
        else:
            raise GameError("Unknown action")

    def _call_uno(self, pid: str) -> None:
        n = len(self.hands[pid])
        if n != 1:
            raise GameError("You can only call UNO with one card left")
        self.said_uno.add(pid)
        self.vulnerable.discard(pid)
        self.emit("uno", pid=pid)

    def _catch(self, pid: str, target: Any) -> None:
        if target == pid or target not in self.vulnerable:
            raise GameError("Nobody to catch")
        if not self._catchable(target):
            raise GameError("Give them a second to call it")
        self.vulnerable.discard(target)
        self._give(target, 2)
        self.emit("caught", pid=target, by=pid)

    def _draw(self, pid: str) -> None:
        if self.mercy and self.phase == "stack":
            got = self._give(pid, self.stack)
            self.stack = self.stack_min = 0
            self.emit("forced_draw", pid=pid, count=got, card={"kind": "stack", "color": "wild", "value": None})
            return self._advance()
        if self.phase != "play":
            raise GameError("You can't draw right now")
        if self.mercy:
            # draw until something fits (or the mercy rule bites)
            got = 0
            while len(self.hands[pid]) < MERCY_LIMIT and self._give(pid, 1):
                got += 1
                if self.playable(self.hands[pid][-1]):
                    break
            self.emit("draw", pid=pid, count=got)
            if got and self.playable(self.hands[pid][-1]):
                self.phase = "drawn"
                self.drawn_id = self.hands[pid][-1]["id"]
            else:
                self._advance()
            return
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
        if self.mercy:
            return self._play_mercy(pid, action)
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
        if kind in self.wilds:
            color = self._check_color(action.get("color"))
        if kind == "swap" and not last and (action.get("target") not in self.players or action.get("target") == pid):
            raise GameError("Choose who to swap with")
        prev_color = self.color
        bad = [c["id"] for c in hand if c is not card and self._bluffs_with(c)] if kind in CHALLENGEABLE else []

        hand.remove(card)
        self.discard.append(card)
        self.color = color
        self.drawn_id = None
        self.emit("play", pid=pid, card=face(card), color=color)

        if len(hand) == 1 and pid not in self.said_uno:
            self.vulnerable.add(pid)
            self.slipped_at[pid] = self.now()
            self.later(UNO_GRACE, self._touch)   # rebroadcast so the Catch! buttons appear

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
        elif kind in ("draw2", "draw1", "draw5"):
            victim = self._next_pid()
            count = {"draw2": 2, "draw1": 1, "draw5": 5}[kind]
            self._give(victim, count)
            self.emit("forced_draw", pid=victim, count=count, card=face(card))
            self._advance(1)
        elif kind == "skipall":
            self._advance(n - 1)
        elif kind == "flip":
            self._flip(pid)
            if self.top["kind"] in self.wilds:
                self.phase = "start_color"
                self.flip_pick = True
            else:
                self._advance()
        elif kind in CHALLENGEABLE:
            victim = self._next_pid()
            self.challenge = {"from": pid, "victim": victim, "guilty": bool(bad), "bad": bad, "color": prev_color,
                              "kind": kind, "named": color}
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

    def _play_mercy(self, pid: str, action: dict[str, Any]) -> None:
        if self.phase not in ("play", "drawn", "stack"):
            raise GameError("You can't play right now")
        card = self._find(pid, action.get("card"))
        if self.phase == "drawn" and card["id"] != self.drawn_id:
            raise GameError("You may only play the card you just drew")
        if not self.playable(card):
            raise GameError("Stack a draw card at least as big, or take them" if self.phase == "stack" else "That card doesn't match")
        hand = self.hands[pid]
        kind = card["kind"]
        last = len(hand) == 1
        color = card["color"]
        if kind in self.wilds and kind != "roulette":
            color = self._check_color(action.get("color"))
        seven = kind == "number" and card["value"] == 7 and not last
        target = action.get("target")
        if seven:
            rivals = [p for p in self.players if p != pid]
            if target not in rivals:
                if len(rivals) != 1:
                    raise GameError("Choose who to swap with")
                target = rivals[0]

        hand.remove(card)
        self.discard.append(card)
        self.color = "" if kind == "roulette" else color
        self.drawn_id = None
        self.emit("play", pid=pid, card=face(card), color=color)
        if kind == "discard":
            same = [c for c in hand if c["color"] == card["color"]]
            if same:
                for c in same:
                    hand.remove(c)
                self.discard[-1:-1] = same
                self.emit("discard_all", pid=pid, count=len(same), color=card["color"])

        if len(hand) == 1 and pid not in self.said_uno:
            self.vulnerable.add(pid)
            self.slipped_at[pid] = self.now()
            self.later(UNO_GRACE, self._touch)

        n = len(self.players)
        if kind in DRAW_VALUE:
            if kind == "wildrev4" and n > 2:
                self.direction *= -1
            self.stack += DRAW_VALUE[kind]
            self.stack_min = DRAW_VALUE[kind]
            self._advance()
            self.phase = "stack"
            self.emit("stack", pid=self.players[self.turn], count=self.stack, by=pid)
        elif seven:
            self._swap(pid, target)
            self._advance()
        elif kind == "number" and card["value"] == 0 and hand:
            self._rotate(pid)
            self._advance()
        elif kind == "skip" or (kind == "reverse" and n == 2):
            self._advance(1)
        elif kind == "reverse":
            self.direction *= -1
            self._advance()
        elif kind == "skipall":
            self._advance(n - 1)
        elif kind == "roulette":
            self._advance()
            self.phase = "roulette"
        else:
            self._advance()
        if not hand:
            self._mark_out(pid)

    def _rotate(self, pid: str) -> None:
        """No Mercy 0: every hand moves one seat along the way play is going."""
        old = {p: self.hands[p] for p in self.players}
        for i, p in enumerate(self.players):
            self.hands[self.players[(i + self.direction) % len(self.players)]] = old[p]
        self.said_uno.clear()
        self.vulnerable.clear()
        self.emit("rotate", pid=pid, direction=self.direction)

    def _draw_until(self, pid: str, color: str, extra: int = 0) -> int:
        """Wild Draw Colour: keep drawing until the named colour turns up (then `extra` more)."""
        got = 0
        while True:
            if not self._give(pid, 1):
                break
            got += 1
            if self.hands[pid][-1]["color"] == color:
                break
        return got + self._give(pid, extra)

    def _penalty(self, pid: str, kind: str, named: str, extra: int = 0) -> int:
        """Hand pid the draw a challengeable wild carries; returns how many cards it was."""
        if kind == "wildcolor":
            return self._draw_until(pid, named, extra)
        return self._give(pid, {"wild4": 4, "wild2": 2}[kind] + extra)

    def _bluffs_with(self, c: dict[str, Any]) -> bool:
        """Would holding this card make a Wild Draw Four / Two / Colour illegal?"""
        if c["kind"] in self.wilds:
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
            self.reveal = {"to": pid, "of": ch["from"], "cards": [face(c) for c in self.hands[ch["from"]]],
                           "bad": ch["bad"], "color": ch["color"], "guilty": ch["guilty"], "id": self.seq + 1,
                           "kind": ch.get("kind", "wild4")}
        kind, named = ch.get("kind", "wild4"), ch.get("named", "")
        if not challenged:
            got = self._penalty(pid, kind, named)
            self.emit("forced_draw", pid=pid, count=got, card={"kind": kind, "color": "wild", "value": None})
            self._advance()
        elif ch["guilty"]:
            got = self._penalty(ch["from"], kind, named)
            self.emit("challenge", pid=pid, offender=ch["from"], guilty=True, bad=len(ch["bad"]), color=ch["color"],
                      count=got, card=kind)
            self.phase = "play"
        else:
            got = self._penalty(pid, kind, named, extra=2)
            self.emit("challenge", pid=pid, offender=ch["from"], guilty=False, bad=0, color=ch["color"],
                      count=got, card=kind)
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
        elif kind in ("draw2", "draw1", "draw5", "wild4", "wild2", "wildcolor"):
            victim = self._next_pid()
            if kind == "wildcolor":
                count = self._draw_until(victim, self.color)
            else:
                count = self._give(victim, {"draw2": 2, "draw1": 1, "draw5": 5, "wild4": 4, "wild2": 2}[kind])
            self.emit("forced_draw", pid=victim, count=count, card=face(card))
            self._advance(1)
        elif kind == "flip":
            self._flip(pid)
            self._advance()
            if self.top["kind"] in self.wilds:
                self.phase = "start_color"      # the finisher's gone, so the next player names it
        elif kind == "custom":
            for p in self.players:
                if p != pid:
                    self._give(p, 2)
            self.emit("custom", pid=pid)
            self._advance()
        else:                                   # numbers, Wild, Skip Everyone, and Swap (an empty hand swaps nothing)
            self._advance()
        self._mark_out(pid)

    def _mark_out(self, pid: str) -> None:
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
            self.flip_pick = False
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
        for p in reversed(self.mercied):
            ranking.append([p])
        if self.left:
            ranking.append(list(self.left))
        details: dict[str, str] = {}
        for i, p in enumerate(self.finished):
            details[p] = f"{ordinal(i + 1)} out · +{self.scores.get(p, 0)} pts"
        for p in self.players:
            n = len(self.hands[p])
            details[p] = f"{n} card{'s' if n != 1 else ''} · {pts[p]} pts left"
        for p in self.mercied:
            details[p] = f"knocked out · {MERCY_LIMIT}+ cards"
        for p in self.left:
            details[p] = "left the table"
        if len(self.seats) - len(self.left) <= 2 and self.finished:
            summary = f"UNO out! {self.scores.get(self.finished[0], 0)} points collected"
        elif self.mercied:
            summary = f"No mercy · {len(self.mercied)} knocked out"
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

    can_stand_in = True

    def _stand_in_color(self, pid: str) -> str:
        counts = {c: 0 for c in self.palette}
        for c in self.hands[pid]:
            if c["color"] in counts:
                counts[c["color"]] += 1
        return max(self.palette, key=lambda c: counts[c])

    def stand_in(self, pid: str) -> bool:
        """Plays a plain, sensible game: calls UNO, accepts challenges, prefers coloured cards to wilds."""
        if self.over or pid not in self.players:
            return False
        if len(self.hands[pid]) == 1 and pid not in self.said_uno:
            self._call_uno(pid)
            return True
        if self.players[self.turn] != pid:
            return False
        others = sorted((p for p in self.players if p != pid), key=lambda p: len(self.hands[p]))
        extra = {"color": self._stand_in_color(pid), "target": others[0] if others else None}
        if self.phase == "stack":
            ok = sorted((c for c in self.hands[pid] if self.playable(c)), key=lambda c: DRAW_VALUE[c["kind"]])
            if ok:
                self.handle(pid, {"type": "play", "card": ok[0]["id"], **extra})
            else:
                self.handle(pid, {"type": "draw"})
        elif self.phase == "roulette":
            self.handle(pid, {"type": "roulette", **extra})
        elif self.phase == "challenge":
            self.handle(pid, {"type": "accept"})
        elif self.phase == "start_color":
            self.handle(pid, {"type": "start_color", **extra})
        elif self.phase == "drawn":
            card = next((c for c in self.hands[pid] if c["id"] == self.drawn_id), None)
            if card and self.playable(card):
                self.handle(pid, {"type": "play", "card": card["id"], **extra})
            else:
                self.handle(pid, {"type": "pass"})
        else:
            ok = [c for c in self.hands[pid] if self.playable(c)]
            ok.sort(key=lambda c: (c["kind"] in self.wilds, c["kind"] == "number"))
            if ok:
                self.handle(pid, {"type": "play", "card": ok[0]["id"], **extra})
            else:
                self.handle(pid, {"type": "draw"})
        return True

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
            if self.phase in ("play", "stack"):
                playable = [c["id"] for c in me if self.playable(c)]
            elif self.phase == "drawn":
                playable = [self.drawn_id] if self.drawn_id is not None else []
        hidden = self.flip
        pile_back = back(self.draw_pile[-1]) if hidden and self.draw_pile else None
        return {
            "hand": [face(c) for c in me] if me else [],
            "counts": {p: len(h) for p, h in self.hands.items()},
            "top": face(self.top),
            "color": self.color,
            "direction": self.direction,
            "turn": self.players[self.turn],
            "phase": self.phase,
            "drawnId": self.drawn_id if my_turn else None,
            "playable": playable,
            "challenge": ({"from": self.challenge["from"], "victim": self.challenge["victim"],
                           "color": self.challenge["color"], "rule": self.bluff,
                           "kind": self.challenge.get("kind", "wild4"), "named": self.challenge.get("named")}
                          if self.challenge else None),
            "reveal": self.reveal if self.reveal and self.reveal["to"] == pid else None,
            "seats": self.seats,
            "left": self.left,
            "places": {p: i + 1 for i, p in enumerate(self.finished)},
            "saidUno": sorted(self.said_uno),
            "vulnerable": sorted(p for p in self.vulnerable if self._catchable(p)),
            "drawCount": len(self.draw_pile),
            "modern": self.modern,
            "flip": self.flip,
            "mercy": self.mercy,
            "stack": self.stack,
            "stackMin": self.stack_min,
            "mercied": self.mercied,
            "mercyLimit": MERCY_LIMIT,
            "side": "dark" if self.dark else "light",
            "flipPick": self.flip_pick,
            "palette": list(self.palette),
            # Flip: you see the far side of everyone else's cards, and of the top of the draw pile
            "backs": ({p: [back(c) for c in h] for p, h in self.hands.items() if p != pid} if hidden and not self.over else None),
            "pileBack": pile_back,
            "hands": {p: [face(c) for c in h] for p, h in self.hands.items()} if self.over else None,
            "scores": self.scores,
        }
