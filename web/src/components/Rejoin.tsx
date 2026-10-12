import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useNet } from '../lib/net'
import { useTransition } from './Transition'
import { toast } from '../lib/toast'

/**
 * Opening the site while the server still holds your seat (a closed tab, a
 * dead battery, a mistaken back-swipe) takes you straight back to your room;
 * the room guard then carries you on into the game if one is running.
 */
export default function Rejoin() {
  const code = useNet((s) => s.rejoin)
  const { pathname } = useLocation()
  const { go } = useTransition()
  useEffect(() => {
    if (!code) return
    useNet.setState({ rejoin: null })
    if (pathname.startsWith('/room/') || pathname.startsWith('/join/')) return
    toast.success(`Welcome back! Taking you to room ${code}`, { id: 'rejoin' })
    void go(`/room/${code}`, { label: 'WELCOME BACK!', replace: true })
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
