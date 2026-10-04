import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { TransitionProvider } from './components/Transition'
import Cursor from './components/Cursor'
import { isTouch } from './lib/perf'
import Menu from './components/Menu'
import ContextMenu from './components/ContextMenu'
import { Toasts } from './components/Chrome'
import Landing from './pages/Landing'
import LobbyZone from './pages/LobbyZone'
import JoinLink from './pages/JoinLink'
import Customize from './pages/Customize'
import Hub from './pages/Hub'
import RoomGuard from './pages/RoomGuard'

const GameScreen = lazy(() => import('./pages/GameScreen'))

export default function App() {
  return (
    <TransitionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play" element={<LobbyZone />} />
        <Route path="/join/:code" element={<JoinLink />} />
        <Route path="/room/:code" element={<RoomGuard />}>
          <Route index element={<Hub />} />
          <Route path="avatar" element={<Customize />} />
          <Route path="play" element={<Suspense fallback={null}><GameScreen /></Suspense>} />
        </Route>
        <Route path="*" element={<LobbyZone />} />
      </Routes>
      <Menu />
      <ContextMenu />
      <Toasts />
      {!isTouch && <Cursor />}
    </TransitionProvider>
  )
}
