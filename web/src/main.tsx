import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { connect } from './lib/net'

connect()

// No StrictMode: its dev-only double effect run reverts and replays the gsap
// intros mid-CSS-transition, which freezes `from()` tweens at their start.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
