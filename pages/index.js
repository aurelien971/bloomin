import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY_CLIENT = { name: '', logoUrl: '', markets: [], establishments: '', notes: '' }

const TOP_MARKETS = [
  'UK','USA — East Coast','USA — West Coast','USA — Midwest','USA — South',
  'France','Germany','Netherlands','Belgium','Switzerland','Austria','Italy','Spain','Portugal',
  'Sweden','Norway','Denmark','Finland','Ireland','Poland','Czech Republic','Greece',
  'UAE','Saudi Arabia','Qatar','Kuwait','Bahrain',
  'Australia','New Zealand','Singapore','Hong Kong','Japan','South Korea',
  'Brazil','Mexico','Argentina','Colombia','Chile',
  'Canada','South Africa','India','China',
  'Other',
]

const STAGES = [
  { key: 'brief',          label: 'Brief'          },
  { key: 'scoping',        label: 'Ingredients'    },
  { key: 'lab',            label: 'Lab'            },
  { key: 'sampleSending',  label: 'Sample'         },
  { key: 'clientSignOff',  label: 'Sign-off'       },
  { key: 'validation',     label: 'Test Batch'     },
  { key: 'batchDecision',  label: 'Decision'       },
  { key: 'labTesting',     label: 'Lab Testing'    },
  { key: 'labelling',      label: 'Labelling'      },
  { key: 'release',        label: 'Released'       },
]

