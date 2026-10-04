import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { checkRoom, joinRoom, useNet } from '../lib/net'
import { useTransition } from '../components/Transition'
import Glyph from '../components/Glyph'
import './RoomGuard.css'
import { toast } from '../lib/toast'

/** Landing spot for QR / shared links: /join/ABCD → join, then off to dress up. */
export default function JoinLink() {
  const code = (useParams().code ?? '').toUpperCase()
  const status = useNet((s) => s.status)
  const { go } = useTransition()

  useEffect(() => {
    if (status !== 'open') return
    let cancelled = false
    ;(async () => {
      const info = await checkRoom(code)
      if (cancelled) return
      if (!info.exists || info.full) {
        toast.error(info.exists ? 'That room is full (5 max)' : `No room called ${code}`)
        go('/play', { label: 'OOPS', replace: true })
        return
      }
      try {
        await joinRoom(code)
        if (!cancelled) go(`/room/${code}/avatar`, { label: 'DRESS UP!', replace: true })
      } catch {
        if (!cancelled) go('/play', { label: 'OOPS', replace: true })
      }
    })()
    return () => { cancelled = true }
  }, [status, code, go])

  return (
    <div className="guard">
      <div className="guard-spin"><Glyph name="x" color="#fff" size={90} /><Glyph name="o" color="#e64fe0" size={90} /></div>
      <p className="display">Hopping into {code}…</p>
    </div>
  )
}
