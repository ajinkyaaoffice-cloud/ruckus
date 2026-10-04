import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import { BrushMarks, TopBar } from '../components/Chrome'
import { EmoteBar, EmoteLayer, PlayerChip } from '../components/Players'
import Results from '../components/Results'
import { useTransition } from '../components/Transition'
import { gameMeta } from '../lib/catalog'
import { leaveRoom, useNet, type GameState, type Room, type RoomPlayer } from '../lib/net'
import { sfx } from '../lib/sound'
import './GameScreen.css'

export type GameProps = { state: GameState; me: string; room: Room; players: RoomPlayer[]; spectator: boolean }

const GAMES: Record<string, ComponentType<GameProps>> = {
  tictactoe: lazy(() => import('../games/TicTacToe')),
  connect4: lazy(() => import('../games/ConnectFour')),
  uno: lazy(() => import('../games/Uno')),
  pong: lazy(() => import('../games/Pong')),
  dots: lazy(() => import('../games/Dots')),
  memory: lazy(() => import('../games/Memory')),
  oddone: lazy(() => import('../games/OddOne')),
  echo: lazy(() => import('../games/Echo')),
}
const Rulebook = lazy(() => import('../components/Rulebook'))

export default function GameScreen() {
  const root = useRef<HTMLDivElement>(null)
  const room = useNet((s) => s.room)!
  const state = useNet((s) => s.game)
  const me = useNet((s) => s.profile.pid)
  const { go } = useTransition()
  const [rules, setRules] = useState(false)
  const gid = state?.game ?? room.game?.id
  const meta = gameMeta(gid)
  const Game = gid ? GAMES[gid] : undefined
  const participants = (state?.players ?? room.game?.participants ?? [])
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean) as RoomPlayer[]
  const spectator = !participants.some((p) => p.id === me)
  const turn: string | undefined = state && !state.over ? state.turn : undefined

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.gs-top-players > *', ...intro({ y: -100, rotate: (i: number) => (i % 2 ? 15 : -15), duration: 0.6, ease: 'back.out(2)', stagger: 0.08, delay: 0.4 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (state?.over && state.results) {
      if (state.results.winners.includes(me)) sfx.win()
      else if (!spectator) sfx.lose()
    }
  }, [state?.over]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => {
    if (!confirm('Leave the room? You will forfeit this game.')) return
    leaveRoom()
    go('/play', { label: 'BYE!', reverse: true })
  }

  return (
    <div ref={root} className={`gs gs-${gid}`} style={{ ['--gbg' as string]: meta?.bg ?? '#f6b8f7' }}>
      <BrushMarks opacity={0.18} />
      <EmoteLayer />
      <TopBar
        left={<span className="gs-name display">{meta?.name ?? 'Game'}</span>}
        right={
          <>
            {meta && (
              <button className="icon-btn gs-help" onClick={() => { sfx.click(); setRules(true) }} aria-label="How to play" data-cursor="RULES">
                <span className="display">?</span>
              </button>
            )}
            <button className="bubble-btn small navy" onClick={leave}>Leave</button>
          </>
        }
      />
      <div className="gs-top-players">
        {participants.map((p) => (
          <PlayerChip key={p.id} p={p} index={room.players.findIndex((x) => x.id === p.id)} compact active={turn === p.id}
            host={room.host === p.id}
            expression={state?.over ? (state.results?.winners.includes(p.id) ? 'happy' : 'sad') : turn === p.id ? 'focus' : 'idle'} />
        ))}
      </div>
      {spectator && <div className="gs-spec display">Spectating · you're up next game</div>}

      <main className="gs-stage">
        {state && Game && state.game === gid ? (
          <Suspense fallback={null}>
            <Game key={state.instance} state={state} me={me} room={room} players={participants} spectator={spectator} />
          </Suspense>
        ) : null}
      </main>

      <div className="gs-dock"><EmoteBar compact /></div>

      <Intro key={state?.instance ?? 'none'} />

      {rules && meta && <Suspense fallback={null}><Rulebook g={meta} onClose={() => setRules(false)} /></Suspense>}
      {state?.over && state.results && <Results state={state} room={room} me={me} />}
    </div>
  )
}

/** "READY? → GO!" slam that plays at the start of every game (and every rematch). */
function Intro() {
  const ref = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ delay: 0.25, onComplete: () => setDone(true) })
        .fromTo('.w1', { scale: 0, rotate: -30 }, { scale: 1, rotate: -6, duration: 0.45, ease: 'back.out(3)', onStart: () => sfx.slam() })
        .to('.w1', { scale: 0, rotate: 20, duration: 0.25, ease: 'back.in(2)' }, '+=0.35')
        .fromTo('.w2', { scale: 0, rotate: 30 }, { scale: 1.1, rotate: 4, duration: 0.4, ease: 'back.out(3)', onStart: () => sfx.slam() })
        .to('.w2', { scale: 4, opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.25')
      gsap.fromTo(document.querySelector('.gs-stage'), ...intro({ scale: 0.85, rotate: -2, duration: 0.9, ease: 'elastic.out(1, 0.6)', delay: 0.6 }))
    }, ref)
    return () => ctx.revert()
  }, [])
  if (done) return null
  return (
    <div ref={ref} className="gs-intro display" aria-hidden>
      <span className="w1">Ready?</span>
      <span className="w2">Go!</span>
    </div>
  )
}