const STATUS_STYLES = {
  'complete':    { dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700',  label: 'Complete'    },
  'in-progress': { dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700',  label: 'In progress' },
  'not-started': { dot: 'bg-gray-200',   badge: 'bg-gray-50 text-gray-400',    label: 'Not started' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusOf(product, key) {
  return product?.stages?.[key]?.status || 'not-started'
}

function overallStatus(product) {
  const s = product?.stages || {}
  if (s.release?.status === 'complete')        return 'complete'
  if (s.labTesting?.status === 'in-progress'
   || s.labTesting?.status === 'failed')        return 'in-progress'
  if (s.validation?.status === 'in-progress')   return 'in-progress'
  if (s.clientApproval?.status === 'in-progress') return 'in-progress'
  if (s.lab?.status === 'in-progress')          return 'in-progress'
  if (s.procurement?.status === 'in-progress')  return 'in-progress'
  if (s.scoping?.status === 'in-progress')      return 'in-progress'
  if (s.brief?.status === 'in-progress')        return 'in-progress'
  return 'not-started'
}

function getCurrentStatus(product) {
  const s = product?.stages || {}
  if (s.release?.status === 'complete')
    return { label: 'Business as usual', emoji: '✅' }
  if (s.labTesting?.status === 'failed')
    return { label: 'Lab test failed — investigate', emoji: '🔴' }
  if (s.labTesting?.status === 'in-progress') {
    const date = s.labTesting?.expectedResultsDate
    return { label: `Waiting on lab${date ? ` · results ${new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}`, emoji: '🔬' }
  }
  if (s.validation?.status === 'in-progress')
    return { label: 'Test batch — waiting on production', emoji: '🏭' }
  if (s.clientSignOff?.status === 'in-progress')
    return { label: 'Waiting on client sign-off', emoji: '✍️' }
  if (s.clientSignOff?.status === 'complete') {
    const vol = s.clientSignOff?.initialOrderVolume
    return { label: `Signed off${vol ? ` · ${vol} ${s.clientSignOff.initialOrderUnit || 'bottles'}` : ''}`, emoji: '✅' }
  }
  if (s.sampleSending?.status === 'in-progress')
    return { label: 'Sample sending — log shipment', emoji: '📦' }
  if (s.sampleSending?.status === 'complete' && s.clientSignOff?.status !== 'complete') {
    const arrival = s.sampleSending?.expectedArrival
    return { label: `Sample sent · arriving ${arrival ? new Date(arrival).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'soon'}`, emoji: '🚚' }
  }
  if (s.lab?.status === 'in-progress')
    return { label: 'Waiting on Dima · Lab development', emoji: '🧪' }
  if (s.scoping?.phase === 'ordering') {
    const date = s.scoping?.expectedDelivery
    return { label: `Awaiting delivery${date ? ` · ${new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}`, emoji: '📦' }
  }
  if (s.scoping?.status === 'in-progress')
    return { label: 'Waiting on Dima · Ingredients & sourcing', emoji: '🧺' }
  if (s.brief?.status === 'in-progress')
    return { label: 'Waiting on client · Brief', emoji: '📋' }
  return { label: 'Awaiting client brief', emoji: '📋' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StagePipeline({ product }) {
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const status = statusOf(product, s.key)
        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && <div className={`w-3 h-px ${status === 'not-started' ? 'bg-gray-200' : 'bg-gray-300'}`} />}
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${(STATUS_STYLES[status] || STATUS_STYLES['not-started']).dot}`} title={s.label} />
          </div>
        )
      })}
    </div>
  )
}

function StageRow({ stage, product, onNavigate, onCopyLink, copied }) {
  const status = statusOf(product, stage.key)
  const style  = STATUS_STYLES[status] || STATUS_STYLES['not-started']

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-base w-7 text-center">{stage.icon}</span>
        <div>
          <p className="text-sm font-semibold text-gray-800">{stage.label}</p>
          {stage.key === 'lab' && product.stages?.lab?.signedOffVersion && (
            <p className="text-xs text-gray-400">Signed off: V{product.stages.lab.signedOffVersion}</p>
          )}
          {stage.key === 'lab' && product.stages?.lab?.latestVersion && !product.stages?.lab?.signedOffVersion && (
            <p className="text-xs text-gray-400">Latest: V{product.stages.lab.latestVersion}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>{style.label}</span>
        {stage.key === 'brief' && product.briefId && (
          <button onClick={onCopyLink} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition">
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        )}
        {stage.key === 'lab' && product.briefId && (
          <button onClick={() => onNavigate(`/lab/${product.briefId}`)} className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition">
            Open →
          </button>
        )}
        {(stage.key === 'handover' || stage.key === 'validation' || stage.key === 'release') && (
          <span className="px-3 py-1.5 text-xs border border-gray-100 text-gray-300 rounded-lg font-medium">Coming soon</span>
        )}
      </div>
    </div>
  )
}

function SidebarItem({ label, count, active, onClick, logo }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2.5 ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
      {logo
        ? <div className="w-6 h-6 rounded-md flex-shrink-0 bg-white flex items-center justify-center overflow-hidden border border-gray-100">
            <img src={logo} alt="" className="w-full h-full object-contain p-0.5" onError={e => e.target.style.display='none'} />
          </div>
        : <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>{label[0]}</div>
      }
      <span className="truncate">{label}</span>
      <span className={`ml-auto text-xs flex-shrink-0 ${active ? 'text-white/60' : 'text-gray-400'}`}>{count}</span>
    </button>
  )
}

function Modal({ title, sub, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  const [authed,           setAuthed]           = useState(false)
  const [currentUser,      setCurrentUser]      = useState(null)
  const [password,         setPassword]         = useState('')
  const [userName,         setUserName]         = useState('')
  const [userList,         setUserList]         = useState([])

  const [clients,          setClients]          = useState([])
  const [products,         setProducts]         = useState([])
  const [loading,          setLoading]          = useState(false)

  const [activeClient,     setActiveClient]     = useState(null)
  const [filterClient,     setFilterClient]     = useState(null)
  const [sortBy,           setSortBy]           = useState('activity')
  const [viewMode,         setViewMode]         = useState('list')
  const [expanded,         setExpanded]         = useState(null)
  const [userMenuOpen,     setUserMenuOpen]     = useState(false)
  const [copied,           setCopied]           = useState(null)

  const [productModal,     setProductModal]     = useState(false)
  const [clientModal,      setClientModal]      = useState(false)
  const [editingClient,    setEditingClient]    = useState(null)
  const [deleteConfirm,    setDeleteConfirm]    = useState(null)

  const [clientForm,       setClientForm]       = useState(EMPTY_CLIENT)
  const [newProductName,   setNewProductName]   = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newProductType,   setNewProductType]   = useState('syrup')
  const [newProductOwner,  setNewProductOwner]  = useState('')
  const [marketInput,      setMarketInput]      = useState('')
  const [uploadingLogo,    setUploadingLogo]    = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────

  const login = async () => {
    if (!userName) { alert('Please select your name'); return }
    try {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('name', '==', userName),
        where('password', '==', password)
      ))
      if (snap.empty) { alert('Incorrect password'); return }
      const user = { id: snap.docs[0].id, ...snap.docs[0].data() }
      setCurrentUser(user); setAuthed(true)
      localStorage.setItem('npd_auth', '1')
      localStorage.setItem('npd_user', JSON.stringify(user))
    } catch (e) { console.error(e); alert('Login error') }
  }

  useEffect(() => {
    // Fetch user list for login dropdown
    getDocs(collection(db, 'users')).then(snap => {
      const names = snap.docs.map(d => d.data().name).filter(Boolean).sort()
      setUserList(names)
    }).catch(console.error)

    const auth = localStorage.getItem('npd_auth')
    const saved = localStorage.getItem('npd_user')
    if (auth === '1' && saved) {
      setAuthed(true)
      setCurrentUser(JSON.parse(saved))
    } else {
      localStorage.removeItem('npd_auth')
      localStorage.removeItem('npd_user')
    }
  }, [])

  useEffect(() => { if (authed) fetchAll() }, [authed])

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'),  orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
      ])
      setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // ── Create product ────────────────────────────────────────────────────────

  const createProduct = async () => {
    if (!selectedClientId || !newProductName.trim()) return
    const client = clients.find(c => c.id === selectedClientId)
    try {
      const briefRef = await addDoc(collection(db, 'briefs'), {
        clientId: selectedClientId, clientName: client.name,
        clientLogoUrl:  client.logoUrl  || '',
        clientMarkets:  client.markets  || [],
        productName:    newProductName.trim(),
        productType:    newProductType,
        submitted: false, formData: { productCategory: newProductType }, createdAt: new Date().toISOString(),
      })
      const productRef = await addDoc(collection(db, 'products'), {
        clientId:    selectedClientId,
        clientName:  client.name,
        productName: newProductName.trim(),
        productType: newProductType,
        owner:       newProductOwner || currentUser?.name || '',
        briefId:     briefRef.id,
        createdAt:   new Date().toISOString(),
        stages: {
          brief:          { status: 'in-progress' },
          scoping:        { status: 'not-started' },
          lab:            { status: 'not-started' },
          sampleSending:  { status: 'not-started' },
          clientSignOff:  { status: 'not-started' },
          validation:     { status: 'not-started' },
          batchDecision:  { status: 'not-started' },
          labTesting:     { status: 'not-started' },
          labelling:      { status: 'not-started' },
          release:        { status: 'not-started' },
        },
      })
      // Write productId back onto brief so BriefForm can advance stages on submit
      await updateDoc(briefRef, { productId: productRef.id })
      setProductModal(false); setNewProductName(''); setSelectedClientId(''); setNewProductType('syrup'); setNewProductOwner('')
      await fetchAll()
      navigator.clipboard.writeText(`${window.location.origin}/brief/${briefRef.id}`)
      setCopied(briefRef.id); setTimeout(() => setCopied(null), 2500)
      setExpanded(productRef.id)
    } catch (e) { alert('Error creating product'); console.error(e) }
  }

  // ── Delete product ────────────────────────────────────────────────────────

  const deleteProduct = async (product) => {
    try {
      await deleteDoc(doc(db, 'products', product.id))
      if (product.briefId) await deleteDoc(doc(db, 'briefs', product.briefId))
      setExpanded(null); setDeleteConfirm(null); fetchAll()
    } catch (e) { console.error(e) }
  }

  // ── Client management ─────────────────────────────────────────────────────

  const saveClient = async () => {
    if (!clientForm.name.trim()) return
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), { ...clientForm })
      } else {
        await addDoc(collection(db, 'clients'), { ...clientForm, createdAt: new Date().toISOString() })
      }
      setClientModal(false); setEditingClient(null); setClientForm(EMPTY_CLIENT); fetchAll()
    } catch (e) { console.error(e) }
  }

  const openEditClient = (client) => {
    setEditingClient(client)
    setClientForm({ name: client.name, logoUrl: client.logoUrl || '', markets: client.markets || [], establishments: client.establishments || '', notes: client.notes || '' })
    setClientModal(true)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingLogo(true)
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setClientForm(f => ({ ...f, logoUrl: url }))
    } catch (err) { alert('Upload failed.'); console.error(err) }
    setUploadingLogo(false)
  }

  const addMarket = () => {
    if (!marketInput.trim() || marketInput === 'Other') return
    if (!(clientForm.markets || []).includes(marketInput.trim()))
      setClientForm(f => ({ ...f, markets: [...(f.markets||[]), marketInput.trim()] }))
    setMarketInput('')
  }

  const copyBriefLink = (briefId) => {
    navigator.clipboard.writeText(`${window.location.origin}/brief/${briefId}`)
    setCopied(briefId); setTimeout(() => setCopied(null), 2500)
  }

  // ── Sort + filter ─────────────────────────────────────────────────────────

  const nextDueDate = (p) => {
    const fd = p.stages?.brief ? null : null // brief formData lives on brief doc, not product
    const dates = [
      p.stages?.sampleSending?.expectedArrival,
      p.stages?.clientSignOff?.targetDeliveryDate,
      p.stages?.labTesting?.expectedResultsDate,
      p.stages?.batchDecision?.productionDateBooked,
    ].filter(Boolean).map(d => new Date(d).getTime()).filter(n => n > Date.now())
    return dates.length > 0 ? Math.min(...dates) : Infinity
  }

  const lastActivity = (p) => {
    const stages = p.stages || {}
    const timestamps = Object.values(stages).flatMap(s => [
      s?.completedAt, s?.updatedAt, s?.sentAt, s?.deliveredAt,
      s?.submittedAt, s?.signedOffDate, s?.approvedAt,
    ]).filter(Boolean)
    return timestamps.length > 0
      ? Math.max(...timestamps.map(t => new Date(t).getTime()))
      : new Date(p.createdAt || 0).getTime()
  }

  const visibleProducts = (filterClient ? products.filter(p => p.clientId === filterClient.id) : products)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'activity') return lastActivity(b) - lastActivity(a)
      if (sortBy === 'due')      return nextDueDate(a) - nextDueDate(b)
      if (sortBy === 'name')     return a.productName.localeCompare(b.productName)
      if (sortBy === 'client')   return (a.clientName || '').localeCompare(b.clientName || '')
      return 0
    })

  // ── Timeline events ────────────────────────────────────────────────────────

  const timelineEvents = products.flatMap(p => {
    const events = []
    const fd = p.briefFormData || {}
    const add = (date, label, color) => {
      if (!date) return
      const d = new Date(date)
      if (!isNaN(d)) events.push({ date: d, label, productName: p.productName, clientName: p.clientName, logoUrl: clients.find(c => c.id === p.clientId)?.logoUrl, productId: p.id, color })
    }
    add(fd.samplesNeededBy,   '🧪 Sample date',       'blue')
    add(fd.distributorDate,   '🚚 Lands at distributor', 'amber')
    add(fd.launchDate,        '🚀 In-store launch',    'green')
    add(p.stages?.sampleSending?.expectedArrival, '📦 Sample arrives', 'purple')
    add(p.stages?.clientSignOff?.targetDeliveryDate, '📋 First order delivery', 'teal')
    add(p.stages?.batchDecision?.productionDateBooked, '🏭 Production booked', 'orange')
    add(p.stages?.labTesting?.expectedResultsDate, '🔬 Lab results due', 'red')
    return events
  }).sort((a, b) => a.date - b.date)

  const upcomingEvents = timelineEvents.filter(e => e.date >= new Date(Date.now() - 86400000 * 7)) // 7 days back

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-8">
      <Head><title>Bloomin — NPD</title></Head>
      <img
        src="/logo.png"
        alt="Bloomin"
        className="h-14 object-contain brightness-0 invert"
        onError={e => e.target.style.display='none'}
      />
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">NPD Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Internal access only</p>
        </div>
        <div className="space-y-3">
          <select value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-800">
            <option value="">Who are you?</option>
            {userList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        <button onClick={login} className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition">Enter</button>
      </div>
    </div>
  )

  // ── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head><title>Bloomin — NPD</title></Head>

      {/* Header */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Left — logo */}
          <img src="/logo.png" alt="Bloomin" className="h-6 object-contain brightness-0 invert flex-shrink-0" onError={e => e.target.style.display='none'} />

          {/* Right */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setProductModal(true)} disabled={clients.length === 0}
              className="px-4 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              + New product
            </button>

            {/* User dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {currentUser.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-white leading-none">{currentUser.name}</p>
                    <p className="text-xs text-white/50">{currentUser.role}</p>
                  </div>
                  <svg className="w-3 h-3 text-white/40 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-900">{currentUser.name}</p>
                        <p className="text-xs text-gray-400">{currentUser.role}</p>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { router.push('/suppliers'); setUserMenuOpen(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                          Suppliers
                        </button>
                        <button onClick={() => { setEditingClient(null); setClientForm(EMPTY_CLIENT); setClientModal(true); setUserMenuOpen(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                          + New client
                        </button>
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button onClick={() => { setAuthed(false); setCurrentUser(null); localStorage.removeItem('npd_auth'); localStorage.removeItem('npd_user'); setUserMenuOpen(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full space-y-6">

        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <button onClick={() => setFilterClient(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${!filterClient ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              All ({products.length})
            </button>
            {clients.map(c => {
              const count = products.filter(p => p.clientId === c.id).length
              if (count === 0) return null
              return (
                <button key={c.id} onClick={() => setFilterClient(filterClient?.id === c.id ? null : c)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filterClient?.id === c.id ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {c.logoUrl && <img src={c.logoUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" onError={e => e.target.style.display='none'} />}
                  {c.name} <span className="opacity-60">{count}</span>
                </button>
              )
            })}
            {clients.map(c => null).length === 0 && (
              <button onClick={() => openEditClient(null)} className="text-xs text-gray-400 hover:text-black px-2 py-1 transition">✏️ Edit clients</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-black text-gray-600">
              <option value="activity">↻ Latest activity</option>
              <option value="due">⏱ Next due date</option>
              <option value="name">A–Z Name</option>
              <option value="client">A–Z Client</option>
            </select>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[['list','☰'],['timeline','📅']].map(([v,icon]) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-sm transition ${viewMode === v ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── LIST VIEW ───────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {visibleProducts.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
                <p className="text-3xl mb-3">🌿</p>
                <p className="font-semibold text-gray-700">{clients.length === 0 ? 'Create a client first' : 'No products yet'}</p>
                <p className="text-sm text-gray-400 mt-1">{clients.length === 0 ? 'Then add your first product' : 'Hit "+ New product" to get started'}</p>
              </div>
            ) : visibleProducts.map(product => {
              const overall = overallStatus(product)
              const client  = clients.find(c => c.id === product.clientId)
              const nd = nextDueDate(product)
              const nextDueLabel = nd !== Infinity ? (() => {
                const d = new Date(nd)
                const diff = Math.ceil((d - Date.now()) / 86400000)
                const str = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                if (diff < 0)  return { text: `${str} · overdue`, color: 'text-red-500' }
                if (diff <= 7) return { text: `${str} · in ${diff}d`, color: 'text-amber-600' }
                return { text: str, color: 'text-gray-400' }
              })() : null
              return (
                <div key={product.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition cursor-pointer"
                  onClick={() => router.push(`/product/${product.id}`)}>
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {client?.logoUrl
                        ? <img src={client.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={e => e.target.style.display='none'} />
                        : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">{product.clientName?.[0] || '?'}</div>
                      }
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{product.productName}</p>
                          {product.owner && <span className="text-xs text-gray-400 hidden sm:inline">{product.owner}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {(() => { const cs = getCurrentStatus(product); return `${cs.emoji} ${cs.label}` })()}
                          {nextDueLabel && <span className={`ml-2 font-medium ${nextDueLabel.color}`}>· {nextDueLabel.text}</span>}
                        </p>
                        {(() => {
                          const ts = lastActivity(product)
                          if (!ts || ts === new Date(product.createdAt || 0).getTime()) return null
                          const d = new Date(ts)
                          const diff = Math.floor((Date.now() - ts) / 60000)
                          const label = diff < 1    ? 'just now'
                                      : diff < 60   ? `${diff}m ago`
                                      : diff < 1440 ? `${Math.floor(diff/60)}h ago`
                                      : diff < 2880 ? 'yesterday'
                                      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          return <p className="text-xs text-gray-300 mt-0.5">Updated {label}</p>
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StagePipeline product={product} />
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:inline ${STATUS_STYLES[overall].badge}`}>
                        {STATUS_STYLES[overall].label}
                      </span>
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TIMELINE VIEW ───────────────────────────────────────── */}
        {viewMode === 'timeline' && (
          <div className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
                <p className="text-3xl mb-3">📅</p>
                <p className="font-semibold text-gray-700">No upcoming dates</p>
                <p className="text-sm text-gray-400 mt-1">Dates from briefs and pipeline stages will appear here</p>
              </div>
            ) : (() => {
              const byMonth = {}
              upcomingEvents.forEach(e => {
                const key = e.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                if (!byMonth[key]) byMonth[key] = []
                byMonth[key].push(e)
              })
              return Object.entries(byMonth).map(([month, events]) => (
                <div key={month}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{month}</p>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-50">
                    {events.map((e, i) => {
                      const cl = clients.find(c => c.name === e.clientName)
                      const isToday = e.date.toDateString() === new Date().toDateString()
                      const isPast  = e.date < new Date()
                      const diff    = Math.ceil((e.date - Date.now()) / 86400000)
                      return (
                        <div key={i} onClick={() => router.push(`/product/${e.productId}`)}
                          className={`px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition ${isToday ? 'bg-amber-50' : ''}`}>
                          <div className={`w-12 text-center flex-shrink-0 ${isPast ? 'opacity-40' : ''}`}>
                            <p className="text-lg font-bold text-gray-900 leading-none">{e.date.getDate()}</p>
                            <p className="text-xs text-gray-400">{e.date.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                          </div>
                          {cl?.logoUrl
                            ? <img src={cl.logoUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" onError={ex => ex.target.style.display='none'} />
                            : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">{e.clientName?.[0]}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{e.label} — {e.productName}</p>
                            <p className="text-xs text-gray-400">{e.clientName}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {isToday
                              ? <span className="text-xs bg-amber-400 text-white px-2 py-1 rounded-full font-semibold">Today</span>
                              : isPast
                              ? <span className="text-xs text-gray-300">Past</span>
                              : diff <= 7
                              ? <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-full font-semibold">In {diff}d</span>
                              : <span className="text-xs text-gray-400">In {diff}d</span>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

      </div>


      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-4 text-center">
            <p className="text-2xl">🗑️</p>
            <h2 className="text-lg font-bold text-gray-900">Delete "{deleteConfirm.productName}"?</h2>
            <p className="text-sm text-gray-400">This will also delete the client brief. This can't be undone.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => deleteProduct(deleteConfirm)} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* New product modal */}
      {productModal && (
        <Modal title="New product" sub="Select a client, choose the product type, and name it. The brief link will be copied automatically.">
          <div className="space-y-3">
            <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Product type</label>
              <div className="flex gap-2">
                {[{ key: 'syrup', label: '🫙 Syrup' }, { key: 'other', label: '📦 Other' }].map(t => (
                  <button key={t.key} onClick={() => setNewProductType(t.key)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition ${newProductType === t.key ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" placeholder="Product name (e.g. Black Sesame Syrup)" value={newProductName} onChange={e => setNewProductName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createProduct()} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Product owner</label>
              <select value={newProductOwner} onChange={e => setNewProductOwner(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">Assign to...</option>
                {userList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setProductModal(false); setNewProductType('syrup') }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button onClick={createProduct} disabled={!selectedClientId || !newProductName.trim()} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">Create & copy brief link</button>
          </div>
        </Modal>
      )}

      {/* Client modal */}
      {clientModal && (
        <Modal
          title={editingClient ? 'Edit client' : 'New client'}
          sub="This client will be available for all future products."
        >
          <div className="space-y-3">
            <input type="text" placeholder="Client name *" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Client logo</label>
              <div className="flex items-center gap-3">
                {clientForm.logoUrl ? (
                  <div className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50">
                    <img src={clientForm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" onError={e => e.target.style.display='none'} />
                    <button type="button" onClick={() => setClientForm(f => ({ ...f, logoUrl: '' }))} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center hover:bg-black transition">×</button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0 bg-gray-50">
                    <span className="text-2xl text-gray-300">🖼</span>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className={`flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingLogo ? <><span className="animate-spin">⏳</span> Uploading...</> : <><span>📁</span> Upload image</>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  <input type="url" placeholder="Or paste image URL" value={clientForm.logoUrl} onChange={e => setClientForm(f => ({ ...f, logoUrl: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            </div>

            <input type="number" placeholder="Number of establishments" value={clientForm.establishments} onChange={e => setClientForm(f => ({ ...f, establishments: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Markets</label>
              <div className="flex gap-2">
                <select value={marketInput} onChange={e => setMarketInput(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">Select a market...</option>
                  {TOP_MARKETS.filter(m => !(clientForm.markets||[]).includes(m)).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" onClick={addMarket} className="px-4 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition">Add</button>
              </div>
              {marketInput === 'Other' && (
                <input type="text" placeholder="Type country name and press Enter..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = e.target.value.trim(); if (val && !(clientForm.markets||[]).includes(val)) setClientForm(f => ({ ...f, markets: [...(f.markets||[]), val] })); setMarketInput(''); e.target.value = '' } }} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              )}
              {(clientForm.markets||[]).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {clientForm.markets.map(m => (
                    <span key={m} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
                      {m}
                      <button type="button" onClick={() => setClientForm(f => ({ ...f, markets: f.markets.filter(x => x !== m) }))} className="text-gray-400 hover:text-black font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <textarea placeholder="Internal notes (optional)" value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setClientModal(false); setEditingClient(null); setClientForm(EMPTY_CLIENT) }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button onClick={saveClient} disabled={!clientForm.name.trim() || uploadingLogo} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">
              {editingClient ? 'Save changes' : 'Create client'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}