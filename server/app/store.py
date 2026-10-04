"""Persistence for profiles, match history and the all-time leaderboard.

If SUPABASE_URL and SUPABASE_SERVICE_KEY are set, everything goes to Supabase
through its PostgREST API (schema in /supabase/schema.sql). Otherwise a local
SQLite file is used so the game works with zero setup.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any, Protocol

import httpx

log = logging.getLogger("ruckus.store")


class Store(Protocol):
    kind: str

    async def save_profile(self, pid: str, name: str, avatar: dict[str, Any]) -> None: ...
    async def record_match(self, room: str, game: str, players: list[dict[str, Any]],
                           results: dict[str, Any], awards: dict[str, dict[str, int]]) -> None: ...
    async def leaderboard(self, limit: int = 10) -> list[dict[str, Any]]: ...


class SupabaseStore:
    kind = "supabase"

    def __init__(self, url: str, key: str) -> None:
        self.base = url.rstrip("/") + "/rest/v1"
        self.client = httpx.AsyncClient(timeout=6.0, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})

    async def save_profile(self, pid, name, avatar):
        r = await self.client.post(f"{self.base}/players", params={"on_conflict": "id"},
                                   headers={"Prefer": "resolution=merge-duplicates"},
                                   json={"id": pid, "name": name, "avatar": avatar})
        r.raise_for_status()

    async def record_match(self, room, game, players, results, awards):
        r = await self.client.post(f"{self.base}/matches", json={
            "room_code": room, "game": game, "players": players, "results": results})
        r.raise_for_status()
        for p in players:
            a = awards.get(p["id"], {})
            r = await self.client.post(f"{self.base}/rpc/record_result", json={
                "p_id": p["id"], "p_name": p["name"], "p_avatar": p.get("avatar") or {},
                "p_win": a.get("win", 0), "p_points": a.get("points", 0)})
            r.raise_for_status()

    async def leaderboard(self, limit=10):
        r = await self.client.get(f"{self.base}/players", params={
            "select": "id,name,avatar,wins,games,points", "order": "points.desc,wins.desc",
            "games": "gt.0", "limit": str(limit)})
        r.raise_for_status()
        return r.json()


class SqliteStore:
    kind = "sqlite"

    def __init__(self, path: Path) -> None:
        self.path = path
        with self._db() as db:
            db.executescript("""
            create table if not exists players (
              id text primary key, name text, avatar text,
              wins integer default 0, games integer default 0, points integer default 0);
            create table if not exists matches (
              id integer primary key autoincrement, room_code text, game text,
              players text, results text, created_at text default current_timestamp);
            """)

    def _db(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        return db

    def _upsert(self, db: sqlite3.Connection, pid: str, name: str, avatar: Any) -> None:
        db.execute("""insert into players (id, name, avatar) values (?, ?, ?)
                      on conflict(id) do update set name=excluded.name, avatar=excluded.avatar""",
                   (pid, name, json.dumps(avatar or {})))

    async def save_profile(self, pid, name, avatar):
        def run() -> None:
            with self._db() as db:
                self._upsert(db, pid, name, avatar)
        await asyncio.to_thread(run)

    async def record_match(self, room, game, players, results, awards):
        def run() -> None:
            with self._db() as db:
                db.execute("insert into matches (room_code, game, players, results) values (?, ?, ?, ?)",
                           (room, game, json.dumps(players), json.dumps(results)))
                for p in players:
                    a = awards.get(p["id"], {})
                    self._upsert(db, p["id"], p["name"], p.get("avatar"))
                    db.execute("update players set wins=wins+?, games=games+1, points=points+? where id=?",
                               (a.get("win", 0), a.get("points", 0), p["id"]))
        await asyncio.to_thread(run)

    async def leaderboard(self, limit=10):
        def run() -> list[dict[str, Any]]:
            with self._db() as db:
                rows = db.execute("""select id, name, avatar, wins, games, points from players
                                     where games > 0 order by points desc, wins desc limit ?""",
                                  (limit,)).fetchall()
            return [{**dict(r), "avatar": json.loads(r["avatar"] or "{}")} for r in rows]
        return await asyncio.to_thread(run)


def make_store() -> Store:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if url and key:
        log.info("Persistence: Supabase at %s", url)
        return SupabaseStore(url, key)
    path = Path(os.getenv("RUCKUS_DB", Path(__file__).resolve().parent.parent / "ruckus.db"))
    log.info("Persistence: SQLite at %s (set SUPABASE_URL/SUPABASE_SERVICE_KEY for Supabase)", path)
    return SqliteStore(path)
