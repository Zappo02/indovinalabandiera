import { useState, useEffect, useRef } from 'react'
import COUNTRIES from './countries.js'

// ── geo helpers ───────────────────────────────────────────────────────────────

function toRad(deg) { return deg * Math.PI / 180 }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

function bearing(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function bearingArrow(deg) {
  // 8 directions
  const dirs = ['↑','↗','→','↘','↓','↙','←','↖']
  return dirs[Math.round(deg / 45) % 8]
}

function formatKm(km) {
  if (km >= 1000) return `${(km/1000).toFixed(1).replace('.',',')} mila km`
  return `${km} km`
}

// ── date helpers ──────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDateStr(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
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
  const midnight = new Date(now); midnight.setHours(24,0,0,0)
  const diff = midnight - now
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function getArchiveDates() {
  const dates = []
  for (let i = -7; i <= -1; i++) dates.push(getDateStr(i))
  return dates.reverse()
}

// ── storage ───────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'bandiera_game_'
const THEME_KEY = 'bandiera_theme'
const MAX_ATTEMPTS = 7

function loadGame(dateStr) { try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + dateStr)) || null } catch { return null } }
function saveGame(dateStr, g) { try { localStorage.setItem(STORAGE_PREFIX + dateStr, JSON.stringify(g)) } catch {} }
function initGameState(dateStr) { return loadGame(dateStr) || { dateStr, guesses: [], done: false, won: false } }

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['INVIO','Z','X','C','V','B','N','M','⌫'],
]

// ── GameBoard ─────────────────────────────────────────────────────────────────

