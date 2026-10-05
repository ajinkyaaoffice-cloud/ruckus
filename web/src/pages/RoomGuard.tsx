import { useEffect, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { joinRoom, useNet } from '../lib/net'
import { useTransition } from '../components/Transition'
import { gameMeta } from '../lib/catalog'
import Glyph from '../components/Glyph'
import { EmoteLayer } from '../components/Players'
import './RoomGuard.css'

/**
 * Keeps this client inside the room named in the URL and steers everyone to
 * the same screen: when the host starts a game every ready player is swept to
 * the game page, and back to the hub when the host returns to the lobby.
 */
export default function RoomGuard() {
  const code = (useParams().code ?? '').toUpperCase()
  const room = useNet((s) => s.room)
  const status = useNet((s) => s.status)
  const pid = useNet((s) => s.profile.pid)
  const { pathname } = useLocation()
  const { go, busy } = useTransition()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (status !== 'open' || room?.code === code) return
    let cancelled = false
    const t = setTimeout(async () => {
      if (cancelled || useNet.getState().room?.code === code) return
      try {
        await joinRoom(code)
      } catch {
        if (!cancelled) go('/play', { label: 'OOPS', reverse: true, replace: true })
      }
    }, 450)
    return () => { cancelled = true; clearTimeout(t) }
  }, [status, room?.code, code, go])

  const me = room?.players.find((p) => p.id === pid)
  const onPlay = pathname.endsWith('/play')
  const onAvatar = pathname.endsWith('/avatar')
  let want: string | null = null
  let label = ''
  if (room && room.code === code) {
    if (room.phase === 'playing' && !onPlay && !onAvatar && me?.status === 'ready') {
      want = `/room/${code}/play`
      label = gameMeta(room.game?.id)?.name ?? "LET'S GO"
    } else if (room.phase === 'lobby' && onPlay) {
      want = `/room/${code}`
      label = 'LOBBY'
    }
  }

  useEffect(() => {
    if (!want) return
    if (busy()) {
      const t = setTimeout(() => setTick((x) => x + 1), 250)
      return () => clearTimeout(t)
    }
    void go(want, { label, reverse: label === 'LOBBY', colors: label === 'LOBBY' ? ['#1d3a6e', '#e64fe0', '#a596ff'] : undefined })
  }, [want, label, go, busy, tick])

  if (!room || room.code !== code) {
    return (
      <div className="guard">
        <div className="guard-spin"><Glyph name="x" color="#fff" size={90} /><Glyph name="o" color="#e64fe0" size={90} /></div>
        <p className="display">Joining room {code}…</p>
      </div>
    )
  }
  return (
    <>
      <Outlet />
      <EmoteLayer />
    </>
  )
}
