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

function completionPct(product) {
  const completed = STAGES.filter(s => statusOf(product, s.key) === 'complete').length
  return Math.round((completed / STAGES.length) * 100)
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
  if (s.scoping?.phase === 'delivered-tracking') {
    const date = s.scoping?.expectedDelivery
    if (date) {
      const diff = Math.ceil((new Date(date) - Date.now()) / 86400000)
      const dateStr = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const tag = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'today' : `${diff}d`
      return { label: `Ingredients ordered · arrives ${dateStr} · ${tag}`, emoji: '🚛' }
    }
    return { label: 'Ingredients ordered · tracking delivery', emoji: '🚛' }
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
  const [rdItems,          setRdItems]          = useState([])
  const [rdModal,          setRdModal]          = useState(false)
  const [rdForm,           setRdForm]           = useState({})
  const [rdEditId,         setRdEditId]         = useState(null)
  const [rdSaving,         setRdSaving]         = useState(false)
  const [loading,          setLoading]          = useState(false)

  const [filterClient,     setFilterClient]     = useState(null)
  const [filterStatus,     setFilterStatus]     = useState(null)
  const [filterType,       setFilterType]       = useState(null)
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
      const [cSnap, pSnap, rSnap, bSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'),  orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'rdItems'),  orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'briefs')),
      ])
      const clientList  = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const briefMap    = {}
      bSnap.docs.forEach(d => { briefMap[d.id] = d.data() })
      const productList = pSnap.docs.map(d => {
        const p = { id: d.id, ...d.data() }
        if (p.briefId && briefMap[p.briefId]) p.briefFormData = briefMap[p.briefId].formData || {}
        return p
      })
      setClients(clientList)
      setProducts(productList)
      setRdItems(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const saveRdItem = async () => {
    if (!rdForm.productName?.trim() || !rdForm.clientId) return
    setRdSaving(true)
    const client = clients.find(c => c.id === rdForm.clientId)
    let code = rdForm.code
    if (!rdEditId) {
      const existingCodes = new Set([...products.map(p => p.code), ...rdItems.map(r => r.code)].filter(Boolean))
      do {
        code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join('')
      } while (existingCodes.has(code))
    }
    const data = {
      productName: rdForm.productName.trim(), clientId: rdForm.clientId,
      clientName: client?.name || '', status: rdForm.status || 'sampling',
      dueDate: rdForm.dueDate || '', notes: rdForm.notes || '',
      assignedTo: rdForm.assignedTo || '', code,
      createdAt: rdEditId ? rdForm.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      if (rdEditId) {
        await updateDoc(doc(db, 'rdItems', rdEditId), data)
        setRdItems(r => r.map(i => i.id === rdEditId ? { id: rdEditId, ...data } : i))
      } else {
        const ref = await addDoc(collection(db, 'rdItems'), data)
        setRdItems(r => [{ id: ref.id, ...data }, ...r])
      }
    } catch (e) { console.error(e) }
    setRdSaving(false)
    setRdModal(false); setRdForm({}); setRdEditId(null)
  }

  const deleteRdItem = async (id) => {
    await deleteDoc(doc(db, 'rdItems', id))
    setRdItems(r => r.filter(i => i.id !== id))
  }

  const promoteRdItem = async (item) => {
    const client = clients.find(c => c.id === item.clientId)
    if (!client) return
    const existingCodes = new Set(products.map(p => p.code).filter(Boolean))
    let code = item.code
    if (!code || existingCodes.has(code)) {
      do {
        code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join('')
      } while (existingCodes.has(code))
    }
    try {
      const briefRef = await addDoc(collection(db, 'briefs'), {
        clientId: client.id, clientName: client.name,
        clientLogoUrl: client.logoUrl || '', clientMarkets: client.markets || [],
        productName: item.productName, productType: 'syrup', code,
        submitted: false, formData: {}, createdAt: new Date().toISOString(),
      })
      const productRef = await addDoc(collection(db, 'products'), {
        clientId: client.id, clientName: client.name,
        productName: item.productName, productType: 'syrup',
        owner: item.assignedTo || currentUser?.name || '',
        code, briefId: briefRef.id, createdAt: new Date().toISOString(),
        promotedFromRd: item.id,
        stages: {
          brief: { status: 'in-progress' }, scoping: { status: 'not-started' },
          lab: { status: 'not-started' }, sampleSending: { status: 'not-started' },
          clientSignOff: { status: 'not-started' }, validation: { status: 'not-started' },
          batchDecision: { status: 'not-started' }, labTesting: { status: 'not-started' },
          labelling: { status: 'not-started' }, release: { status: 'not-started' },
        },
      })
      await updateDoc(briefRef, { productId: productRef.id })
      await deleteDoc(doc(db, 'rdItems', item.id))
      setRdItems(r => r.filter(i => i.id !== item.id))
      await fetchAll()
      navigator.clipboard.writeText(`${window.location.origin}/brief/${briefRef.id}`)
      setCopied(briefRef.id); setTimeout(() => setCopied(null), 2500)
      setExpanded(productRef.id)
    } catch (e) { console.error(e); alert('Error promoting item') }
  }

  // ── Create product ────────────────────────────────────────────────────────

  const createProduct = async () => {
    if (!selectedClientId || !newProductName.trim()) return
    const client = clients.find(c => c.id === selectedClientId)
    const existing = new Set(products.map(p => p.code).filter(Boolean))
    let code
    do {
      code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join('')
    } while (existing.has(code))
    try {
      const briefRef = await addDoc(collection(db, 'briefs'), {
        clientId: selectedClientId, clientName: client.name,
        clientLogoUrl: client.logoUrl || '', clientMarkets: client.markets || [],
        productName: newProductName.trim(), productType: newProductType, code,
        submitted: false, formData: { productCategory: newProductType }, createdAt: new Date().toISOString(),
      })
      const productRef = await addDoc(collection(db, 'products'), {
        clientId: selectedClientId, clientName: client.name,
        productName: newProductName.trim(), productType: newProductType,
        owner: newProductOwner || currentUser?.name || '',
        code, briefId: briefRef.id, createdAt: new Date().toISOString(),
        stages: {
          brief: { status: 'in-progress' }, scoping: { status: 'not-started' },
          lab: { status: 'not-started' }, sampleSending: { status: 'not-started' },
          clientSignOff: { status: 'not-started' }, validation: { status: 'not-started' },
          batchDecision: { status: 'not-started' }, labTesting: { status: 'not-started' },
          labelling: { status: 'not-started' }, release: { status: 'not-started' },
        },
      })
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

  const visibleProducts = products
    .filter(p => !filterClient || p.clientId === filterClient.id)
    .filter(p => !filterStatus || overallStatus(p) === filterStatus)
    .filter(p => !filterType   || p.productType === filterType)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'activity') return lastActivity(b) - lastActivity(a)
      if (sortBy === 'due')      return nextDueDate(a) - nextDueDate(b)
      if (sortBy === 'name')     return a.productName.localeCompare(b.productName)
      if (sortBy === 'client')   return (a.clientName || '').localeCompare(b.clientName || '')
      if (sortBy === 'pct-asc')  return completionPct(a) - completionPct(b)
      if (sortBy === 'pct-desc') return completionPct(b) - completionPct(a)
      return 0
    })

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-8">
      <Head><title>Bloomin — NPD</title></Head>
      <img src="/logo.png" alt="Bloomin" className="h-14 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
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
          <img src="/logo.png" alt="Bloomin" className="h-6 object-contain brightness-0 invert flex-shrink-0" onError={e => e.target.style.display='none'} />
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setProductModal(true)} disabled={clients.length === 0}
              className="px-4 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              + New product
            </button>
            {currentUser && (
              <div className="relative">
                <button onClick={() => setUserMenuOpen(o => !o)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
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
                        <button onClick={() => { router.push('/suppliers'); setUserMenuOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">View suppliers</button>
                        <button onClick={() => { setEditingClient(null); setClientForm(EMPTY_CLIENT); setClientModal(true); setUserMenuOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">Add new client</button>
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button onClick={() => { setAuthed(false); setCurrentUser(null); localStorage.removeItem('npd_auth'); localStorage.removeItem('npd_user'); setUserMenuOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">Sign out</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full space-y-6">

        {/* Controls bar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <button onClick={() => { setViewMode('list'); setFilterClient(null); setFilterStatus(null); setFilterType(null) }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${viewMode !== 'rd' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                Active ({products.length})
              </button>
              <button onClick={() => setViewMode('rd')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${viewMode === 'rd' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                R&D ({rdItems.length})
              </button>
              {viewMode !== 'rd' && clients.map(c => {
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
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {viewMode !== 'rd' && (
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-black text-gray-600">
                  <option value="activity">↻ Latest activity</option>
                  <option value="due">⏱ Next due date</option>
                  <option value="name">A–Z Name</option>
                  <option value="client">A–Z Client</option>
                  <option value="pct-desc">% Complete ↓</option>
                  <option value="pct-asc">% Complete ↑</option>
                </select>
              )}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-sm transition ${viewMode === 'list' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>☰</button>
              </div>
              <button onClick={() => router.push('/calendar')} title="Open calendar"
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-black transition text-sm">
                📅
              </button>
            </div>
          </div>

          {viewMode !== 'rd' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Filter:</span>
              {[
                { val: 'in-progress', label: '🔄 In progress', style: 'bg-amber-50 text-amber-700 border-amber-200' },
                { val: 'not-started', label: '⏸ Not started',  style: 'bg-gray-50 text-gray-500 border-gray-200'   },
                { val: 'complete',    label: '✓ Complete',      style: 'bg-green-50 text-green-700 border-green-200' },
              ].map(({ val, label, style }) => (
                <button key={val} onClick={() => setFilterStatus(filterStatus === val ? null : val)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${filterStatus === val ? style : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {label}
                </button>
              ))}
              <div className="w-px h-4 bg-gray-200 mx-1" />
              {[
                { val: 'syrup', label: '🫙 Syrup' },
                { val: 'drink', label: '🥤 Drink' },
                { val: 'other', label: '📦 Other' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => setFilterType(filterType === val ? null : val)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${filterType === val ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {label}
                </button>
              ))}
              {(filterStatus || filterType || filterClient) && (
                <button onClick={() => { setFilterStatus(null); setFilterType(null); setFilterClient(null) }}
                  className="text-xs text-gray-400 hover:text-black transition ml-1 underline underline-offset-2">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {visibleProducts.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
                <p className="text-3xl mb-3">🌿</p>
                <p className="font-semibold text-gray-700">{clients.length === 0 ? 'Create a client first' : 'No products yet'}</p>
                <p className="text-sm text-gray-400 mt-1">{clients.length === 0 ? 'Then add your first product' : 'Hit "+ New product" to get started'}</p>
              </div>
            ) : visibleProducts.map(product => {
              const client = clients.find(c => c.id === product.clientId)
              const pct    = completionPct(product)
              const nd     = nextDueDate(product)
              const nextDueLabel = nd !== Infinity ? (() => {
                const d    = new Date(nd)
                const diff = Math.ceil((d - Date.now()) / 86400000)
                const str  = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
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
                          {product.code && <span className="text-xs font-mono font-bold text-gray-400 flex-shrink-0">#{product.code}</span>}
                          {product.owner && <span className="text-xs text-gray-400 hidden sm:inline">{product.owner}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {(() => { const cs = getCurrentStatus(product); return `${cs.emoji} ${cs.label}` })()}
                          {nextDueLabel && <span className={`ml-2 font-medium ${nextDueLabel.color}`}>· {nextDueLabel.text}</span>}
                        </p>
                        {(() => {
                          const ts   = lastActivity(product)
                          if (!ts || ts === new Date(product.createdAt || 0).getTime()) return null
                          const d    = new Date(ts)
                          const diff = Math.floor((Date.now() - ts) / 60000)
                          const label = diff < 1 ? 'just now' : diff < 60 ? `${diff}m ago` : diff < 1440 ? `${Math.floor(diff/60)}h ago` : diff < 2880 ? 'yesterday' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          return <p className="text-xs text-gray-300 mt-0.5">Updated {label}</p>
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StagePipeline product={product} />
                      <div className="hidden sm:flex flex-col items-end gap-1 w-16">
                        <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pct}%</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── R&D VIEW ──────────────────────────────────────────────────────── */}
        {viewMode === 'rd' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 px-1">Pre-pipeline — promote to NPD when ready</p>
              {authed && (
                <button onClick={() => { setRdForm({}); setRdEditId(null); setRdModal(true) }}
                  className="text-xs px-3 py-1.5 bg-black text-white rounded-lg font-semibold hover:bg-gray-900 transition">
                  + Add item
                </button>
              )}
            </div>
            {rdItems.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
                <p className="text-3xl mb-3">🧫</p>
                <p className="font-semibold text-gray-700">No R&D items yet</p>
                <p className="text-sm text-gray-400 mt-1">Add products being sampled before brief stage</p>
              </div>
            ) : rdItems.map(item => {
              const client = clients.find(c => c.id === item.clientId)
              const statusStyles = {
                sampling: 'bg-blue-50 text-blue-700 border-blue-200', tasting: 'bg-purple-50 text-purple-700 border-purple-200',
                'on-hold': 'bg-amber-50 text-amber-700 border-amber-200', complete: 'bg-green-50 text-green-700 border-green-200',
                'not-started': 'bg-gray-50 text-gray-500 border-gray-200',
              }
              const statusLabels = { sampling: 'Sampling', tasting: 'Being Tasted', 'on-hold': 'On Hold', complete: 'Complete', 'not-started': 'Not Started' }
              return (
                <div key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition">
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {client?.logoUrl
                        ? <img src={client.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={e => e.target.style.display='none'} />
                        : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">{item.clientName?.[0] || '?'}</div>
                      }
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{item.productName}</p>
                          {item.code && <span className="text-xs font-mono font-bold text-gray-400 flex-shrink-0">#{item.code}</span>}
                          {item.assignedTo && <span className="text-xs text-gray-400 hidden sm:inline">{item.assignedTo}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.clientName}{item.dueDate ? ` · ${new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
                        </p>
                        {item.notes && <p className="text-xs text-gray-300 truncate mt-0.5">{item.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={item.status}
                        onChange={async e => {
                          const s = e.target.value
                          await updateDoc(doc(db, 'rdItems', item.id), { status: s, updatedAt: new Date().toISOString() })
                          setRdItems(r => r.map(i => i.id === item.id ? { ...i, status: s } : i))
                        }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${statusStyles[item.status] || statusStyles['not-started']}`}>
                        {Object.entries(statusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button onClick={() => { setRdForm(item); setRdEditId(item.id); setRdModal(true) }} className="text-xs text-gray-400 hover:text-black transition">Edit</button>
                      <button onClick={() => promoteRdItem(item)} className="text-xs px-3 py-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition font-semibold whitespace-nowrap">→ NPD</button>
                      <button onClick={() => deleteRdItem(item.id)} className="text-gray-300 hover:text-red-500 transition text-base leading-none">✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
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
                {[{ key: 'syrup', label: '🫙 Syrup' }, { key: 'drink', label: '🥤 Drink' }, { key: 'other', label: '📦 Other' }].map(t => (
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
        <Modal title={editingClient ? 'Edit client' : 'New client'} sub="This client will be available for all future products.">
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

      {/* R&D modal */}
      {rdModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{rdEditId ? 'Edit R&D item' : 'Add R&D item'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product name *</label>
                <input value={rdForm.productName || ''} onChange={e => setRdForm(f => ({ ...f, productName: e.target.value }))} placeholder="e.g. Blueberry Syrup" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client *</label>
                <select value={rdForm.clientId || ''} onChange={e => setRdForm(f => ({ ...f, clientId: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
                <select value={rdForm.status || 'sampling'} onChange={e => setRdForm(f => ({ ...f, status: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="not-started">Not Started</option>
                  <option value="sampling">Sampling</option>
                  <option value="tasting">Being Tasted</option>
                  <option value="on-hold">On Hold</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Due date</label>
                  <input type="date" value={rdForm.dueDate || ''} onChange={e => setRdForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned to</label>
                  <input value={rdForm.assignedTo || ''} onChange={e => setRdForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="e.g. Dima" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea rows={3} value={rdForm.notes || ''} onChange={e => setRdForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Being tasted — waiting on client feedback." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setRdModal(false); setRdForm({}); setRdEditId(null) }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveRdItem} disabled={rdSaving || !rdForm.productName?.trim() || !rdForm.clientId} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">
                {rdSaving ? 'Saving...' : rdEditId ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}