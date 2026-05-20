import { useState, useEffect, useRef } from 'react'
import COUNTRIES from './countries.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDailyCountry(dateStr) {
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return COUNTRIES[h % COUNTRIES.length]
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

const STORAGE_KEY = 'bandiera_daily_v1'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

// ── styles ───────────────────────────────────────────────────────────────────

const S = {
  wrap: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '1.5rem 1rem 3rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '0.5px solid var(--color-border)',
  },
  h1: {
    fontFamily: 'var(--font-serif)',
    fontSize: 26,
    fontWeight: 500,
    color: 'var(--color-text)',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  dateLabel: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginTop: 4,
  },
  flagStage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '1.5rem 0',
  },
  flagWrap: {
    width: 220,
    height: 147,
    borderRadius: 8,
    overflow: 'hidden',
    border: '0.5px solid var(--color-border)',
    background: 'var(--color-bg-secondary)',
  },
  flagInner: {
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'block',
  },
  attLabel: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    marginTop: 10,
    letterSpacing: '0.5px',
  },
  guessesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: '1rem',
    minHeight: 36,
  },
  guessRow: (isCorrect) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
    border: `0.5px solid ${isCorrect ? 'var(--color-border-success)' : 'var(--color-border)'}`,
    background: isCorrect ? 'var(--color-bg-success)' : 'var(--color-bg-secondary)',
    color: isCorrect ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
  }),
  flagSmall: {
    width: 26,
    height: 18,
    borderRadius: 2,
    flexShrink: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '0.5px solid var(--color-border)',
    display: 'inline-block',
  },
  guessIcon: {
    marginLeft: 'auto',
    fontSize: 14,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: '0.75rem',
  },
  acList: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--color-bg)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    zIndex: 10,
    overflow: 'hidden',
    maxHeight: 200,
    overflowY: 'auto',
  },
  acItem: (active) => ({
    padding: '9px 12px',
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text)',
    background: active ? 'var(--color-bg-secondary)' : 'transparent',
    borderBottom: '0.5px solid var(--color-border)',
  }),
  btnConfirm: {
    width: '100%',
    padding: '10px',
    fontSize: 15,
    fontWeight: 500,
    borderRadius: 8,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    transition: 'background 0.1s',
  },
  resultBanner: {
    textAlign: 'center',
    padding: '1.25rem',
    borderRadius: 12,
    border: '0.5px solid var(--color-border)',
    background: 'var(--color-bg-secondary)',
    marginTop: '1rem',
  },
  resultBig: {
    fontSize: 22,
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  resultSub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginTop: 4,
  },
  answerFlag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: '0.75rem',
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  flagMd: {
    width: 32,
    height: 22,
    borderRadius: 3,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '0.5px solid var(--color-border)',
    display: 'inline-block',
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    marginTop: '1rem',
  },
  statBox: {
    flex: 1,
    textAlign: 'center',
    padding: '10px 4px',
    background: 'var(--color-bg-secondary)',
    borderRadius: 8,
    border: '0.5px solid var(--color-border)',
  },
  statN: {
    fontSize: 20,
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  statL: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    marginTop: 2,
  },
  archiveToggle: {
    marginTop: '1.25rem',
    textAlign: 'center',
  },
  archiveBtn: {
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  archiveList: {
    marginTop: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  archiveEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 10px',
    borderRadius: 8,
    border: '0.5px solid var(--color-border)',
    fontSize: 13,
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text)',
  },
}

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
  const [activeIdx, setActiveIdx] = useState(-1)
  const [showArchive, setShowArchive] = useState(false)
  const inputRef = useRef(null)
  const acRef = useRef(null)

  useEffect(() => { saveState(state) }, [state])

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
      if (acRef.current && !acRef.current.contains(e.target) && e.target !== inputRef.current) {
        setSuggestions([])
      }
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
    if (done && !newArchive.find(a => a.date === todayStr)) {
      newArchive.push({ date: todayStr, code: daily.code, name: daily.name, won, att: newGuesses.length })
    }
    setState(s => ({ ...s, guesses: newGuesses, done, won, archive: newArchive }))
    setInput('')
    setSuggestions([])
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) { submitGuess(suggestions[activeIdx]); return }
      if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
      const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
      if (exact) submitGuess(exact)
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setActiveIdx(-1)
    }
  }

  function handleConfirm() {
    if (activeIdx >= 0 && suggestions[activeIdx]) { submitGuess(suggestions[activeIdx]); return }
    if (suggestions.length === 1) { submitGuess(suggestions[0]); return }
    const exact = COUNTRIES.find(c => c.name.toLowerCase() === input.trim().toLowerCase())
    if (exact) submitGuess(exact)
  }

  const arch = state.archive || []
  const wins = arch.filter(a => a.won).length
  let streak = 0
  for (let i = arch.length - 1; i >= 0; i--) { if (arch[i].won) streak++; else break }

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>Indovina la Bandiera</h1>
        <p style={S.dateLabel}>{formatDate(todayStr)}</p>
      </div>

      {/* Flag display */}
      <div style={S.flagStage}>
        <div style={S.flagWrap}>
          <span
            className={`fi fi-${daily.code}`}
            style={S.flagInner}
            aria-label={state.done ? daily.name : 'Bandiera da indovinare'}
          />
        </div>
        <div style={S.attLabel}>
          {state.done
            ? (state.won ? 'Corretto!' : 'Fine tentativi')
            : `Tentativo ${state.guesses.length + 1} di 6`}
        </div>
      </div>

      {/* Guesses list */}
      <div style={S.guessesList}>
        {state.guesses.map((g, i) => {
          const isCorrect = g.code === daily.code
          return (
            <div key={i} style={S.guessRow(isCorrect)}>
              <span className={`fi fi-${g.code}`} style={S.flagSmall} aria-hidden="true" />
              <span>{g.name}</span>
              <span style={S.guessIcon}>{isCorrect ? '✓' : '✗'}</span>
            </div>
          )
        })}
      </div>

      {/* Input area */}
      {!state.done && (
        <>
          <div style={S.inputWrap}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi il nome del paese..."
              autoComplete="off"
              aria-label="Inserisci il nome del paese"
            />
            {suggestions.length > 0 && (
              <div ref={acRef} style={S.acList} role="listbox">
                {suggestions.map((c, i) => (
                  <div
                    key={c.code}
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseDown={e => { e.preventDefault(); submitGuess(c) }}
                    style={S.acItem(i === activeIdx)}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={S.btnConfirm} onClick={handleConfirm}>
            Conferma
          </button>
        </>
      )}

      {/* Result banner */}
      {state.done && (
        <div style={S.resultBanner}>
          <div style={S.resultBig}>{state.won ? 'Indovinato!' : 'Non ci sei arrivato'}</div>
          <div style={S.resultSub}>
            {state.won
              ? `In ${state.guesses.length} tentativ${state.guesses.length === 1 ? 'o' : 'i'}`
              : 'La risposta era:'}
          </div>
          <div style={S.answerFlag}>
            <span className={`fi fi-${daily.code}`} style={S.flagMd} aria-hidden="true" />
            <span>{daily.name}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {(arch.length > 0 || state.done) && (
        <div style={S.statsRow}>
          {[
            { n: arch.length, l: 'Partite' },
            { n: arch.length ? Math.round(wins / arch.length * 100) + '%' : '0%', l: 'Vittorie' },
            { n: streak, l: 'Serie' },
          ].map(({ n, l }) => (
            <div key={l} style={S.statBox}>
              <div style={S.statN}>{n}</div>
              <div style={S.statL}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Archive */}
      {state.done && (
        <div style={S.archiveToggle}>
          <button style={S.archiveBtn} onClick={() => setShowArchive(v => !v)}>
            {showArchive ? 'Nascondi storico' : 'Mostra storico partite'}
          </button>
          {showArchive && (
            <div style={S.archiveList}>
              {[...arch].reverse().map((a, i) => (
                <div key={i} style={S.archiveEntry}>
                  <span className={`fi fi-${a.code}`} style={{ ...S.flagSmall, width: 22, height: 15 }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {a.won ? `${a.att}/6` : '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
