"""Room behaviour: pausing a game when a player drops, and the shared music state."""
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


def test_music_ops_and_next_dedupe():
    room = make_room()
    assert room.music_op("alice", {"op": "select", "track": "ekr2nIex040"})
    m = room.music
    assert m["playing"] and m["track"] == "ekr2nIex040" and m["by"] == "Alice"
    room.music_op("alice", {"op": "seek", "pos": 42})
    assert room.music_pos() == pytest.approx(42, abs=0.2)
    room.music_op("bobby", {"op": "pause"})
    assert not m["playing"]
    room.music_op("bobby", {"op": "vol", "vol": 150})
    assert m["vol"] == 100
    # two players both report the song ended: only the first advances
    assert room.music_op("alice", {"op": "next", "from": "ekr2nIex040", "track": "TUVcZfQe-Kw"})
    assert not room.music_op("bobby", {"op": "next", "from": "ekr2nIex040", "track": "oygrmJFKYZY"})
    assert m["track"] == "TUVcZfQe-Kw"
    with pytest.raises(GameError):
        room.music_op("alice", {"op": "select", "track": "<script>"})
