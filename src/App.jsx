import { useState, useEffect, useRef } from 'react'
import COUNTRIES from './countries.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDailyCountry(dateStr) {
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return COUNTRIES[h % COUNTRIES.length]
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
}

function getTimeToMidnight() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight - now
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

const STORAGE_KEY = 'bandiera_daily_v1'
const THEME_KEY = 'bandiera_theme'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

// ── main component ────────────────────────────────────────────────────────────

export default function App() {
  const todayStr = getTodayStr()
  const daily = getDailyCountry(todayStr)

  const initState = () => {
    const saved = loadState()
    if (saved.today === todayStr) return saved
    return { today: todayStr, guesses: [], done: false, won: false, archive: saved.archive || [] }
  }

  const [state, setState] = useState(initState)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [tab, setTab] = useState('game') // 'game' | 'stats' | 'archive' | 'howto'
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'auto')
  const [countdown, setCountdown] = useState(getTimeToMidnight())
  const inputRef = useRef(null)
  const acRef = useRef(null)

  useEffect(() => { saveState(state) }, [state])

  useEffect(() => {
    const id = setInterval(() => setCountdown(getTimeToMidnight()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }, [theme])

  useEffect(() => {
    const val = input.trim().toLowerCase()
    if (!val) { setSuggestions([]); return }
    const filtered = COUNTRIES
      .filter(c => c.name.toLowerCase().startsWith(val) || c.name.toLowerCase().includes(val))
      .slice(0, 8)
    setSuggestions(filtered)
    setActiveIdx(-1)
  }, [input])

  useEffect(() => {
    const handleClick = (e) => {
      if (acRef.current && !acRef.current.contains(e.target) && e.target !== inputRef.current)
        setSuggestions([])
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function submitGuess(country) {
    if (state.done) return
    if (state.guesses.find(g => g.code === country.code)) return
    const newGuesses = [...state.guesses, { name: country.name, code: country.code }]
    const won = country.code === daily.code
    const done = won || newGuesses.length >= 6
    const newArchive = [...(state.archive || [])]
    if (done && !newArchive.find(a => a.date === todayStr))
      newArchive.push({ date: todayStr, code: daily.code, name: daily.name, won, att: newGuesses.length })
    setState(s => ({ ...s, guesses: newGuesses, done, won, archive: newArchive }))
    setInput('')
    setSuggestions([])
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i+1, suggestions.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i-1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) { submitGuess(suggestions[activeIdx]); return }
      if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
      const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
      if (exact) submitGuess(exact)
    } else if (e.key === 'Escape') { setSuggestions([]); setActiveIdx(-1) }
  }

  function handleConfirm() {
    if (activeIdx >= 0 && suggestions[activeIdx]) { submitGuess(suggestions[activeIdx]); return }
    if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
    const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
    if (exact) submitGuess(exact)
  }

  const arch = state.archive || []
  const wins = arch.filter(a => a.won).length
  const total = arch.length
  let streak = 0
  for (let i = arch.length-1; i >= 0; i--) { if (arch[i].won) streak++; else break }
  let maxStreak = 0, cur = 0
  arch.forEach(a => { if (a.won) { cur++; if (cur > maxStreak) maxStreak = cur } else cur = 0 })

  // dist 1-6
  const dist = [0,0,0,0,0,0]
  arch.filter(a => a.won).forEach(a => { if (a.att >= 1 && a.att <= 6) dist[a.att-1]++ })
  const distMax = Math.max(...dist, 1)

  // ── theme vars ──
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const C = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    bgSecondary: isDark ? '#242424' : '#f5f5f3',
    bgSuccess: isDark ? '#173404' : '#eaf3de',
    bgDanger: isDark ? '#3b1010' : '#fceaea',
    text: isDark ? '#f0f0f0' : '#1a1a1a',
    textSecondary: isDark ? '#a0a0a0' : '#6b6b6b',
    textTertiary: isDark ? '#666' : '#9e9e9e',
    textSuccess: isDark ? '#c0dd97' : '#3b6d11',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    borderSecondary: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)',
    borderSuccess: isDark ? '#3b6d11' : '#97c459',
    accent: isDark ? '#c0dd97' : '#3b6d11',
  }

  const tabItems = [
    { id: 'game', label: '🚩 Gioca' },
    { id: 'stats', label: '📊 Statistiche' },
    { id: 'archive', label: '📅 Archivio' },
    { id: 'howto', label: '❓ Come si gioca' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', transition: 'background 0.2s, color 0.2s' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 1rem 3rem' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0 0.75rem', borderBottom: `0.5px solid ${C.border}` }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, margin: 0, color: C.text }}>Indovina la Bandiera</h1>
            <p style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{formatDate(todayStr)}</p>
          </div>
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'auto' : 'dark')}
            title={`Tema: ${theme}`}
            style={{ background: 'none', border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 16, cursor: 'pointer', color: C.textSecondary }}
          >
            {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🌗'}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 2, marginTop: '0.75rem', borderBottom: `0.5px solid ${C.border}` }}>
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: tab === t.id ? 500 : 400,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.id ? C.text : C.textTertiary,
                borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════ TAB: GIOCA ══════════ */}
        {tab === 'game' && (
          <div style={{ paddingTop: '1.25rem' }}>

            {/* Flag */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: 220, height: 147, borderRadius: 8, overflow: 'hidden', border: `0.5px solid ${C.border}`, background: C.bgSecondary }}>
                <span className={`fi fi-${daily.code}`} style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'block' }} />
              </div>
              <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 8, letterSpacing: '0.5px' }}>
                {state.done ? (state.won ? '✓ Indovinato!' : 'Fine tentativi') : `Tentativo ${state.guesses.length+1} di 6`}
              </div>
            </div>

            {/* Guesses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
              {state.guesses.map((g, i) => {
                const ok = g.code === daily.code
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, border: `0.5px solid ${ok ? C.borderSuccess : C.border}`, background: ok ? C.bgSuccess : C.bgSecondary, color: ok ? C.textSuccess : C.textSecondary }}>
                    <span className={`fi fi-${g.code}`} style={{ width: 26, height: 18, borderRadius: 2, flexShrink: 0, backgroundSize: 'cover', backgroundPosition: 'center', border: `0.5px solid ${C.border}`, display: 'inline-block' }} />
                    <span>{g.name}</span>
                    <span style={{ marginLeft: 'auto' }}>{ok ? '✓' : '✗'}</span>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            {!state.done && (
              <>
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi il nome del paese..."
                    autoComplete="off"
                    style={{ width: '100%', fontSize: 15, padding: '10px 14px', borderRadius: 8, border: `0.5px solid ${C.borderSecondary}`, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {suggestions.length > 0 && (
                    <div ref={acRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: C.bg, border: `0.5px solid ${C.borderSecondary}`, borderRadius: 8, zIndex: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                      {suggestions.map((c, i) => (
                        <div key={c.code} onMouseDown={e => { e.preventDefault(); submitGuess(c) }}
                          style={{ padding: '9px 14px', fontSize: 14, cursor: 'pointer', color: C.text, background: i === activeIdx ? C.bgSecondary : 'transparent', borderBottom: `0.5px solid ${C.border}` }}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleConfirm} style={{ width: '100%', padding: 10, fontSize: 15, fontWeight: 500, borderRadius: 8, border: `0.5px solid ${C.borderSecondary}`, background: C.bg, color: C.text, cursor: 'pointer' }}>
                  Conferma
                </button>
              </>
            )}

            {/* Result + countdown */}
            {state.done && (
              <div style={{ textAlign: 'center', padding: '1.25rem', borderRadius: 12, border: `0.5px solid ${C.border}`, background: C.bgSecondary, marginTop: '0.5rem' }}>
                <div style={{ fontSize: 20, fontWeight: 500 }}>{state.won ? 'Indovinato! 🎉' : 'Non ci sei arrivato'}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
                  {state.won ? `In ${state.guesses.length} tentativ${state.guesses.length === 1 ? 'o' : 'i'}` : 'La risposta era:'}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', fontSize: 15, fontWeight: 500 }}>
                  <span className={`fi fi-${daily.code}`} style={{ width: 32, height: 22, borderRadius: 3, backgroundSize: 'cover', backgroundPosition: 'center', border: `0.5px solid ${C.border}`, display: 'inline-block' }} />
                  <span>{daily.name}</span>
                </div>
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `0.5px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textTertiary, letterSpacing: '0.5px', marginBottom: 4 }}>PROSSIMA BANDIERA TRA</div>
                  <div style={{ fontSize: 28, fontWeight: 500, fontFamily: 'monospace', color: C.text, letterSpacing: 2 }}>{countdown}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ TAB: STATISTICHE ══════════ */}
        {tab === 'stats' && (
          <div style={{ paddingTop: '1.25rem' }}>
            {total === 0 ? (
              <p style={{ textAlign: 'center', color: C.textTertiary, marginTop: '2rem', fontSize: 14 }}>Nessuna partita ancora giocata.</p>
            ) : (
              <>
                {/* Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.5rem' }}>
                  {[
                    { n: total, l: 'Partite' },
                    { n: Math.round(wins/total*100)+'%', l: 'Vittorie' },
                    { n: streak, l: 'Serie att.' },
                    { n: maxStreak, l: 'Serie max' },
                  ].map(({ n, l }) => (
                    <div key={l} style={{ textAlign: 'center', padding: '12px 4px', background: C.bgSecondary, borderRadius: 8, border: `0.5px solid ${C.border}` }}>
                      <div style={{ fontSize: 22, fontWeight: 500, color: C.text }}>{n}</div>
                      <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Distribuzione */}
                <div style={{ fontSize: 12, fontWeight: 500, color: C.textSecondary, marginBottom: 10, letterSpacing: '0.5px' }}>DISTRIBUZIONE TENTATIVI</div>
                {dist.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: C.textSecondary, width: 12, textAlign: 'right', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ flex: 1, height: 24, background: C.bgSecondary, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(v/distMax*100, v > 0 ? 8 : 0)}%`, background: C.accent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, transition: 'width 0.4s' }}>
                        {v > 0 && <span style={{ fontSize: 11, color: C.bg, fontWeight: 500 }}>{v}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══════════ TAB: ARCHIVIO ══════════ */}
        {tab === 'archive' && (
          <div style={{ paddingTop: '1.25rem' }}>
            {arch.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textTertiary, marginTop: '2rem', fontSize: 14 }}>Nessuna partita ancora in archivio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...arch].reverse().map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${a.won ? C.borderSuccess : C.border}`, background: a.won ? C.bgSuccess : C.bgSecondary }}>
                    <span className={`fi fi-${a.code}`} style={{ width: 28, height: 19, borderRadius: 2, backgroundSize: 'cover', backgroundPosition: 'center', border: `0.5px solid ${C.border}`, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: a.won ? C.textSuccess : C.textSecondary }}>{a.name}</span>
                    <span style={{ fontSize: 12, color: C.textTertiary }}>{formatDate(a.date)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: a.won ? C.textSuccess : C.textTertiary, minWidth: 24, textAlign: 'right' }}>{a.won ? `${a.att}/6` : '✗'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ TAB: COME SI GIOCA ══════════ */}
        {tab === 'howto' && (
          <div style={{ paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              <div style={{ padding: '1rem 1.25rem', borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgSecondary }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>🚩 Obiettivo</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  Indovina il paese a cui appartiene la bandiera mostrata. Hai <strong style={{ color: C.text }}>6 tentativi</strong> per trovare la risposta giusta. Ogni giorno c'è una nuova bandiera.
                </p>
              </div>

              <div style={{ padding: '1rem 1.25rem', borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgSecondary }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>⌨️ Come giocare</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['1', 'Osserva la bandiera mostrata in cima alla pagina.'],
                    ['2', 'Digita il nome del paese nel campo di testo. Apparirà un elenco di suggerimenti mentre scrivi.'],
                    ['3', 'Seleziona un paese dai suggerimenti oppure premi Invio se c\'è un solo risultato.'],
                    ['4', 'Ogni tentativo sbagliato mostra il paese che hai scelto con una ✗. Il tentativo corretto mostra una ✓ su sfondo verde.'],
                    ['5', 'Se non indovini in 6 tentativi, la risposta viene rivelata.'],
                  ].map(([n, t]) => (
                    <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.accent, color: C.bg, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
                      <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>{t}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem 1.25rem', borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgSecondary }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>⏱️ Bandiera giornaliera</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  La bandiera cambia ogni giorno a mezzanotte. Una volta completata la partita, nella schermata di gioco troverai il countdown alla prossima bandiera. I tuoi progressi vengono salvati automaticamente nel browser.
                </p>
              </div>

              <div style={{ padding: '1rem 1.25rem', borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgSecondary }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>🌗 Tema</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  Usa il pulsante in alto a destra per passare tra tema chiaro ☀️, scuro 🌙 o automatico 🌗 (segue le impostazioni del dispositivo).
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

