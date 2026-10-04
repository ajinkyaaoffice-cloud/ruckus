"""Tiny test opponent: joins a room over the websocket and plays whatever game starts.

    server/.venv/bin/python scripts/bot.py ROOMCODE [name]
"""
import asyncio, json, random, sys, uuid
import websockets

URL = "ws://localhost:8000/ws"


async def main(code: str, name: str) -> None:
    pid = uuid.uuid4().hex[:16]
    async with websockets.connect(URL) as ws:
        send = lambda m: ws.send(json.dumps(m))
        await send({"t": "hello", "pid": pid, "name": name, "avatar": {}})
        await send({"t": "join", "code": code})
        await send({"t": "profile", "name": name, "avatar": {}, "ready": True})
        last_act = 0.0
        loop = asyncio.get_event_loop()
        async for raw in ws:
            m = json.loads(raw)
            if m["t"] == "error":
                print("error:", m["msg"])
            if m["t"] != "game":
                continue
            s = m["state"]
            g = s.get("id") or s.get("game")
            now = loop.time()
            if s.get("over"):
                continue
            if "ball" in s:                       # pong: chase the ball, a bit lazily
                if now - last_act > 0.05:
                    await send({"t": "act", "action": {"type": "move", "x": s["ball"]["x"] + random.uniform(-0.06, 0.06)}})
                    last_act = now
                continue
            if "hand" in s:                       # uno
                if s.get("vulnerable"):
                    for v in s["vulnerable"]:
                        if v != pid and random.random() < 0.5:
                            await send({"t": "act", "action": {"type": "catch", "target": v}})
                if len(s["hand"]) <= 2 and pid not in s["saidUno"] and random.random() < 0.6:
                    await send({"t": "act", "action": {"type": "uno"}})
                if s["turn"] != pid:
                    continue
                await asyncio.sleep(0.9)
                others = [p for p in s["players"] if p != pid]
                if s["phase"] == "start_color":
                    await send({"t": "act", "action": {"type": "start_color", "color": random.choice(["red", "yellow", "green", "blue"]), "target": others[0]}})
                elif s["phase"] == "challenge":
                    await send({"t": "act", "action": {"type": random.choice(["accept", "challenge"])}})
                elif s["playable"]:
                    await send({"t": "act", "action": {"type": "play", "card": random.choice(s["playable"]),
                                                      "color": random.choice(["red", "yellow", "green", "blue"]), "target": others[0]}})
                elif s["phase"] == "drawn":
                    await send({"t": "act", "action": {"type": "pass"}})
                else:
                    await send({"t": "act", "action": {"type": "draw"}})
                continue
            if "board" in s and s.get("turn") == pid:   # tictactoe / connect4
                await asyncio.sleep(0.6)
                b = s["board"]
                if isinstance(b[0], list):              # connect4 columns
                    await send({"t": "act", "action": {"type": "drop", "col": random.randrange(len(b[0]))}})
                else:
                    free = [i for i, c in enumerate(b) if not c]
                    await send({"t": "act", "action": {"type": "place", "cell": random.choice(free)}})


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Botty"))