function GameBoard({ dateStr, onBack, isDark, C }) {
  const country = getDailyCountry(dateStr)
  const isToday = dateStr === getTodayStr()

  const [game, setGame] = useState(() => initGameState(dateStr))
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeSug, setActiveSug] = useState(-1)
  const [shake, setShake] = useState(false)
  const [showResult, setShowResult] = useState(() => !!loadGame(dateStr)?.done)
  const [countdown, setCountdown] = useState(getTimeToMidnight())
  const inputRef = useRef(null)
  const acRef = useRef(null)

  useEffect(() => { saveGame(dateStr, game) }, [game])
  useEffect(() => { if (!isToday) return; const id = setInterval(() => setCountdown(getTimeToMidnight()), 1000); return () => clearInterval(id) }, [isToday])

  useEffect(() => {
    const val = input.trim().toLowerCase()
    if (!val) { setSuggestions([]); return }
    setSuggestions(COUNTRIES.filter(c => c.name.toLowerCase().startsWith(val) || c.name.toLowerCase().includes(val)).slice(0, 6))
    setActiveSug(-1)
  }, [input])

  useEffect(() => {
    const h = (e) => { if (acRef.current && !acRef.current.contains(e.target) && e.target !== inputRef.current) setSuggestions([]) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = (e) => {
      if (game.done) return
      if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); return }
      if (e.key === 'Backspace') { setInput(v => v.slice(0,-1)); return }
      if (e.key === 'Escape') { setSuggestions([]); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(i => Math.min(i+1, suggestions.length-1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(i => Math.max(i-1, 0)); return }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [game.done, suggestions, activeSug, input])

  function submitGuess(c) {
    if (game.done) return
    if (game.guesses.find(g => g.code === c.code)) { setShake(true); setTimeout(() => setShake(false), 500); return }
    const newGuesses = [...game.guesses, { name: c.name, code: c.code, lat: c.lat, lng: c.lng }]
    const won = c.code === country.code
    const done = won || newGuesses.length >= MAX_ATTEMPTS
    setGame(g => ({ ...g, guesses: newGuesses, done, won }))
    setInput(''); setSuggestions([]); setActiveSug(-1)
    if (done) setTimeout(() => setShowResult(true), 400)
  }

  function handleConfirm() {
    if (activeSug >= 0 && suggestions[activeSug]) { submitGuess(suggestions[activeSug]); return }
    if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
    const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
    if (exact) submitGuess(exact)
    else { setShake(true); setTimeout(() => setShake(false), 500) }
  }

  function handleKey(k) {
    if (game.done) return
    if (k === '⌫') { setInput(v => v.slice(0,-1)); return }
    if (k === 'INVIO') { handleConfirm(); return }
    setInput(v => v + k.toLowerCase()); inputRef.current?.focus()
  }

  const rows = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    if (i < game.guesses.length) return { type: 'guess', data: game.guesses[i] }
    if (i === game.guesses.length && !game.done) return { type: 'active' }
    return { type: 'empty' }
  })

  const ROW_H = 36

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 500, margin: '0 auto', padding: '0 8px' }}>

      {/* Sub-header */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.headerBorder}`, marginBottom: 4 }}>
        {!isToday && <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary, fontSize: 20, padding: '0 8px 0 0' }}>←</button>}
        <div style={{ flex: 1, textAlign: isToday ? 'center' : 'left' }}>
          <span style={{ fontSize: 13, color: '#f5a623', fontWeight: 600 }}>{formatDate(dateStr)}</span>
          {!isToday && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>Archivio</span>}
        </div>
      </div>

      {/* Bandiera */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0 6px' }}>
        <div style={{ width: 160, height: 107, borderRadius: 6, overflow: 'hidden', border: `2px solid ${C.headerBorder}`, background: C.cellEmpty }}>
          <span className={`fi fi-${country.code}`} style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'block' }} />
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5, letterSpacing: 0.5 }}>
          {game.done ? (game.won ? `✓ ${country.name}` : `Risposta: ${country.name}`) : 'Di che paese è questa bandiera?'}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, animation: shake ? 'shake 0.5s' : 'none', width: '100%' }}>
        {rows.map((row, i) => {
          const isCorrect = row.type === 'guess' && row.data.code === country.code
          const km = row.type === 'guess' && !isCorrect && country.lat != null && row.data.lat != null
            ? haversineKm(row.data.lat, row.data.lng, country.lat, country.lng) : null
          const arrow = km != null ? bearingArrow(bearing(row.data.lat, row.data.lng, country.lat, country.lng)) : null

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Number */}
              <div style={{ width: 16, fontSize: 10, color: C.textMuted, textAlign: 'right', flexShrink: 0 }}>{i+1}</div>

              {/* Flag cell */}
              <div style={{
                width: 54, height: ROW_H, borderRadius: 3, flexShrink: 0,
                border: `2px solid ${row.type === 'guess' ? (isCorrect ? C.cellCorrect : C.cellWrong) : row.type === 'active' ? C.cellFilledBorder : C.cellEmptyBorder}`,
                background: row.type === 'guess' ? (isCorrect ? C.cellCorrect : C.cellWrong) : C.cellEmpty,
                overflow: 'hidden',
              }}>
                {row.type === 'guess' && <span className={`fi fi-${row.data.code}`} style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'block' }} />}
              </div>

              {/* Name cell */}
              <div style={{
                flex: 1, height: ROW_H, borderRadius: 3,
                border: `2px solid ${row.type === 'guess' ? (isCorrect ? C.cellCorrect : C.cellWrong) : row.type === 'active' ? C.cellFilledBorder : C.cellEmptyBorder}`,
                background: row.type === 'guess' ? (isCorrect ? C.cellCorrect : C.cellWrong) : C.cellEmpty,
                display: 'flex', alignItems: 'center', paddingLeft: 8,
                fontSize: 13, fontWeight: 600, color: row.type === 'guess' ? '#fff' : C.textMuted,
              }}>
                {row.type === 'guess' ? row.data.name : ''}
              </div>

              {/* Arrow + km */}
              <div style={{ width: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: ROW_H, flexShrink: 0 }}>
                {isCorrect && <span style={{ fontSize: 16 }}>✓</span>}
                {km != null && (
                  <>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{arrow}</span>
                    <span style={{ fontSize: 9, color: C.textSecondary, marginTop: 1, whiteSpace: 'nowrap' }}>{formatKm(km)}</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Counter */}
      <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>
        {game.done ? (game.won ? `Indovinato in ${game.guesses.length}/${MAX_ATTEMPTS}` : 'Fine tentativi') : `${game.guesses.length}/${MAX_ATTEMPTS}`}
      </div>

      {/* Input */}
      {!game.done && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 380, marginBottom: 8 }}>
          <input
            ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(i => Math.min(i+1, suggestions.length-1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(i => Math.max(i-1, 0)) }
              if (e.key === 'Escape') setSuggestions([])
            }}
            placeholder="Scrivi il paese..."
            autoComplete="off"
            style={{ width: '100%', padding: '9px 14px', fontSize: 14, borderRadius: 6, border: `2px solid ${C.inputBorder}`, background: C.inputBg, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {suggestions.length > 0 && (
            <div ref={acRef} style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: C.acBg, border: `1px solid ${C.acBorder}`, borderRadius: 6, zIndex: 20, overflow: 'hidden' }}>
              {suggestions.map((c, i) => (
                <div key={c.code} onMouseDown={e => { e.preventDefault(); submitGuess(c) }}
                  style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: C.text, background: i === activeSug ? C.acHover : 'transparent', borderBottom: `1px solid ${C.acBorder}` }}>
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {game.done && showResult && (
        <div style={{ width: '100%', maxWidth: 380, background: C.resultBg, border: `1px solid ${C.headerBorder}`, borderRadius: 8, padding: '14px', textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{game.won ? '🎉 Indovinato!' : 'Fine tentativi'}</div>
          {!game.won && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`fi fi-${country.code}`} style={{ width: 32, height: 21, borderRadius: 2, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block', border: `1px solid ${C.headerBorder}` }} />
              <span style={{ fontWeight: 600, color: C.text }}>{country.name}</span>
            </div>
          )}
          {isToday && (
            <>
              <div style={{ fontSize: 10, color: C.textSecondary, letterSpacing: 1, marginTop: 8 }}>PROSSIMA BANDIERA TRA</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, marginTop: 2, color: C.text }}>{countdown}</div>
            </>
          )}
          {!isToday && (
            <button onClick={onBack} style={{ marginTop: 8, padding: '7px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>← TORNA ALL'ARCHIVIO</button>
          )}
        </div>
      )}

      {/* Keyboard */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            {row.map(k => (
              <button key={k} onClick={() => handleKey(k)}
                style={{ flex: k === 'INVIO' || k === '⌫' ? 1.5 : 1, maxWidth: k === 'INVIO' || k === '⌫' ? 62 : 40, height: 54, borderRadius: 4, border: 'none', background: k === 'INVIO' || k === '⌫' ? C.keySpecialBg : C.keyBg, color: C.keyText, fontSize: k === 'INVIO' ? 10 : 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {k}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const todayStr = getTodayStr()
  const [tab, setTab] = useState('game')
  const [archiveDate, setArchiveDate] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [, forceUpdate] = useState(0)
  const [countdown, setCountdown] = useState(getTimeToMidnight())

  useEffect(() => { localStorage.setItem(THEME_KEY, theme) }, [theme])
  useEffect(() => { const id = setInterval(() => setCountdown(getTimeToMidnight()), 1000); return () => clearInterval(id) }, [])

  const isDark = theme === 'dark'

  const C = {
    pageBg: isDark ? '#121213' : '#ffffff',
    headerBorder: isDark ? '#3a3a3c' : '#d3d6da',
    text: isDark ? '#ffffff' : '#1a1a1b',
    textSecondary: isDark ? '#818384' : '#787c7e',
    textMuted: isDark ? '#565758' : '#aaa',
    cellEmpty: isDark ? '#121213' : '#ffffff',
    cellEmptyBorder: isDark ? '#3a3a3c' : '#d3d6da',
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
  }

  const archiveDates = getArchiveDates()
  const allDates = [todayStr, ...archiveDates]
  const allGames = allDates.map(d => loadGame(d)).filter(Boolean)
  const played = allGames.filter(g => g.done)
  const wins = played.filter(g => g.won).length
  const total = played.length
  let maxStreak = 0, cur = 0, streak = 0
  allDates.forEach(d => {
    const g = loadGame(d)
    if (g?.done && g?.won) { cur++; if (cur > maxStreak) maxStreak = cur; streak = cur }
    else cur = 0
  })
  const dist = Array(MAX_ATTEMPTS).fill(0)
  played.filter(g => g.won).forEach(g => { const a = g.guesses?.length; if (a >= 1 && a <= MAX_ATTEMPTS) dist[a-1]++ })
  const distMax = Math.max(...dist, 1)

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.text, fontFamily: "'Clear Sans','Helvetica Neue',Arial,sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.headerBorder}`, padding: '0 16px', flexShrink: 0 }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', height: 50 }}>
          <div style={{ flex: 1 }}>
            <button onClick={() => setTab('howto')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 20, padding: '4px 8px 4px 0' }}>?</button>
          </div>
          <div style={{ flex: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2, color: C.text }}>🏳️ BANDIERA DAILY</div>
            <div style={{ fontSize: 10, color: '#f5a623', letterSpacing: 1 }}>{formatDate(todayStr)}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: 4 }}>{isDark ? '☀️' : '🌙'}</button>
            <button onClick={() => setTab(tab === 'stats' ? 'game' : 'stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 17, padding: 4 }}>≡</button>
            <button onClick={() => { setTab('archive'); setArchiveDate(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 17, padding: 4 }}>🗓</button>
          </div>
        </div>
      </div>

      {/* GAME */}
      {tab === 'game' && <GameBoard dateStr={todayStr} onBack={null} isDark={isDark} C={C} />}

      {/* STATS */}
      {tab === 'stats' && (
        <div style={{ maxWidth: 500, margin: '0 auto', width: '100%', padding: '20px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 16, color: C.textSecondary }}>STATISTICHE</div>
          {total === 0 ? <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 14 }}>Nessuna partita ancora giocata.</p> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                {[{n:total,l:'Partite'},{n:Math.round(wins/total*100)+'%',l:'Vittorie'},{n:streak,l:'Serie att.'},{n:maxStreak,l:'Max serie'}].map(({n,l}) => (
                  <div key={l} style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 30, fontWeight: 400, color: C.text }}>{n}</div>
                    <div style={{ fontSize: 11, color: C.textSecondary }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10, color: C.textSecondary }}>DISTRIBUZIONE TENTATIVI</div>
              {dist.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 13, color: C.textSecondary, width: 14, textAlign: 'right', flexShrink: 0 }}>{i+1}</div>
                  <div style={{ flex: 1, height: 20, background: isDark ? '#3a3a3c' : '#d3d6da', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(v/distMax*100, v>0?6:0)}%`, background: C.accent, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, transition: 'width 0.4s' }}>
                      {v > 0 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{v}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.headerBorder}` }}>
                <div style={{ fontSize: 10, color: C.textSecondary, letterSpacing: 1 }}>PROSSIMA BANDIERA TRA</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, marginTop: 4 }}>{countdown}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ARCHIVE LIST */}
      {tab === 'archive' && archiveDate === null && (
        <div style={{ maxWidth: 500, margin: '0 auto', width: '100%', padding: '20px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 4, color: C.textSecondary }}>ARCHIVIO</div>
          <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginBottom: 16 }}>{archiveDates.length} bandiere disponibili</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archiveDates.map(d => {
              const c = getDailyCountry(d)
              const g = loadGame(d)
              const done = g?.done, won = g?.won, att = g?.guesses?.length
              return (
                <button key={d} onClick={() => setArchiveDate(d)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${done ? (won ? C.accent : C.headerBorder) : C.headerBorder}`, background: done ? (won ? (isDark?'#1a2e1a':'#f0f9ea') : (isDark?'#1e1e1e':'#f9f9f9')) : (isDark?'#1e1e1e':'#f9f9f9'), cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ width: 44, height: 30, borderRadius: 3, border: `1px solid ${C.headerBorder}`, overflow: 'hidden', flexShrink: 0, background: C.cellEmpty, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <span className={`fi fi-${c.code}`} style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'block' }} /> : <span style={{ fontSize: 18 }}>🏳️</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{done ? c.name : '???'}</div>
                    <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{formatDate(d)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: done ? (won ? C.accent : C.textMuted) : C.textSecondary }}>
                    {done ? (won ? `${att}/${MAX_ATTEMPTS}` : '✗') : 'Gioca →'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ARCHIVE GAME */}
      {tab === 'archive' && archiveDate !== null && (
        <GameBoard dateStr={archiveDate} onBack={() => { setArchiveDate(null); forceUpdate(n=>n+1) }} isDark={isDark} C={C} />
      )}

      {/* HOW TO PLAY */}
      {tab === 'howto' && (
        <div style={{ maxWidth: 500, margin: '0 auto', width: '100%', padding: '20px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 20, color: C.textSecondary }}>COME SI GIOCA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: C.textSecondary, lineHeight: 1.7 }}>
            {[
              ['🏳️ Obiettivo', `Indovina il paese della bandiera mostrata ogni giorno. Hai ${MAX_ATTEMPTS} tentativi.`],
              ['⌨️ Come giocare', 'Digita il nome del paese nel campo di testo. Seleziona un suggerimento e premi INVIO. La riga si colora di verde se corretto, grigio se sbagliato.'],
              ['→ Freccia direzionale', 'Ogni tentativo sbagliato mostra una freccia che indica la direzione geografica verso il paese corretto, più la distanza in km. Usala per affinare il tiro!'],
              ['🗓 Archivio', 'Nell\'archivio trovi le bandiere dei giorni precedenti, tutte giocabili. Ogni giorno si aggiunge quella di ieri.'],
              ['⏱️ Daily', 'Nuova bandiera ogni giorno a mezzanotte. I progressi vengono salvati nel browser.'],
              ['☀️ Tema', 'Usa il pulsante sole/luna in alto a destra per alternare tra tema chiaro e scuro.'],
            ].map(([title, text]) => (
              <div key={title} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.headerBorder}`, background: isDark ? '#1e1e1e' : '#f9f9f9' }}>
                <strong style={{ color: C.text, display: 'block', marginBottom: 4 }}>{title}</strong>{text}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        * { box-sizing: border-box; }
        input::placeholder { color: #565758; }
        button:focus { outline: none; }
      `}</style>
    </div>
  )
}

