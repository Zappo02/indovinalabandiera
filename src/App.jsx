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
const MAX_ATTEMPTS = 7

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['INVIO','Z','X','C','V','B','N','M','⌫'],
]

// ── component ─────────────────────────────────────────────────────────────────

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
  const [activeSug, setActiveSug] = useState(-1)
  const [tab, setTab] = useState('game')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [countdown, setCountdown] = useState(getTimeToMidnight())
  const [shake, setShake] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const inputRef = useRef(null)
  const acRef = useRef(null)

  useEffect(() => { saveState(state) }, [state])

  useEffect(() => {
    const id = setInterval(() => setCountdown(getTimeToMidnight()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const val = input.trim().toLowerCase()
    if (!val) { setSuggestions([]); return }
    const filtered = COUNTRIES
      .filter(c => c.name.toLowerCase().startsWith(val) || c.name.toLowerCase().includes(val))
      .slice(0, 6)
    setSuggestions(filtered)
    setActiveSug(-1)
  }, [input])

  useEffect(() => {
    const handleClick = (e) => {
      if (acRef.current && !acRef.current.contains(e.target) && e.target !== inputRef.current)
        setSuggestions([])
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Physical keyboard
  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'game' || state.done) return
      if (e.key === 'Enter') { handleConfirm(); return }
      if (e.key === 'Backspace') { setInput(v => v.slice(0,-1)); return }
      if (e.key === 'Escape') { setSuggestions([]); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(i => Math.min(i+1, suggestions.length-1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(i => Math.max(i-1, 0)); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tab, state.done, suggestions, activeSug, input])

  function submitGuess(country) {
    if (state.done) return
    if (state.guesses.find(g => g.code === country.code)) {
      setShake(true); setTimeout(() => setShake(false), 500); return
    }
    const newGuesses = [...state.guesses, { name: country.name, code: country.code }]
    const won = country.code === daily.code
    const done = won || newGuesses.length >= MAX_ATTEMPTS
    const newArchive = [...(state.archive || [])]
    if (done && !newArchive.find(a => a.date === todayStr))
      newArchive.push({ date: todayStr, code: daily.code, name: daily.name, won, att: newGuesses.length })
    setState(s => ({ ...s, guesses: newGuesses, done, won, archive: newArchive }))
    setInput('')
    setSuggestions([])
    setActiveSug(-1)
    if (done) setTimeout(() => setShowResult(true), 600)
  }

  function handleConfirm() {
    if (activeSug >= 0 && suggestions[activeSug]) { submitGuess(suggestions[activeSug]); return }
    if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
    const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
    if (exact) submitGuess(exact)
    else { setShake(true); setTimeout(() => setShake(false), 500) }
  }

  function handleKey(k) {
    if (state.done) return
    if (k === '⌫') { setInput(v => v.slice(0,-1)); return }
    if (k === 'INVIO') { handleConfirm(); return }
    setInput(v => v + k.toLowerCase())
    inputRef.current?.focus()
  }

  const arch = state.archive || []
  const wins = arch.filter(a => a.won).length
  const total = arch.length
  let streak = 0, cur = 0, maxStreak = 0
  arch.forEach(a => { if (a.won) { cur++; streak = cur; if (cur > maxStreak) maxStreak = cur } else cur = 0 })
  const dist = Array(MAX_ATTEMPTS).fill(0)
  arch.filter(a => a.won).forEach(a => { if (a.att >= 1 && a.att <= MAX_ATTEMPTS) dist[a.att-1]++ })
  const distMax = Math.max(...dist, 1)

  const isDark = theme === 'dark'

  const C = {
    pageBg: isDark ? '#121213' : '#ffffff',
    headerBg: isDark ? '#121213' : '#ffffff',
    headerBorder: isDark ? '#3a3a3c' : '#d3d6da',
    text: isDark ? '#ffffff' : '#1a1a1b',
    textSecondary: isDark ? '#818384' : '#787c7e',
    textMuted: isDark ? '#565758' : '#aaa',
    cellEmpty: isDark ? '#121213' : '#ffffff',
    cellEmptyBorder: isDark ? '#3a3a3c' : '#d3d6da',
    cellFilled: isDark ? '#121213' : '#ffffff',
    cellFilledBorder: isDark ? '#565758' : '#878a8c',
    cellCorrect: '#538d4e',
    cellWrong: isDark ? '#3a3a3c' : '#787c7e',
    keyBg: isDark ? '#818384' : '#d3d6da',
    keySpecialBg: isDark ? '#565758' : '#aaa',
    keyText: '#ffffff',
    acBg: isDark ? '#1e1e1e' : '#fff',
    acBorder: isDark ? '#3a3a3c' : '#d3d6da',
    acHover: isDark ? '#2a2a2b' : '#f0f0f0',
    inputBg: isDark ? '#1e1e1e' : '#fff',
    inputBorder: isDark ? '#565758' : '#d3d6da',
    accent: '#538d4e',
    resultBg: isDark ? '#1a1a1b' : '#f9f9f9',
    tabActive: isDark ? '#ffffff' : '#1a1a1b',
    tabInactive: isDark ? '#565758' : '#aaa',
  }

  // Grid: MAX_ATTEMPTS rows
  const rows = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    if (i < state.guesses.length) return { type: 'guess', data: state.guesses[i] }
    if (i === state.guesses.length && !state.done) return { type: 'active' }
    return { type: 'empty' }
  })

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.text, fontFamily: "'Clear Sans', 'Helvetica Neue', Arial, sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.headerBorder}`, padding: '0 16px' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', height: 50 }}>
          {/* Left: help */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <button onClick={() => setTab(tab === 'howto' ? 'game' : 'howto')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 20, padding: '4px 8px 4px 0' }} title="Come si gioca">?</button>
          </div>
          {/* Center: title */}
          <div style={{ flex: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: C.text }}>🏳️ BANDIERA DAILY</div>
            <div style={{ fontSize: 11, color: '#f5a623', letterSpacing: 1 }}>{formatDate(todayStr)}</div>
          </div>
          {/* Right: icons */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4 }} title="Tema">
              {isDark ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setTab(tab === 'stats' ? 'game' : 'stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 18, padding: 4 }} title="Statistiche">≡</button>
            <button onClick={() => setTab(tab === 'archive' ? 'game' : 'archive')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 18, padding: 4 }} title="Archivio">🗓</button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 500, margin: '0 auto', width: '100%', padding: '0 8px' }}>

        {/* ══ GAME ══ */}
        {tab === 'game' && (
          <>
            {/* Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '16px 0 12px', animation: shake ? 'shake 0.5s' : 'none' }}>
              {rows.map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

                  {/* Row number */}
                  <div style={{ width: 18, fontSize: 11, color: C.textMuted, textAlign: 'right', flexShrink: 0 }}>{i+1}</div>

                  {/* Flag cell */}
                  <div style={{
                    width: 72, height: 48,
                    borderRadius: 4,
                    border: `2px solid ${row.type === 'guess' ? (row.data.code === daily.code ? C.cellCorrect : C.cellWrong) : row.type === 'active' ? C.cellFilledBorder : C.cellEmptyBorder}`,
                    background: row.type === 'guess' ? (row.data.code === daily.code ? C.cellCorrect : C.cellWrong) : C.cellEmpty,
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.3s, border-color 0.3s',
                  }}>
                    {row.type === 'guess' && (
                      <span className={`fi fi-${row.data.code}`} style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'block' }} />
                    )}
                  </div>

                  {/* Country name */}
                  <div style={{
                    flex: 1, height: 48,
                    border: `2px solid ${row.type === 'active' ? C.cellFilledBorder : row.type === 'guess' ? (row.data.code === daily.code ? C.cellCorrect : C.cellWrong) : C.cellEmptyBorder}`,
                    borderRadius: 4,
                    background: row.type === 'guess' ? (row.data.code === daily.code ? C.cellCorrect : C.cellWrong) : C.cellEmpty,
                    display: 'flex', alignItems: 'center', paddingLeft: 12,
                    fontSize: 15, fontWeight: 600, letterSpacing: 0.5,
                    color: row.type === 'guess' ? '#fff' : C.textMuted,
                    transition: 'background 0.3s',
                  }}>
                    {row.type === 'guess' ? row.data.name : ''}
                  </div>

                  {/* Result icon */}
                  <div style={{ width: 20, fontSize: 16, textAlign: 'center', flexShrink: 0 }}>
                    {row.type === 'guess' ? (row.data.code === daily.code ? '✓' : '✗') : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Counter */}
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
              {state.done ? (state.won ? `Indovinato in ${state.guesses.length}/${MAX_ATTEMPTS}` : 'Fine tentativi') : `${state.guesses.length}/${MAX_ATTEMPTS}`}
            </div>

            {/* Input + autocomplete */}
            {!state.done && (
              <div style={{ position: 'relative', width: '100%', maxWidth: 380, marginBottom: 10 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(i => Math.min(i+1, suggestions.length-1)) }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(i => Math.max(i-1, 0)) }
                    if (e.key === 'Escape') setSuggestions([])
                  }}
                  placeholder="Scrivi il paese..."
                  autoComplete="off"
                  style={{ width: '100%', padding: '10px 14px', fontSize: 15, borderRadius: 6, border: `2px solid ${C.inputBorder}`, background: C.inputBg, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {suggestions.length > 0 && (
                  <div ref={acRef} style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: C.acBg, border: `1px solid ${C.acBorder}`, borderRadius: 6, zIndex: 20, overflow: 'hidden' }}>
                    {suggestions.map((c, i) => (
                      <div key={c.code} onMouseDown={e => { e.preventDefault(); submitGuess(c) }}
                        style={{ padding: '10px 14px', fontSize: 14, cursor: 'pointer', color: C.text, background: i === activeSug ? C.acHover : 'transparent', borderBottom: `1px solid ${C.acBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Result banner */}
            {state.done && showResult && (
              <div style={{ width: '100%', maxWidth: 380, background: C.resultBg, border: `1px solid ${C.headerBorder}`, borderRadius: 8, padding: '16px', textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{state.won ? '🎉 Indovinato!' : 'Fine tentativi'}</div>
                {!state.won && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className={`fi fi-${daily.code}`} style={{ width: 36, height: 24, borderRadius: 3, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block', border: `1px solid ${C.headerBorder}` }} />
                    <span style={{ fontWeight: 600 }}>{daily.name}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.textSecondary, letterSpacing: 1, marginTop: 8 }}>PROSSIMA BANDIERA TRA</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, marginTop: 4 }}>{countdown}</div>
                <button onClick={() => setTab('stats')} style={{ marginTop: 12, padding: '8px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}>STATISTICHE</button>
              </div>
            )}

            {/* Keyboard */}
            <div style={{ width: '100%', maxWidth: 480, marginTop: 4 }}>
              {KEYBOARD_ROWS.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 5 }}>
                  {row.map(k => (
                    <button key={k} onClick={() => handleKey(k)}
                      style={{
                        flex: k === 'INVIO' || k === '⌫' ? 1.5 : 1,
                        maxWidth: k === 'INVIO' || k === '⌫' ? 66 : 44,
                        height: 58,
                        borderRadius: 4,
                        border: 'none',
                        background: k === 'INVIO' || k === '⌫' ? C.keySpecialBg : C.keyBg,
                        color: C.keyText,
                        fontSize: k === 'INVIO' ? 11 : 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {k}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ STATS ══ */}
        {tab === 'stats' && (
          <div style={{ width: '100%', padding: '20px 8px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 16, color: C.textSecondary }}>STATISTICHE</div>
            {total === 0 ? (
              <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 14 }}>Nessuna partita ancora giocata.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                  {[
                    { n: total, l: 'Partite' },
                    { n: Math.round(wins/total*100)+'%', l: 'Vittorie' },
                    { n: streak, l: 'Serie att.' },
                    { n: maxStreak, l: 'Max serie' },
                  ].map(({ n, l }) => (
                    <div key={l} style={{ textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontSize: 32, fontWeight: 400, color: C.text }}>{n}</div>
                      <div style={{ fontSize: 11, color: C.textSecondary }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 10, color: C.textSecondary }}>DISTRIBUZIONE TENTATIVI</div>
                {dist.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ fontSize: 14, color: C.textSecondary, width: 14, textAlign: 'right', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ flex: 1, height: 20, background: isDark ? '#3a3a3c' : '#d3d6da', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(v/distMax*100, v>0?6:0)}%`, background: C.accent, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, transition: 'width 0.4s' }}>
                        {v > 0 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{v}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {state.done && (
                  <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.headerBorder}` }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, letterSpacing: 1 }}>PROSSIMA BANDIERA TRA</div>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, marginTop: 4 }}>{countdown}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ARCHIVE ══ */}
        {tab === 'archive' && (
          <div style={{ width: '100%', padding: '20px 8px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 16, color: C.textSecondary }}>ARCHIVIO</div>
            {arch.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 14 }}>Nessuna partita in archivio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...arch].reverse().map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, border: `1px solid ${a.won ? C.accent : C.headerBorder}`, background: a.won ? (isDark ? '#1a2e1a' : '#f0f9ea') : (isDark ? '#1e1e1e' : '#f9f9f9') }}>
                    <span className={`fi fi-${a.code}`} style={{ width: 36, height: 24, borderRadius: 3, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${C.headerBorder}`, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: C.textSecondary }}>{formatDate(a.date)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.won ? C.accent : C.textMuted, minWidth: 28, textAlign: 'right' }}>{a.won ? `${a.att}/${MAX_ATTEMPTS}` : '✗'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HOW TO PLAY ══ */}
        {tab === 'howto' && (
          <div style={{ width: '100%', padding: '20px 8px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 20, color: C.textSecondary }}>COME SI GIOCA</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14, color: C.textSecondary, lineHeight: 1.7 }}>
              <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.headerBorder}`, background: isDark ? '#1e1e1e' : '#f9f9f9' }}>
                <strong style={{ color: C.text, display: 'block', marginBottom: 6 }}>🏳️ Obiettivo</strong>
                Indovina il paese della bandiera mostrata ogni giorno. Hai <strong style={{ color: C.text }}>{MAX_ATTEMPTS} tentativi</strong>.
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.headerBorder}`, background: isDark ? '#1e1e1e' : '#f9f9f9' }}>
                <strong style={{ color: C.text, display: 'block', marginBottom: 6 }}>⌨️ Come giocare</strong>
                Digita il nome del paese nel campo di testo oppure usa la tastiera virtuale. Seleziona un suggerimento dall'elenco e premi <strong style={{ color: C.text }}>INVIO</strong> per confermare. La riga si colora di <span style={{ color: C.accent, fontWeight: 700 }}>verde</span> se hai indovinato, di grigio se sbagliato.
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.headerBorder}`, background: isDark ? '#1e1e1e' : '#f9f9f9' }}>
                <strong style={{ color: C.text, display: 'block', marginBottom: 6 }}>⏱️ Bandiera giornaliera</strong>
                La bandiera cambia ogni giorno a mezzanotte. Al termine trovi il countdown alla prossima. I progressi vengono salvati nel browser.
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.headerBorder}`, background: isDark ? '#1e1e1e' : '#f9f9f9' }}>
                <strong style={{ color: C.text, display: 'block', marginBottom: 6 }}>☀️ Tema</strong>
                Usa il pulsante sole/luna in alto a destra per alternare tra tema chiaro e scuro.
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          40%{transform:translateX(6px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
        * { box-sizing: border-box; }
        input::placeholder { color: #565758; }
      `}</style>
    </div>
  )
}

