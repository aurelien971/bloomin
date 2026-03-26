import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'

// ─── Event type definitions ───────────────────────────────────────────────────
const EVENT_TYPES = {
  sample:       { label: 'Sample needed',         color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', dot: 'bg-blue-500'   },
  launch:       { label: 'Launch date',           color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: 'bg-green-600'  },
  distributor:  { label: 'Distributor',           color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: 'bg-amber-500'  },
  ingredients:  { label: 'Ingredients due',       color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: 'bg-emerald-600'},
  arrives:      { label: 'Sample arrives',        color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', dot: 'bg-violet-600' },
  sampleSent:   { label: 'Sample sent',           color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', dot: 'bg-sky-500'    },
  signoff:      { label: 'Client sign-off',       color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', dot: 'bg-pink-600'   },
  delivery:     { label: 'First order delivery',  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', dot: 'bg-cyan-600'   },
  testbatch:    { label: 'Test batch',            color: '#ca8a04', bg: '#fefce8', border: '#fef08a', dot: 'bg-yellow-600' },
  production:   { label: 'Production booked',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', dot: 'bg-orange-600' },
  lab:          { label: 'Lab results due',       color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: 'bg-red-600'    },
  labsignoff:   { label: 'Lab signed off',        color: '#65a30d', bg: '#f7fee7', border: '#d9f99d', dot: 'bg-lime-600'   },
  rd:           { label: 'R&D due',              color: '#6d28d9', bg: '#faf5ff', border: '#e9d5ff', dot: 'bg-purple-700' },
  regulatory:   { label: 'Regulatory',           color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', dot: 'bg-sky-600'   },
  copacker:     { label: 'Co-packer trial',      color: '#c2410c', bg: '#fff7ed', border: '#fdba74', dot: 'bg-orange-700' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7)) // Monday start
  d.setHours(0,0,0,0)
  return d
}
function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmt(date, opts) {
  return date.toLocaleDateString('en-GB', opts)
}
function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────
export default function CalendarPage() {
  const router = useRouter()
  const [today]                   = useState(new Date())
  const [current,     setCurrent] = useState(new Date())
  const [view,        setView]    = useState('month') // month | week | day
  const [events,      setEvents]  = useState([])
  const [loading,     setLoading] = useState(true)
  const [selected,    setSelected] = useState(null)   // selected event
  const [selectedDay, setSelectedDay] = useState(null) // clicked day
  const [filters,     setFilters] = useState({
    types: Object.keys(EVENT_TYPES),
    clients: [],
    hidePast: false,
  })
  const [clients,     setClients] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
      if (e.key === 'Escape')     { setSelected(null); setSelectedDay(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, view])

  const navigate = useCallback((dir) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      if (view === 'week')  d.setDate(d.getDate() + dir * 7)
      if (view === 'day')   d.setDate(d.getDate() + dir)
      return d
    })
  }, [view])

  const loadData = async () => {
    setLoading(true)
    try {
      const [cSnap, pSnap, rSnap, bSnap, sSnap] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'rdItems'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'briefs')),
        getDocs(collection(db, 'scopingSheets')),
      ])

      const clientList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const briefMap   = {}
      bSnap.docs.forEach(d => { briefMap[d.id] = d.data() })

      // Build map of productId → latest expectedDelivery from scopingSheet ingredients
      const scopingDeliveryMap = {}
      sSnap.docs.forEach(d => {
        const sd = d.data()
        if (!sd.productId) return
        const latest = (sd.ingredients || [])
          .filter(r => r.expectedDelivery)
          .sort((a, b) => new Date(b.expectedDelivery) - new Date(a.expectedDelivery))[0]?.expectedDelivery
        if (latest) scopingDeliveryMap[sd.productId] = latest
      })
      setClients(clientList)
      setFilters(f => ({ ...f, clients: clientList.map(c => c.id) }))

      const all = []

      const addEvent = (date, type, productName, clientName, clientId, productId, extra = {}) => {
        if (!date) return
        const d = new Date(date)
        if (isNaN(d)) return
        const client = clientList.find(c => c.id === clientId)
        all.push({
          id: `${type}-${productId || clientId}-${date}`,
          date: d,
          type,
          productName,
          clientName,
          clientId,
          clientLogoUrl: client?.logoUrl || null,
          productId,
          ...extra,
        })
      }

      // Products + brief dates
      pSnap.docs.forEach(doc => {
        const p  = { id: doc.id, ...doc.data() }
        const fd = (p.briefId && briefMap[p.briefId]?.formData) || {}
        const s  = p.stages || {}
        const ingredientDelivery = scopingDeliveryMap[p.id] || s.scoping?.expectedDelivery

        addEvent(fd.samplesNeededBy,                  'sample',      p.productName, p.clientName, p.clientId, p.id)
        addEvent(fd.launchDate,                       'launch',      p.productName, p.clientName, p.clientId, p.id)
        addEvent(fd.distributorDate,                  'distributor', p.productName, p.clientName, p.clientId, p.id)
        addEvent(fd.samplesBy,                        'sample',      p.productName, p.clientName, p.clientId, p.id)
        addEvent(ingredientDelivery,                  'ingredients', p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.sampleSending?.sentAt,             'sampleSent',  p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.sampleSending?.expectedArrival,    'arrives',     p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.clientSignOff?.signedOffDate,      'signoff',     p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.clientSignOff?.targetDeliveryDate, 'delivery',    p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.lab?.signedOffAt,                  'labsignoff',  p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.batchDecision?.productionDateBooked,'production', p.productName, p.clientName, p.clientId, p.id)
        addEvent(s.labTesting?.expectedResultsDate,   'lab',         p.productName, p.clientName, p.clientId, p.id)
        addEvent(fd.regulatorySubmissionDate,         'regulatory',  p.productName, p.clientName, p.clientId, p.id)
        addEvent(fd.coPackerTrialDate,                'copacker',    p.productName, p.clientName, p.clientId, p.id)
      })

      // R&D items
      rSnap.docs.forEach(doc => {
        const r = { id: doc.id, ...doc.data() }
        addEvent(r.dueDate, 'rd', r.productName, r.clientName, r.clientId, null, { rdStatus: r.status, notes: r.notes })
      })

      all.sort((a, b) => a.date - b.date)
      setEvents(all)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // ── Filtered events ──────────────────────────────────────────────────────────
  const visibleEvents = events.filter(e => {
    if (!filters.types.includes(e.type)) return false
    if (filters.clients.length > 0 && !filters.clients.includes(e.clientId)) return false
    if (filters.hidePast && e.date < today && !isSameDay(e.date, today)) return false
    return true
  })

  // Group by date key for fast lookup
  const byDay = {}
  visibleEvents.forEach(e => {
    const k = dateKey(e.date)
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(e)
  })

  // ── Title string ──────────────────────────────────────────────────────────────
  const title = view === 'month'
    ? fmt(current, { month: 'long', year: 'numeric' })
    : view === 'week'
    ? (() => {
        const ws = startOfWeek(current)
        const we = addDays(ws, 6)
        return `${fmt(ws, { day: 'numeric', month: 'short' })} – ${fmt(we, { day: 'numeric', month: 'short', year: 'numeric' })}`
      })()
    : fmt(current, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#f8f8f7] flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Head>
        <title>Calendar — Bloomin NPD</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">

          {/* Back + logo */}
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-500 hover:text-black transition text-sm font-medium flex-shrink-0">
            <img src="/logo.png" alt="Bloomin" className="h-6 object-contain" onError={e => e.target.style.display='none'} />
            <span className="text-gray-300">|</span>
            <span>← Dashboard</span>
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Date nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600 text-sm">‹</button>
            <button onClick={() => setCurrent(new Date())}
              className="px-3 h-8 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition border border-gray-200">
              Today
            </button>
            <button onClick={() => navigate(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600 text-sm">›</button>
          </div>

          {/* Title */}
          <h1 className="text-base font-semibold text-gray-900 flex-1 min-w-0 truncate">{title}</h1>

          {/* View switcher */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
            {['day','week','month'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 h-8 text-xs font-semibold capitalize transition ${view === v ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold border transition ${showFilters ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Filters
            {(filters.types.length < Object.keys(EVENT_TYPES).length || filters.hidePast) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="max-w-[1400px] mx-auto px-6 py-4 border-t border-gray-100 flex flex-wrap gap-6">
            {/* Event types */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Event types</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(EVENT_TYPES).map(([key, t]) => {
                  const on = filters.types.includes(key)
                  return (
                    <button key={key} onClick={() => setFilters(f => ({
                      ...f, types: on ? f.types.filter(x => x !== key) : [...f.types, key]
                    }))}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition"
                      style={on ? { background: t.bg, borderColor: t.border, color: t.color } : { background: '#f9f9f9', borderColor: '#e5e7eb', color: '#9ca3af' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: on ? t.color : '#d1d5db' }} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clients */}
            {clients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Clients</p>
                <div className="flex flex-wrap gap-1.5">
                  {clients.map(c => {
                    const on = filters.clients.includes(c.id)
                    return (
                      <button key={c.id} onClick={() => setFilters(f => ({
                        ...f, clients: on ? f.clients.filter(x => x !== c.id) : [...f.clients, c.id]
                      }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${on ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {c.logoUrl && <img src={c.logoUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" onError={e => e.target.style.display='none'} />}
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Options */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Options</p>
              <button onClick={() => setFilters(f => ({ ...f, hidePast: !f.hidePast }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${filters.hidePast ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${filters.hidePast ? 'bg-white border-white text-black' : 'border-gray-300'}`}>
                  {filters.hidePast ? '✓' : ''}
                </span>
                Hide past events
              </button>
            </div>

            <div className="ml-auto self-end">
              <button onClick={() => setFilters({ types: Object.keys(EVENT_TYPES), clients: clients.map(c => c.id), hidePast: false })}
                className="text-xs text-gray-400 hover:text-black transition">Reset filters</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">

        {/* ── Calendar area ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading calendar...</p>
              </div>
            </div>
          ) : view === 'month' ? (
            <MonthView current={current} today={today} byDay={byDay} selected={selected} selectedDay={selectedDay}
              onSelectEvent={setSelected} onSelectDay={(d) => { setSelectedDay(d); setSelected(null) }} />
          ) : view === 'week' ? (
            <WeekView current={current} today={today} byDay={byDay} selected={selected}
              onSelectEvent={setSelected} onSelectDay={(d) => { setSelectedDay(d); setView('day'); setCurrent(d); setSelected(null) }} />
          ) : (
            <DayView current={current} today={today} byDay={byDay} selected={selected}
              onSelectEvent={setSelected} />
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────────── */}
        <RightPanel
          selected={selected}
          selectedDay={selectedDay}
          byDay={byDay}
          today={today}
          events={visibleEvents}
          onSelectEvent={setSelected}
          onClose={() => { setSelected(null); setSelectedDay(null) }}
          onNavigate={(id) => id && router.push(`/product/${id}`)}
        />
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ current, today, byDay, selected, selectedDay, onSelectEvent, onSelectDay }) {
  const start  = startOfMonth(current)
  const end    = endOfMonth(current)
  const gridStart = startOfWeek(start)

  const days = []
  let d = new Date(gridStart)
  while (d <= end || days.length % 7 !== 0 || days.length < 35) {
    days.push(new Date(d))
    d = addDays(d, 1)
    if (days.length > 42) break
  }

  const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className="p-6">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center py-2">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === current.getMonth()
          const isToday        = isSameDay(day, today)
          const isSelected     = selectedDay && isSameDay(day, selectedDay)
          const dayEvents      = byDay[dateKey(day)] || []
          const MAX_SHOWN      = 3

          return (
            <div key={i} onClick={() => onSelectDay(day)}
              className={`bg-white min-h-[110px] p-2 cursor-pointer transition-all hover:bg-gray-50 relative group ${!isCurrentMonth ? 'bg-gray-50/60' : ''} ${isSelected ? 'ring-2 ring-inset ring-black' : ''}`}>

              {/* Day number */}
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1.5 transition-all
                ${isToday ? 'bg-black text-white' : isSelected ? 'bg-gray-900 text-white' : isCurrentMonth ? 'text-gray-900 group-hover:bg-gray-100' : 'text-gray-300'}`}>
                {day.getDate()}
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_SHOWN).map((e, ei) => {
                  const t = EVENT_TYPES[e.type]
                  return (
                    <button key={ei} onClick={ev => { ev.stopPropagation(); onSelectEvent(e) }}
                      className="w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate transition-all hover:brightness-95"
                      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
                      <span className="opacity-60">{t.label.split(' ').slice(0,2).join(' ')} · </span>{e.productName}
                    </button>
                  )
                })}
                {dayEvents.length > MAX_SHOWN && (
                  <p className="text-[10px] text-gray-400 font-medium px-1.5">+{dayEvents.length - MAX_SHOWN} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ current, today, byDay, selected, onSelectEvent, onSelectDay }) {
  const weekStart = startOfWeek(current)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  return (
    <div className="p-6">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            const count = (byDay[dateKey(day)] || []).length
            return (
              <div key={i} onClick={() => onSelectDay(day)}
                className="py-3 text-center cursor-pointer hover:bg-gray-50 transition border-r border-gray-100 last:border-r-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{WEEKDAYS[i]}</p>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition
                  ${isToday ? 'bg-black text-white' : 'text-gray-800 hover:bg-gray-100'}`}>
                  {day.getDate()}
                </div>
                {count > 0 && <p className="text-[10px] text-gray-400 mt-1">{count} event{count !== 1 ? 's' : ''}</p>}
              </div>
            )
          })}
        </div>

        {/* Events rows */}
        <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[400px]">
          {days.map((day, i) => {
            const dayEvents = byDay[dateKey(day)] || []
            const isToday   = isSameDay(day, today)
            return (
              <div key={i} className={`p-2 space-y-1 ${isToday ? 'bg-amber-50/50' : ''}`}>
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[10px] text-gray-200 rotate-90 whitespace-nowrap select-none">No events</p>
                  </div>
                ) : dayEvents.map((e, ei) => {
                  const t  = EVENT_TYPES[e.type]
                  const isSel = selected?.id === e.id
                  return (
                    <button key={ei} onClick={() => onSelectEvent(e)}
                      className="w-full text-left p-2 rounded-xl text-xs font-medium transition-all hover:shadow-sm"
                      style={{ background: isSel ? t.color : t.bg, color: isSel ? '#fff' : t.color, border: `1px solid ${isSel ? t.color : t.border}` }}>
                      <p className="font-semibold truncate text-[11px]">{e.productName}</p>
                      <p className="opacity-70 truncate mt-0.5" style={{ fontSize: '10px' }}>{t.label}</p>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ current, today, byDay, selected, onSelectEvent }) {
  const isToday   = isSameDay(current, today)
  const dayEvents = byDay[dateKey(current)] || []

  return (
    <div className="p-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 ${isToday ? 'bg-amber-50' : ''}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {fmt(current, { weekday: 'long' })}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {fmt(current, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {isToday && <span className="inline-block mt-1 text-xs bg-black text-white px-2 py-0.5 rounded-full font-semibold">Today</span>}
        </div>

        {dayEvents.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl mb-3">📅</p>
            <p className="font-semibold text-gray-700">Nothing scheduled</p>
            <p className="text-sm text-gray-400 mt-1">No events on this day</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dayEvents.map((e, i) => {
              const t     = EVENT_TYPES[e.type]
              const isSel = selected?.id === e.id
              return (
                <button key={i} onClick={() => onSelectEvent(isSel ? null : e)}
                  className={`w-full text-left px-6 py-4 transition-all hover:bg-gray-50 flex items-center gap-4 ${isSel ? 'bg-gray-50' : ''}`}>
                  <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: t.bg }}>
                    {t.label.split(' ')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{e.productName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.label} · {e.clientName}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold border"
                      style={{ background: t.bg, color: t.color, borderColor: t.border }}>
                      {t.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────
function RightPanel({ selected, selectedDay, byDay, today, events, onSelectEvent, onClose, onNavigate }) {
  const upcomingAll = events
    .filter(e => e.date >= today || isSameDay(e.date, today))
    .slice(0, 12)

  const dayEvents = selectedDay ? (byDay[dateKey(selectedDay)] || []) : []

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto sticky top-[57px] self-start h-[calc(100vh-57px)]">

      {/* Event detail */}
      {selected ? (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Event detail</p>
            <button onClick={onClose} className="text-gray-400 hover:text-black transition text-lg leading-none">×</button>
          </div>
          <EventDetail event={selected} onNavigate={onNavigate} />
        </div>

      /* Day detail */
      ) : selectedDay ? (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {fmt(selectedDay, { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-black transition text-lg leading-none">×</button>
          </div>
          {dayEvents.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Nothing scheduled</p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((e, i) => {
                const t = EVENT_TYPES[e.type]
                return (
                  <button key={i} onClick={() => onSelectEvent(e)}
                    className="w-full text-left p-3 rounded-xl border transition hover:shadow-sm"
                    style={{ borderColor: t.border, background: t.bg }}>
                    <p className="font-semibold text-xs" style={{ color: t.color }}>{t.label}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{e.productName}</p>
                    <p className="text-xs text-gray-500 truncate">{e.clientName}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      /* Upcoming events */
      ) : (
        <div className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Upcoming</p>
          {upcomingAll.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">🗓️</p>
              <p className="text-sm text-gray-400">No upcoming events</p>
              <p className="text-xs text-gray-300 mt-1">Add dates in your briefs and pipeline stages</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingAll.map((e, i) => {
                const t    = EVENT_TYPES[e.type]
                const diff = Math.ceil((e.date - today) / 86400000)
                const isToday_ = isSameDay(e.date, today)
                return (
                  <button key={i} onClick={() => onSelectEvent(e)}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition group">
                    <div className="w-8 h-8 rounded-xl flex-shrink-0 flex flex-col items-center justify-center"
                      style={{ background: t.bg }}>
                      <p className="text-[10px] font-bold leading-none" style={{ color: t.color }}>
                        {fmt(e.date, { month: 'short' }).toUpperCase()}
                      </p>
                      <p className="text-sm font-bold leading-none mt-0.5" style={{ color: t.color }}>
                        {e.date.getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{e.productName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{t.label}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {isToday_ ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Today</span>
                      ) : diff <= 7 ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{diff}d</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">{diff}d</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Event Detail Card ────────────────────────────────────────────────────────
function EventDetail({ event, onNavigate }) {
  const t    = EVENT_TYPES[event.type]
  const diff = Math.ceil((event.date - new Date()) / 86400000)
  const past = diff < 0

  return (
    <div className="space-y-4">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-full text-xs font-bold border"
          style={{ background: t.bg, color: t.color, borderColor: t.border }}>
          {t.label}
        </span>
        {!past ? (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${diff === 0 ? 'bg-amber-50 text-amber-700' : diff <= 7 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
            {diff === 0 ? 'Today' : diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`}
          </span>
        ) : (
          <span className="text-xs text-gray-400 px-2 py-1 rounded-full bg-gray-50">{Math.abs(diff)} days ago</span>
        )}
      </div>

      {/* Product */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Product</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{event.productName}</p>
        <p className="text-sm text-gray-500 mt-0.5">{event.clientName}</p>
      </div>

      {/* Date */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Date</p>
        <p className="text-base font-semibold text-gray-900">
          {fmt(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* R&D status */}
      {event.rdStatus && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">R&D Status</p>
          <p className="text-sm text-gray-700 capitalize">{event.rdStatus.replace('-', ' ')}</p>
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-sm text-gray-700 leading-relaxed">{event.notes}</p>
        </div>
      )}

      {/* Go to product */}
      {event.productId && (
        <button onClick={() => onNavigate(event.productId)}
          className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition">
          Open product →
        </button>
      )}
    </div>
  )
}