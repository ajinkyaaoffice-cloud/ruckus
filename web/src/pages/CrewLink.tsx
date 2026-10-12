import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { entryLabel, entryPath, joinCrew, useNet } from '../lib/net'
import { crewSlug, saveCrew } from '../lib/crew'
import { useTransition } from '../components/Transition'
import Glyph from '../components/Glyph'
import { toast } from '../lib/toast'
import './RoomGuard.css'

/** /c/NAME: the crew's standing room. Opens it if nobody's there yet, then straight in, ready. */
export default function CrewLink() {
  const name = crewSlug(useParams().name ?? '')
  const status = useNet((s) => s.status)
  const { go } = useTransition()
  // once only: a second run (StrictMode, a status blip) would start a second wipe
  const started = useRef(false)

  useEffect(() => {
    if (status !== 'open' || started.current) return
    started.current = true
    void go(async () => {
      try {
        const code = await joinCrew(name)
        saveCrew(code)
        return entryPath(code)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not open that crew')
        return '/play'
      }
    }, { label: entryLabel(), replace: true })
  }, [status, name, go])

  return (
    <div className="guard">
      <div className="guard-spin"><Glyph name="x" color="#fff" size={90} /><Glyph name="o" color="#e64fe0" size={90} /></div>
      <p className="display">Gathering {name}…</p>
    </div>
  )
}
