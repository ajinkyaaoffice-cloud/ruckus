"""Room behaviour: pausing a game when a player drops, and the host's room controls."""
import asyncio
import random
import time

import pytest

from app.games import Game, GameError
from app.games.quickmaths import QuickMaths
from app.rooms import Player, RoomManager


class FakeWS:
    def __init__(self):
        self.sent = []

    async def send_json(self, msg):
        self.sent.append(msg)

    async def close(self):
        pass


class NullStore:
    kind = "null"

    async def save_profile(self, *a):
        pass

    async def record_match(self, *a):
        pass


@pytest.fixture
def wall(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(Game, "wall", staticmethod(lambda: t[0]))
    return t


def test_pause_freezes_game_time(wall):
    g = QuickMaths(["a", "b"], rng=random.Random(2))
    wall[0] += 4.0
    g.update()
    assert g.phase == "play"
    left = g.deadline - g.now()
    g.pause()
    wall[0] += 30.0                     # far past the question's time limit
    g.update()
    assert g.phase == "play" and g.deadline - g.now() == pytest.approx(left)
    g.resume()
    wall[0] += 1.0
    g.update()
    assert g.phase == "play" and g.deadline - g.now() == pytest.approx(left - 1.0)


def make_room():
    mgr = RoomManager(NullStore())
    room = mgr.create()
    for pid in ("alice", "bobby"):
        p = Player(pid, pid.title(), {}, ws=FakeWS(), status="ready")
        room.add(p)
    return room


def test_drop_pauses_and_return_resumes_after_countdown(wall):
    async def run():
        room = make_room()
        await room.start("alice", "tictactoe", {})
        g = room.game
        bob = room.players["bobby"]
        bob.ws, bob.left_at = None, time.time()
        assert room.dropped("bobby")
        assert g.paused
        info = room.pause_info()
        assert info["waiting"][0]["id"] == "bobby" and info["resumeAt"] is None
        with pytest.raises(GameError):
            await room.act("alice", {"type": "place", "cell": 0})
        # coming back starts a short countdown rather than resuming instantly
        bob.ws = FakeWS()
        assert room.returned("bobby")
        assert g.paused and room.resume_at is not None
        room.resume_at = time.time() - 0.01
        await asyncio.sleep(0.25)          # let the room loop notice
        assert not g.paused
        await room.act(g.view("alice")["turn"], {"type": "place", "cell": 0})
        assert g.board[0] is not None
        room.loop_task.cancel()
    asyncio.run(run())


def test_dropping_for_good_forfeits(wall):
    async def run():
        room = make_room()
        await room.start("alice", "tictactoe", {})
        room.players["bobby"].ws = None
        room.dropped("bobby")
        room.remove("bobby")
        assert room.game.over and room.game.results.winners == ["alice"]
        room.loop_task.cancel()
    asyncio.run(run())


def test_opener_rotates_round_the_table():
    async def run():
        room = make_room()
        cara = Player("cara", "Cara", {}, ws=FakeWS(), status="ready")
        room.add(cara)
        for i, p in enumerate(("alice", "bobby", "cara")):
            room.players[p].joined = 100.0 + i
        openers = []
        for _ in range(6):
            await room.start("alice", "uno", {})
            g = room.game
            openers.append(g.players[(g.dealer + 1) % len(g.players)])
            g.over = True
            room.loop_task.cancel()
        # one full lap from wherever it started, then the same lap again
        assert sorted(openers[:3]) == ["alice", "bobby", "cara"] and openers[:3] == openers[3:]
    asyncio.run(run())


def test_only_host_changes_settings_and_values_are_checked():
    room = make_room()
    with pytest.raises(GameError):
        room.configure("bobby", {"locked": True})
    room.configure("alice", {"locked": True, "maxPlayers": 3, "grace": 120, "emotes": False})
    assert room.settings["locked"] and room.settings["maxPlayers"] == 3 and room.grace == 120.0
    assert room.public()["settings"]["emotes"] is False
    for bad in ({"maxPlayers": 9}, {"maxPlayers": True}, {"grace": 7}, {"locked": "yes"}, {"nope": 1}):
        with pytest.raises(GameError):
            room.configure("alice", bad)
    assert room.settings["maxPlayers"] == 3          # a rejected patch changes nothing


def test_lock_and_size_keep_newcomers_out():
    room = make_room()
    room.can_join("carol")
    room.configure("alice", {"maxPlayers": 2})
    with pytest.raises(GameError, match="full"):
        room.can_join("carol")
    room.configure("alice", {"maxPlayers": 5, "locked": True})
    with pytest.raises(GameError, match="locked"):
        room.can_join("carol")


def test_kick_bans_until_let_back_and_host_can_hand_over():
    room = make_room()
    with pytest.raises(GameError):
        room.kick("bobby", "alice")
    with pytest.raises(GameError):
        room.kick("alice", "alice")
    room.kick("alice", "bobby")
    assert "bobby" not in room.players and room.public()["banned"] == [{"id": "bobby", "name": "Bobby"}]
    with pytest.raises(GameError, match="removed"):
        room.can_join("bobby")
    room.unban_all("alice")
    room.can_join("bobby")
    room.add(Player("bobby", "Bobby", {}, ws=FakeWS()))
    room.make_host("alice", "bobby")
    assert room.host == "bobby"
    with pytest.raises(GameError):
        room.configure("alice", {"locked": True})


def test_anyone_picks_and_reset_scores():
    async def run():
        room = make_room()
        for p in room.players.values():
            p.status = "ready"
        with pytest.raises(GameError, match="host"):
            await room.start("bobby", "quickmaths", {})
        room.configure("alice", {"anyonePicks": True})
        await room.start("bobby", "quickmaths", {})
        assert room.phase == "playing"
        room.players["alice"].points = 6
        room.history.append({"game": "x"})
        room.reset_scores("alice")
        assert room.players["alice"].points == 0 and room.history == []
        if room.loop_task:
            room.loop_task.cancel()
    asyncio.run(run())


def test_no_pause_on_drop_when_switched_off():
    async def run():
        room = make_room()
        for p in room.players.values():
            p.status = "ready"
        await room.start("alice", "quickmaths", {})
        assert room.dropped("bobby") and room.game.paused
        room.configure("alice", {"pauseOnDrop": False})
        assert not room.waiting and room.resume_at is not None
        room.returned("bobby")
        assert not room.dropped("bobby")
        room.loop_task.cancel()
    asyncio.run(run())


def test_host_pause_holds_until_host_resumes(wall):
    async def run():
        room = make_room()
        await room.start("alice", "tictactoe", {})
        g = room.game
        with pytest.raises(GameError):
            room.hold("bobby")
        room.hold("alice")
        assert g.paused and room.pause_info()["held"] == "alice"
        with pytest.raises(GameError, match="host paused"):
            await room.act("alice", {"cell": 0})
        # a drop and return mid-hold must not sneak the game back on
        room.dropped("bobby")
        room.returned("bobby")
        assert room.resume_at is None and g.paused
        with pytest.raises(GameError):
            room.unhold("bobby")
        room.unhold("alice")
        assert room.held is None and room.resume_at is not None
        room.loop_task.cancel()
    asyncio.run(run())


def test_host_ends_game_without_scoring():
    async def run():
        room = make_room()
        await room.start("alice", "tictactoe", {})
        with pytest.raises(GameError):
            room.end_game("bobby")
        room.end_game("alice")
        assert room.game is None and room.phase == "lobby" and room.history == []
        assert all(p.points == 0 and p.played == 0 for p in room.players.values())
        with pytest.raises(GameError):
            room.end_game("alice")
    asyncio.run(run())
