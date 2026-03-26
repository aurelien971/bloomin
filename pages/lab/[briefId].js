import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { db, storage } from '../../lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore'

// ─── Empty state ──────────────────────────────────────────────────────────────
const EMPTY_DATA = {
  requiredLitres: '', requiredLitresUnit: 'L',
  ingredients: [
    { ingredient: '', supplier: '', unit: 'KG', qty: '' },
    { ingredient: '', supplier: '', unit: 'KG', qty: '' },
    { ingredient: '', supplier: '', unit: 'KG', qty: '' },
    { ingredient: '', supplier: '', unit: 'KG', qty: '' },
  ],
  fillMethod: '', heatingRequired: '', maxTemp: '',
  steps: ['', '', '', '', ''],  // 5 steps by default
  criticalAdditionNotes: '', coolingPoint: '', processNotes: '',
  analytical: {
    brix: { min: '', target: '', max: '', conditions: 'Must only be done at 20°C' },
    ph:   { min: '', target: '', max: '', conditions: 'Must only be done at 20°C' },
  },
  fillWeightPerVolume: '', density: '',
  colourNeat: '', colourInDrink: '', appearanceNotes: '',
  primaryFlavour: '', secondaryFlavour: '', aroma: '', texture: '',
  keyTopNotes: '', aftertaste: '', sweetness: '', acidity: '',
  offNotes: '', offNotesDetail: '', balanceNotes: '',
  criticalAttributes: [],  // starts empty, user adds
  doseRate: '', applicationIssues: '',
  applicationTests: {},
  hotOrColdProcess: '',
  productionFacilities: [],
  suitableCertifications: {},
  estimatedCookTime: '', productionLimitations: '',
  retainSampleKept: '', sampleLocation: '', sampleLabel: '',
  retainSamplePhotoUrl: '', drinkPhotoUrl: '',
}

const UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'OZ']

// 4 merged sections
const SECTIONS = [
  { key: 'recipe',      label: 'Recipe & Process',   icon: '🧪' },
  { key: 'specs',       label: 'Specs & Sensory',    icon: '📊' },
  { key: 'application', label: 'Tasting & Application', icon: '☕' },
  { key: 'production',  label: 'Production',         icon: '🏭' },
]

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Radio({ label, name, value, onChange, options, disabled, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <label key={o} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => !disabled && onChange(o)} className="hidden" />
            {o}
          </label>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', hint, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 2, hint, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} rows={rows} disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  )
}

function BriefRef({ items, open, onToggle }) {
  const filled = items.filter(i => { const v = i.value; if (!v) return false; if (Array.isArray(v)) return v.length > 0; return String(v).trim() !== '' })
  if (filled.length === 0) return null
  return (
    <div className="border border-blue-100 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 hover:bg-blue-100 transition text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs">📋</span>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Brief reference</span>
          <span className="text-xs text-blue-400">({filled.length} {filled.length === 1 ? 'item' : 'items'})</span>
        </div>
        <span className="text-blue-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {filled.map(item => (
            <div key={item.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className="text-sm text-gray-800">{Array.isArray(item.value) ? item.value.join(', ') : item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LabSheet() {
  const router = useRouter()
  const { briefId } = router.query

  const [brief,             setBrief]             = useState(null)
  const [versions,          setVersions]          = useState([])
  const [activeId,          setActiveId]          = useState(null)
  const [data,              setData]              = useState(EMPTY_DATA)
  const [isSignedOff,       setIsSignedOff]       = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [versionModal,      setVersionModal]      = useState(false)
  const [versionNote,       setVersionNote]       = useState('')
  const [versionName,       setVersionName]       = useState('')
  const [versionCook,       setVersionCook]       = useState('')
  const [signOffModal,      setSignOffModal]      = useState(false)
  const [uploading,         setUploading]         = useState({})
  const [scopedIngredients, setScopedIngredients] = useState([])
  const [userList,          setUserList]          = useState([])
  const [factories,         setFactories]         = useState([])  // from Firestore
  const [nextUid,           setNextUid]           = useState(null)
  const [activeSection,     setActiveSection]     = useState('recipe')
  const [briefOpen,         setBriefOpen]         = useState({ recipe: true, specs: true, application: true, production: true })
  const toggleBrief = (s) => setBriefOpen(b => ({ ...b, [s]: !b[s] }))

  useEffect(() => { if (briefId) init() }, [briefId])

  const init = async () => {
    const bSnap = await getDoc(doc(db, 'briefs', briefId))
    if (bSnap.exists()) {
      const b = { id: bSnap.id, ...bSnap.data() }
      setBrief(b)
      if (b.productId) {
        try {
          const sSnap = await getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', b.productId)))
          if (!sSnap.empty) {
            const scoping = sSnap.docs[0].data()
            if (scoping.ingredients?.length) setScopedIngredients(scoping.ingredients.filter(i => i.name?.trim()))
          }
        } catch (e) { console.error(e) }
      }
    }
    const vSnap = await getDocs(query(collection(db, 'labSheets'), where('briefId', '==', briefId), orderBy('createdAt', 'desc')))
    const docs = vSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    setVersions(docs)
    if (docs.length > 0) {
      setActiveId(docs[0].id); setData({ ...EMPTY_DATA, ...docs[0].data }); setIsSignedOff(docs[0].status === 'signed-off')
    }
    // Get product code for sample UID labelling
    try {
      const bSnap2 = await getDoc(doc(db, 'briefs', briefId))
      const productId = bSnap2.data()?.productId
      if (productId) {
        const pSnap = await getDoc(doc(db, 'products', productId))
        if (pSnap.exists()) setNextUid(pSnap.data().code || null)
      }
    } catch (e) { console.error(e) }
    // Load cooks for version modal
    try {
      const uSnap = await getDocs(collection(db, 'users'))
      const cooks = uSnap.docs.map(d => d.data()).filter(u => u.role === 'Cook').map(u => u.name).sort()
      setUserList(cooks)
    } catch (e) { console.error(e) }
    // Load factories
    try {
      const fSnap = await getDocs(collection(db, 'factories'))
      setFactories(fSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
  }

  const loadVersion = (v) => { setActiveId(v.id); setData({ ...EMPTY_DATA, ...v.data }); setIsSignedOff(v.status === 'signed-off') }
  const set = (key, val) => setData(d => ({ ...d, [key]: val }))
  const setAnalytical = (row, field, val) => setData(d => ({ ...d, analytical: { ...d.analytical, [row]: { ...(d.analytical?.[row] || {}), [field]: val } } }))

  const saveVersion = async () => {
    if (!brief || !versionName.trim()) return
    setSaving(true)
    const vNum = versions.length + 1
    const sampleUid = nextUid ? `${nextUid}-V${vNum}` : `V${vNum}`
    const newDoc = {
      briefId, productName: brief.productName, clientName: brief.clientName,
      versionNumber: vNum, versionName: versionName.trim(),
      versionNote: versionNote.trim(), versionCook: versionCook,
      sampleUid,
      status: 'draft', createdAt: new Date().toISOString(), data,
    }
    const docRef = await addDoc(collection(db, 'labSheets'), newDoc)
    const nv = { id: docRef.id, ...newDoc }
    setVersions(v => [nv, ...v]); setActiveId(docRef.id); setIsSignedOff(false)
    setVersionModal(false); setVersionNote(''); setVersionName(''); setVersionCook('')
    setSaving(false)
  }

  const signOff = async () => {
    if (!activeId) return
    await updateDoc(doc(db, 'labSheets', activeId), { status: 'signed-off' })
    setVersions(vs => vs.map(v => v.id === activeId ? { ...v, status: 'signed-off' } : v))
    setIsSignedOff(true); setSignOffModal(false)
    if (brief?.productId) {
      try {
        await updateDoc(doc(db, 'products', brief.productId), {
          'stages.lab.status': 'complete',
          'stages.lab.signedOffVersion': versions.find(v => v.id === activeId)?.versionNumber,
          'stages.sampleSending.status': 'in-progress',
        })
      } catch (e) { console.error(e) }
    }
  }

  const autosave = async () => {
    if (!activeId || isSignedOff) return
    setSaving(true)
    try { await updateDoc(doc(db, 'labSheets', activeId), { data }) }
    catch (e) { console.error(e) }
    setSaving(false)
  }

  const setIngredient = (i, field, val) => {
    const next = [...data.ingredients]; next[i] = { ...next[i], [field]: val }; set('ingredients', next)
  }

  const uploadPhoto = async (file, field) => {
    if (!file) return
    setUploading(u => ({ ...u, [field]: true }))
    try {
      const sRef = storageRef(storage, `retain-samples/${briefId}/${field}-${Date.now()}`)
      await uploadBytes(sRef, file); const url = await getDownloadURL(sRef); set(field, url)
    } catch (e) { console.error(e) }
    setUploading(u => ({ ...u, [field]: false }))
  }

  const [autoFill,   setAutoFill]   = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal,  setRenameVal]  = useState('')

  // ── Section completion checks ─────────────────────────────────────────────
  const sectionDone = {
    recipe:      data.ingredients.some(r => r.ingredient.trim()) && data.steps.some(s => s.trim()),
    specs:       !!(data.analytical?.brix?.target && data.fillWeightPerVolume),
    application: Object.values(data.applicationTests || {}).some(t => t.status === 'Tested' && t.pass),
    production:  !!(data.hotOrColdProcess && data.productionFacilities?.length > 0),
  }
  const sampleDone = !!data.retainSampleKept
  const allDone = Object.values(sectionDone).every(Boolean) && sampleDone

  const readOnly = isSignedOff
  const fd = brief?.formData || {}

  if (!brief) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <Head><title>Lab Sheet — {brief.productName}</title></Head>

      {/* Header — Save only, no sign off */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-6 sm:h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <button onClick={() => router.back()} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0 hidden sm:block" />
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-semibold text-white truncate">{brief.productName}</p>
              <p className="text-xs text-white/50">{brief.clientName} · Lab Development</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {readOnly
              ? <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">Ready for sign-off ✓</span>
              : <button onClick={autosave} disabled={saving || !activeId}
                  className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
            }
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex gap-6 sm:gap-8">

        {/* ── Version sidebar ────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 hidden sm:block sticky top-20 self-start space-y-2">

          {versions.length === 0 ? (
            <button onClick={() => setVersionModal(true)}
              className="w-full px-3 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition text-center">
              + Create recipe
            </button>
          ) : (
            <>
              <button onClick={() => setVersionModal(true)}
                className="w-full px-3 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-gray-900 transition">
                + New version
              </button>
              <div className="space-y-1 pt-1">
                {versions.map(v => (
                  <div key={v.id} className="relative group">
                    <button onClick={() => loadVersion(v)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition ${activeId === v.id ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-gray-400">V{v.versionNumber}</span>
                        <div className="flex items-center gap-1">
                          {v.sampleUid && <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{v.sampleUid}</span>}
                          {v.status === 'signed-off' && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">✓</span>}
                        </div>
                      </div>
                      {renamingId === v.id ? (
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (renameVal.trim()) {
                                await updateDoc(doc(db, 'labSheets', v.id), { versionName: renameVal.trim() })
                                setVersions(vs => vs.map(x => x.id === v.id ? { ...x, versionName: renameVal.trim() } : x))
                              }
                              setRenamingId(null)
                            }
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          onBlur={async () => {
                            if (renameVal.trim()) {
                              await updateDoc(doc(db, 'labSheets', v.id), { versionName: renameVal.trim() })
                              setVersions(vs => vs.map(x => x.id === v.id ? { ...x, versionName: renameVal.trim() } : x))
                            }
                            setRenamingId(null)
                          }}
                          className="w-full bg-white text-gray-900 text-sm font-semibold px-2 py-1 rounded-lg border border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      ) : (
                        <p className={`text-sm font-semibold truncate ${activeId === v.id ? 'text-white' : 'text-gray-900'}`}>{v.versionName}</p>
                      )}
                      {v.versionNote && <p className={`text-xs truncate mt-0.5 ${activeId === v.id ? 'text-white/50' : 'text-gray-400'}`}>{v.versionNote}</p>}
                      {v.versionCook && <p className={`text-xs mt-0.5 ${activeId === v.id ? 'text-white/40' : 'text-gray-300'}`}>by {v.versionCook}</p>}
                    </button>
                    {/* 3-dot rename button */}
                    {!readOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingId(v.id); setRenameVal(v.versionName) }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 text-xs"
                        title="Rename version">
                        ···
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Auto-fill banner */}
          {!readOnly && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-base flex-shrink-0">✨</div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">Auto-fill from notes, PDF, Excel or voice</p>
                  <p className="text-xs text-gray-500 mt-0.5">Drop a cook report, paste transcript, or speak your observations — AI extracts the data</p>
                </div>
              </div>
              <button onClick={() => setAutoFill(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition shadow-sm shadow-violet-200 flex-shrink-0">
                ✨ Auto-fill lab sheet
              </button>
            </div>
          )}

          {/* Product title card */}
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{brief.clientName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-lg font-bold text-gray-900">{brief.productName} — Lab Development Sheet</h1>
              {nextUid && <span className="text-sm font-mono font-bold text-gray-400">#{nextUid.split('-')[0]}</span>}
            </div>
            {versions.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">No recipe yet — click "+ Create recipe" to get started.</p>
            )}
            {versions.length > 0 && !activeId && (
              <p className="text-sm text-gray-400 mt-1">Select a version from the sidebar.</p>
            )}
          </div>

          {/* Only show form if a version is active */}
          {activeId && (
            <>
              {readOnly && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-green-800">This version is marked ready — read only</p>
                  <button onClick={() => setVersionModal(true)} className="text-xs text-green-700 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition">+ New version</button>
                </div>
              )}

              {/* Section tabs */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex border-b border-gray-100">
                  {SECTIONS.map(s => (
                    <button key={s.key} onClick={() => setActiveSection(s.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
                        activeSection === s.key
                          ? 'border-black text-black'
                          : 'border-transparent text-gray-400 hover:text-gray-700'
                      }`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sectionDone[s.key] ? 'bg-green-400' : 'bg-gray-200'}`} />
                      <span className="hidden sm:inline">{s.label}</span>
                      <span className="sm:hidden">{s.icon}</span>
                    </button>
                  ))}
                </div>

                <div className="px-5 py-5 space-y-6">

                  {/* ── RECIPE & PROCESS ──────────────────────────────────── */}
                  {activeSection === 'recipe' && <>
                    <BriefRef open={briefOpen.recipe} onToggle={() => toggleBrief('recipe')}
                      items={[
                        { label: 'Dietary', value: fd.dietary },
                        { label: 'Allergens', value: fd.allergens },
                        { label: 'Restrictions', value: fd.ingredientRestrictions },
                        { label: 'Sugar base', value: fd.sugarBase },
                        { label: 'Preservatives', value: fd.preservatives },
                        { label: 'Shelf life', value: fd.shelfLife },
                        { label: 'Storage', value: fd.storage },
                      ]}
                    />

                    {/* Batch size gate */}
                    {(() => {
                      const hasIngredients = data.ingredients?.some(r => r.ingredient?.trim())
                      const batchLocked = hasIngredients && data.batchSizeLocked
                      return (
                        <div className={`rounded-xl border px-5 py-4 ${!data.requiredLitres ? 'border-amber-200 bg-amber-50' : batchLocked ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Batch size *</p>
                            {batchLocked && (
                              <button onClick={() => {
                                if (window.confirm('Changing the batch size will reset all ingredient quantities. Are you sure?')) {
                                  set('batchSizeLocked', false)
                                  set('ingredients', data.ingredients.map(r => ({ ...r, qty: '', qty1000L: undefined })))
                                }
                              }} className="text-xs text-gray-400 hover:text-black transition font-medium">
                                ✎ Change (resets quantities)
                              </button>
                            )}
                          </div>
                          {batchLocked ? (
                            <p className="text-sm font-semibold text-green-800">🔒 {data.requiredLitres}{data.requiredLitresUnit || 'L'} — locked</p>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input type="number" min="0" placeholder="e.g. 5" value={data.requiredLitres}
                                onChange={e => set('requiredLitres', e.target.value)} disabled={readOnly}
                                className={`w-32 px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100 ${!data.requiredLitres && !readOnly ? 'border-amber-300' : 'border-gray-200'}`} />
                              <select value={data.requiredLitresUnit || 'L'} onChange={e => set('requiredLitresUnit', e.target.value)} disabled={readOnly}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white disabled:bg-gray-100">
                                {['L', 'mL'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              {data.requiredLitres && !readOnly && (
                                <button onClick={() => set('batchSizeLocked', true)}
                                  className="px-3 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-gray-900 transition">
                                  Lock size
                                </button>
                              )}
                              {data.requiredLitres && <p className="text-sm text-gray-500">Quantities below = for <strong>{data.requiredLitres}{data.requiredLitresUnit || 'L'}</strong></p>}
                            </div>
                          )}
                          {!data.requiredLitres && !readOnly && <p className="text-xs text-amber-600 mt-2">Set batch size before adding ingredients</p>}
                        </div>
                      )
                    })()}

                    {/* Ingredient table */}
                    <div className={!data.requiredLitres && !readOnly ? 'opacity-40 pointer-events-none select-none' : ''}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b border-gray-100">
                              {['Ingredient', 'Supplier', 'Unit', `Qty for ${data.requiredLitres || '?'}${data.requiredLitresUnit || 'L'}`, 'Qty / 1000L'].map(h => (
                                <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
                              ))}
                              {!readOnly && <th />}
                            </tr>
                          </thead>
                          <tbody>
                            {data.ingredients.map((row, i) => {
                              const batchL = parseFloat(data.requiredLitres) * (data.requiredLitresUnit === 'mL' ? 0.001 : 1)
                              const autoQty1000 = row.qty && batchL > 0
                                ? (() => { const v = parseFloat(row.qty) * (1000 / batchL); return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2) })()
                                : ''
                              return (
                              <tr key={i}>
                                <td className="pr-2 pb-2">
                                  <IngredientCombobox value={row.ingredient} disabled={readOnly} suggestions={scopedIngredients}
                                    usedNames={data.ingredients.map(r => r.ingredient.trim().toLowerCase())}
                                    onChange={val => setIngredient(i, 'ingredient', val)}
                                    onSelect={s => { const n = [...data.ingredients]; n[i] = { ...n[i], ingredient: s.name, supplier: s.supplierName || n[i].supplier }; set('ingredients', n) }}
                                  />
                                </td>
                                <td className="pr-2 pb-2"><input disabled={readOnly} value={row.supplier} onChange={e => setIngredient(i, 'supplier', e.target.value)} placeholder="Supplier" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 min-w-[100px]" /></td>
                                <td className="pr-2 pb-2">
                                  <select disabled={readOnly} value={row.unit} onChange={e => setIngredient(i, 'unit', e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-50">
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </td>
                                <td className="pr-2 pb-2"><input disabled={readOnly} value={row.qty} onChange={e => setIngredient(i, 'qty', e.target.value)} placeholder="—" className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none disabled:bg-gray-50 text-right" /></td>
                                <td className="pr-2 pb-2">
                                  <input
                                    disabled={readOnly}
                                    value={row.qty1000L !== undefined ? row.qty1000L : autoQty1000}
                                    onChange={e => setIngredient(i, 'qty1000L', e.target.value)}
                                    onFocus={() => { if (row.qty1000L === undefined && autoQty1000) setIngredient(i, 'qty1000L', autoQty1000) }}
                                    placeholder={autoQty1000 || '—'}
                                    className={`w-24 px-3 py-2 rounded-lg border text-sm focus:outline-none text-right disabled:bg-gray-50 ${row.qty1000L !== undefined && row.qty1000L !== autoQty1000 ? 'border-amber-300 bg-amber-50' : 'border-blue-100 bg-blue-50 text-blue-700'}`}
                                  />
                                </td>
                                {!readOnly && <td className="pb-2"><button onClick={() => set('ingredients', data.ingredients.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition text-lg px-1">×</button></td>}
                              </tr>
                            )})}
                          </tbody>
                        </table>
                      </div>
                      {!readOnly && <button onClick={() => set('ingredients', [...data.ingredients, { ingredient: '', supplier: '', unit: 'KG', qty: '' }])} className="mt-3 text-sm text-gray-500 hover:text-black font-medium transition">+ Add row</button>}
                    </div>

                    <div className="border-t border-gray-100 pt-5 space-y-5">
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-red-700">⚠ Maximum cook time: 90 minutes. No 3-hour steeps.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Radio label="Heating required?" name="heatingRequired" value={data.heatingRequired} onChange={v => set('heatingRequired', v)} options={['Yes', 'No']} disabled={readOnly} />
                        {data.heatingRequired === 'Yes' && <Field label="Max temperature (°C)" value={data.maxTemp} onChange={v => set('maxTemp', v)} placeholder="e.g. 85" disabled={readOnly} />}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cooking steps</label>
                        <p className="text-xs text-gray-400 mb-3">Be specific — temps, times, order of addition.</p>
                        <div className="space-y-2">
                          {data.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
                              <input disabled={readOnly} value={step} onChange={e => { const n = [...data.steps]; n[i] = e.target.value; set('steps', n) }}
                                placeholder={`Step ${i + 1}...`} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                              {!readOnly && <button onClick={() => set('steps', data.steps.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition text-lg">×</button>}
                            </div>
                          ))}
                        </div>
                        {!readOnly && <button onClick={() => set('steps', [...data.steps, ''])} className="mt-3 text-sm text-gray-500 hover:text-black font-medium transition">+ Add step</button>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Critical addition points" value={data.criticalAdditionNotes || ''} onChange={v => set('criticalAdditionNotes', v)}
                          placeholder="e.g. Flavours after step 3, acids last" disabled={readOnly}
                          hint="When to add flavours, acids, colours — anything order-sensitive." />
                        <Field label="Cooling point before fill (°C)" value={data.coolingPoint || ''} onChange={v => set('coolingPoint', v)} placeholder="e.g. 40°C" disabled={readOnly} />
                      </div>
                      <TextArea label="Other critical process notes" value={data.processNotes || ''} onChange={v => set('processNotes', v)} disabled={readOnly} />
                    </div>
                  </>}

                  {/* ── SPECS & SENSORY ───────────────────────────────────── */}
                  {activeSection === 'specs' && <>
                    <BriefRef open={briefOpen.specs} onToggle={() => toggleBrief('specs')}
                      items={[
                        { label: 'Bottle volume', value: fd.bottleVolume },
                        { label: 'Syrup colour', value: fd.syrupColour },
                        { label: 'End drink colour', value: fd.endDrinkColour },
                        { label: 'Clarity', value: fd.clarity },
                        { label: 'Primary flavour', value: fd.primaryFlavour },
                        { label: 'Secondary notes', value: fd.secondaryFlavour },
                        { label: 'Sweetness target', value: fd.sweetness },
                        { label: 'Aftertaste', value: fd.aftertaste },
                        { label: 'Flavour exclusions', value: fd.flavourExclusions },
                      ]}
                    />

                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Analytical Values</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 text-left w-20"></th>
                            {['Min', 'Target', 'Max', 'Conditions'].map(h => <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-3 text-left">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {[{ key: 'brix', label: 'Brix' }, { key: 'ph', label: 'pH' }].map(({ key, label }) => {
                            const row = data.analytical?.[key] || { min: '', target: '', max: '', conditions: '' }
                            return (
                              <tr key={key} className="border-t border-gray-50">
                                <td className="py-2.5 pr-4 font-bold text-gray-700 text-sm">{label}</td>
                                {['min', 'target', 'max'].map(f => (
                                  <td key={f} className="py-2 pr-3">
                                    <input disabled={readOnly} value={row[f]} onChange={e => setAnalytical(key, f, e.target.value)} placeholder="—"
                                      className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 text-center" />
                                  </td>
                                ))}
                                <td className="py-2"><input disabled={readOnly} value={row.conditions} onChange={e => setAnalytical(key, 'conditions', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                      <Field label="Fill weight per volume *" value={data.fillWeightPerVolume} onChange={v => set('fillWeightPerVolume', v)} placeholder="e.g. 755g per 750ml bottle" disabled={readOnly} hint="Weigh a filled bottle — note the volume." />
                      <Field label="Density (g/mL)" value={data.density} onChange={v => set('density', v)} placeholder="e.g. 1.007" disabled={readOnly} hint="= weight ÷ volume. e.g. 755 ÷ 750 = 1.007" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                      <Field label="🫙 Syrup colour (in the bottle)" value={data.colourNeat} onChange={v => set('colourNeat', v)}
                        placeholder={fd.syrupColour ? `Brief: "${fd.syrupColour}"` : 'e.g. Deep inky black'} disabled={readOnly} />
                      <Field label={`🥤 End drink colour (${fd.endDrinkType || 'in the glass'})`} value={data.colourInDrink} onChange={v => set('colourInDrink', v)}
                        placeholder={fd.endDrinkColour ? `Brief: "${fd.endDrinkColour}"` : 'e.g. Warm grey-brown latte'} disabled={readOnly} />
                    </div>
                    <TextArea label="Appearance notes" value={data.appearanceNotes} onChange={v => set('appearanceNotes', v)} disabled={readOnly} />
                  </>}

                  {/* ── APPLICATION + TASTING ────────────────────────────── */}
                  {activeSection === 'application' && <>
                    <BriefRef open={briefOpen.application} onToggle={() => toggleBrief('application')}
                      items={[
                        { label: 'Uses', value: fd.uses },
                        { label: 'Milk types', value: fd.milkTypes },
                        { label: 'End drink', value: fd.endDrinkType },
                        { label: 'Dose rate (brief)', value: fd.doseRate },
                      ]}
                    />
                    <Field label="Dose rate tested at" value={data.doseRate} onChange={v => set('doseRate', v)} placeholder="e.g. 15ml per 250ml drink" disabled={readOnly} hint="The actual dose rate you used — this is what goes on the product." />

                    <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      For each drink type below: log how you built the drink, then fill in the sensory profile <strong>of that finished drink</strong>. This is what the client will taste.
                    </p>

                    {(() => {
                      const uses = Array.isArray(fd.uses) ? fd.uses : []
                      const milkUses = ['Hot milk drinks', 'Cold milk drinks', 'Matcha / powder drinks']
                      const tests = []
                      if (uses.some(u => milkUses.includes(u))) tests.push({ key: 'milk',     label: `Milk drink (${(fd.milkTypes || []).join(', ') || 'specify type'})`, isMilk: true })
                      if (uses.includes('Still water'))             tests.push({ key: 'water',    label: 'Still water' })
                      if (uses.includes('Sparkling water / soda'))  tests.push({ key: 'soda',     label: 'Sparkling / soda' })
                      if (uses.includes('Cocktails / mocktails'))   tests.push({ key: 'cocktail', label: 'Cocktail / mocktail' })
                      if (!tests.length) tests.push(
                        { key: 'milk',  label: 'Milk drink', isMilk: true },
                        { key: 'water', label: 'Still water' },
                        { key: 'soda',  label: 'Sparkling / soda' },
                      )
                      return tests.map(({ key, label, isMilk }) => {
                        const t = data.applicationTests?.[key] || {}
                        const setT = (f, v) => set('applicationTests', { ...data.applicationTests, [key]: { ...t, [f]: v } })
                        return (
                          <div key={key} className="border border-gray-200 rounded-2xl overflow-hidden">
                            {/* Test header */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <p className="text-sm font-bold text-gray-800">☕ {label}</p>
                              <div className="flex gap-2">
                                {['Tested', 'Skip'].map(o => (
                                  <button key={o} disabled={readOnly} onClick={() => !readOnly && setT('status', o)}
                                    className={`px-3 py-1 rounded-lg border text-xs font-medium transition ${t.status === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>{o}</button>
                                ))}
                              </div>
                            </div>

                            {t.status === 'Tested' && (
                              <div className="px-4 py-4 space-y-5">
                                {/* Step 1 — How did you build this drink */}
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">1 · How did you build this drink?</p>
                                  <p className="text-xs text-gray-400 mb-3">Log every ingredient and quantity — this becomes the reference recipe for this application.</p>
                                  <div className="space-y-2">
                                    {(t.prepSteps || ['']).map((step, si) => (
                                      <div key={si} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-4 flex-shrink-0">{si + 1}.</span>
                                        <input disabled={readOnly} value={step}
                                          onChange={e => { const n = [...(t.prepSteps || [''])]; n[si] = e.target.value; setT('prepSteps', n) }}
                                          placeholder={si === 0 ? `e.g. 200ml oat milk, steamed to 65°C` : si === 1 ? `e.g. 15g matcha powder, whisked` : `e.g. 20ml of ${brief.productName} syrup`}
                                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50"
                                        />
                                        {!readOnly && (t.prepSteps || ['']).length > 1 && (
                                          <button onClick={() => setT('prepSteps', (t.prepSteps || ['']).filter((_, idx) => idx !== si))} className="text-gray-300 hover:text-red-400 transition text-lg">×</button>
                                        )}
                                      </div>
                                    ))}
                                    {!readOnly && <button onClick={() => setT('prepSteps', [...(t.prepSteps || ['']), ''])} className="mt-1 text-xs text-gray-500 hover:text-black font-medium transition">+ Add step</button>}
                                  </div>
                                  {isMilk && (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <Field label="Milk type used" value={t.milkType || ''} onChange={v => setT('milkType', v)} placeholder="e.g. Oat, whole, Gail's farm" disabled={readOnly} />
                                      <Radio label="Did it split?" name={`${key}Split`} value={t.split || ''} onChange={v => setT('split', v)} options={['Yes', 'No']} disabled={readOnly} />
                                    </div>
                                  )}
                                </div>

                                {/* Step 2 — Sensory profile of this drink */}
                                <div className="border-t border-gray-100 pt-5">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">2 · Sensory profile of this drink</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Primary flavour" value={t.primaryFlavour || ''} onChange={v => setT('primaryFlavour', v)} disabled={readOnly} hint="Dominant flavour in this drink." />
                                    <Field label="Secondary / supporting notes" value={t.secondaryFlavour || ''} onChange={v => setT('secondaryFlavour', v)} disabled={readOnly} hint="e.g. hint of vanilla, light floral." />
                                    <Field label="Aroma" value={t.aroma || ''} onChange={v => setT('aroma', v)} disabled={readOnly} hint="What hits you before tasting." />
                                    <Field label="Texture / mouthfeel" value={t.texture || ''} onChange={v => setT('texture', v)} disabled={readOnly} hint="e.g. silky, thin, coating, thick." />
                                    <Field label="Key top notes" value={t.keyTopNotes || ''} onChange={v => setT('keyTopNotes', v)} disabled={readOnly} hint="What hits first on the palate. Must be present." />
                                    <Field label="Aftertaste / finish" value={t.aftertaste || ''} onChange={v => setT('aftertaste', v)} disabled={readOnly} hint="What lingers — clean, warming, bitter, long." />
                                  </div>

                                  {/* Sweetness */}
                                  <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sweetness in this drink</label>
                                    <div className="flex gap-1.5">
                                      {['Dry', 'Lightly Sweet', 'Balanced', 'Sweet', 'Very Sweet'].map(o => (
                                        <button key={o} disabled={readOnly} onClick={() => !readOnly && setT('sweetness', o)}
                                          className={`flex-1 py-2 px-1 rounded-xl border text-xs font-semibold transition text-center ${t.sweetness === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                                          {o}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex justify-between mt-0.5 px-0.5"><span className="text-xs text-gray-300">← Driest</span><span className="text-xs text-gray-300">Sweetest →</span></div>
                                  </div>

                                  {/* Acidity */}
                                  <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acidity</label>
                                    <div className="flex gap-1.5">
                                      {['None', 'Low', 'Medium', 'High'].map(o => (
                                        <button key={o} disabled={readOnly} onClick={() => !readOnly && setT('acidity', o)}
                                          className={`flex-1 py-2 px-1 rounded-xl border text-xs font-semibold transition text-center ${t.acidity === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                                          {o}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Radio label="Off-notes?" name={`${key}OffNotes`} value={t.offNotes || ''} onChange={v => setT('offNotes', v)} options={['Yes', 'No']} disabled={readOnly} />
                                    <Radio label="Overall result" name={`${key}Pass`} value={t.pass || ''} onChange={v => setT('pass', v)} options={['Pass', 'Fail']} disabled={readOnly} />
                                  </div>
                                  {t.offNotes === 'Yes' && <Field label="Describe off-notes" value={t.offNotesDetail || ''} onChange={v => setT('offNotesDetail', v)} disabled={readOnly} />}
                                  <div className="mt-4">
                                    <TextArea label="Overall tasting notes" value={t.balanceNotes || ''} onChange={v => setT('balanceNotes', v)} disabled={readOnly} hint="Is it well-rounded? Does anything overpower? What would you change?" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}

                    {/* Critical attributes — at the bottom of application */}
                    <div className="border-t border-gray-100 pt-5">
                      <label className="block text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Critical attributes</label>
                      <p className="text-xs text-gray-400 mb-3">If any of these change in future batches, the product fails QC. Only add things that truly cannot change.</p>
                      <div className="space-y-2">
                        {(data.criticalAttributes || []).map((a, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                            <input disabled={readOnly} value={a} onChange={e => { const n = [...data.criticalAttributes]; n[i] = e.target.value; set('criticalAttributes', n) }}
                              placeholder="e.g. Strong rose note on the nose must be present"
                              className="flex-1 px-3 py-2 rounded-xl border border-red-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:bg-gray-50" />
                            {!readOnly && <button onClick={() => set('criticalAttributes', data.criticalAttributes.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition text-lg">×</button>}
                          </div>
                        ))}
                      </div>
                      {!readOnly && <button onClick={() => set('criticalAttributes', [...(data.criticalAttributes || []), ''])} className="mt-3 text-sm text-red-500 hover:text-red-700 font-medium transition">+ Add critical attribute</button>}
                    </div>

                    <TextArea label="Any other application issues" value={data.applicationIssues} onChange={v => set('applicationIssues', v)} disabled={readOnly} />
                  </>}

                  {/* ── PRODUCTION ────────────────────────────────────────── */}
                  {activeSection === 'production' && <>
                    <BriefRef open={briefOpen.production} onToggle={() => toggleBrief('production')}
                      items={[
                        { label: 'Markets', value: fd.markets },
                        { label: 'Certifications needed', value: fd.certifications },
                        { label: 'Storage', value: fd.storage },
                      ]}
                    />

                    <Radio label="Hot fill or cold mix? *" name="hotOrColdProcess" value={data.hotOrColdProcess} onChange={v => set('hotOrColdProcess', v)} options={['Hot fill', 'Cold mix']} disabled={readOnly} />

                    {/* Factory compatibility — driven by brief certifications vs factory certs */}
                    {factories.length > 0 ? (() => {
                      const requiredCerts = Array.isArray(fd.certifications) ? fd.certifications.filter(c => c !== 'None needed' && c !== 'Not sure') : []
                      return (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Where can this be made? *</label>
                          <p className="text-xs text-gray-400 mb-3">
                            {requiredCerts.length > 0
                              ? `Brief requires: ${requiredCerts.join(', ')}. Compatible factories are highlighted.`
                              : 'Select all facilities this recipe can be produced at.'}
                          </p>
                          <div className="space-y-2">
                            {factories.map(f => {
                              const selected = (data.productionFacilities || []).includes(f.name)
                              const missingCerts = requiredCerts.filter(c => !f[c.toLowerCase()])
                              const compatible = missingCerts.length === 0
                              return (
                                <button key={f.id} disabled={readOnly} onClick={() => {
                                  if (readOnly) return
                                  const curr = data.productionFacilities || []
                                  set('productionFacilities', selected ? curr.filter(x => x !== f.name) : [...curr, f.name])
                                }}
                                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition flex items-center justify-between gap-3 ${
                                    selected ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                                  }`}>
                                  <div className="flex items-center gap-3">
                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${compatible ? 'bg-green-400' : 'bg-amber-400'}`} />
                                    <span className="font-semibold">{f.name}</span>
                                    <div className="flex gap-1 flex-wrap">
                                      {['salsa', 'brc', 'haccp'].filter(c => f[c]).map(c => (
                                        <span key={c} className={`text-xs px-1.5 py-0.5 rounded font-medium ${selected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{c.toUpperCase()}</span>
                                      ))}
                                    </div>
                                  </div>
                                  {!compatible && requiredCerts.length > 0 && (
                                    <span className={`text-xs flex-shrink-0 ${selected ? 'text-white/60' : 'text-amber-600'}`}>Missing: {missingCerts.join(', ')}</span>
                                  )}
                                  {compatible && requiredCerts.length > 0 && (
                                    <span className={`text-xs flex-shrink-0 ${selected ? 'text-white/60' : 'text-green-600'}`}>✓ All certs met</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })() : (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Where can this be made? *</label>
                        <div className="flex flex-wrap gap-2">
                          {['Red Distillery', 'Calyx', 'Voxel', 'Rhode Island'].map(f => {
                            const selected = (data.productionFacilities || []).includes(f)
                            return (
                              <button key={f} disabled={readOnly} onClick={() => {
                                if (readOnly) return
                                const curr = data.productionFacilities || []
                                set('productionFacilities', selected ? curr.filter(x => x !== f) : [...curr, f])
                              }}
                                className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${selected ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                                {f}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-amber-600 mt-2">Run <code>node scripts/seedFactories.js</code> to load factory certification data.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Estimated cook time per batch" value={data.estimatedCookTime} onChange={v => set('estimatedCookTime', v)} placeholder="e.g. 45 mins" disabled={readOnly} />
                      <Field label="Minimum cook time" value={data.minCookTime} onChange={v => set('minCookTime', v)} placeholder="e.g. hold at 80°C for 30 mins" disabled={readOnly}
                        hint="The theoretical minimum — e.g. a required hold time for safety or flavour." />
                    </div>
                    {data.hotOrColdProcess === 'Hot fill' && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-blue-700">Hot fill reminder: minimum fill temperature is typically 82°C. Confirm with the factory.</p>
                      </div>
                    )}
                    <TextArea label="Production limitations to flag" value={data.productionLimitations} onChange={v => set('productionLimitations', v)} disabled={readOnly} hint="Anything ops or Tom needs to know." />

                    {/* Retain sample */}
                    <div className="border-t border-gray-100 pt-5 space-y-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lab Sample</p>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-amber-800">Always make two samples — one for the client, one kept in the lab.</p>
                      </div>
                      <Radio label="Did you retain a lab sample?" name="retainSampleKept" value={data.retainSampleKept} onChange={v => set('retainSampleKept', v)} options={['Yes', 'No']} disabled={readOnly} />
                      {data.retainSampleKept === 'Yes' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Sample location" value={data.sampleLocation} onChange={v => set('sampleLocation', v)} placeholder="e.g. Lab fridge shelf 2" disabled={readOnly} />
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sample label</label>
                              <div className="flex items-center gap-2">
                                <input
                                  value={data.sampleLabel || (() => {
                                    const activeVersion = versions.find(v => v.id === activeId)
                                    const code = nextUid?.split('-')[0] || ''
                                    const vNum = activeVersion?.versionNumber || ''
                                    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                    return code && vNum ? `#${code}-V${vNum} · ${today}` : ''
                                  })()}
                                  onChange={v => set('sampleLabel', v.target ? v.target.value : v)}
                                  disabled={readOnly}
                                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400"
                                  placeholder={(() => {
                                    const activeVersion = versions.find(v => v.id === activeId)
                                    const code = nextUid?.split('-')[0] || ''
                                    const vNum = activeVersion?.versionNumber || ''
                                    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                    return code && vNum ? `#${code}-V${vNum} · ${today}` : 'e.g. #KRTM-V1 · 26 Mar 2026'
                                  })()}
                                />
                                {!readOnly && !data.sampleLabel && (
                                  <button type="button"
                                    onClick={() => {
                                      const activeVersion = versions.find(v => v.id === activeId)
                                      const code = nextUid?.split('-')[0] || ''
                                      const vNum = activeVersion?.versionNumber || ''
                                      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                      if (code && vNum) set('sampleLabel', `#${code}-V${vNum} · ${today}`)
                                    }}
                                    className="text-xs px-2.5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-black hover:text-black transition whitespace-nowrap flex-shrink-0">
                                    Use default
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <PhotoUpload label="📸 Photo of retain sample" hint="Upload a photo of the labelled bottle."
                              url={data.retainSamplePhotoUrl} uploading={uploading.retainSamplePhotoUrl}
                              onUpload={file => uploadPhoto(file, 'retainSamplePhotoUrl')} disabled={readOnly} />
                            <PhotoUpload label="🥤 Photo of prepared drink" hint="Reference shot of the syrup in a drink."
                              url={data.drinkPhotoUrl} uploading={uploading.drinkPhotoUrl}
                              onUpload={file => uploadPhoto(file, 'drinkPhotoUrl')} disabled={readOnly} />
                          </div>
                        </>
                      )}
                    </div>
                  </>}

                </div>
              </div>

              {/* ── Bottom CTA — Next section or sign-off on last section ── */}
              {!readOnly && (() => {
                const sectionKeys = SECTIONS.map(s => s.key)
                const currentIdx  = sectionKeys.indexOf(activeSection)
                const isLastSection = currentIdx === sectionKeys.length - 1
                const nextSection = !isLastSection ? SECTIONS[currentIdx + 1] : null
                const currentDone = sectionDone[activeSection]

                if (!isLastSection) {
                  return (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setActiveSection(nextSection.key)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition">
                        {nextSection.icon} {nextSection.label} →
                      </button>
                    </div>
                  )
                }

                // Last section — show sign-off CTA
                return (
                  <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${allDone ? 'bg-black border-black' : 'bg-white border-gray-200'}`}>
                    <div>
                      <p className={`text-sm font-semibold ${allDone ? 'text-white' : 'text-gray-400'}`}>
                        {allDone ? '✓ All sections complete — ready to mark for client sign-off' : 'Complete all sections to mark ready for client sign-off'}
                      </p>
                      {!allDone && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[
                            !sectionDone.recipe && 'Recipe & Process',
                            !sectionDone.specs && 'Specs',
                            !sectionDone.application && 'Tasting & Application',
                            !sectionDone.production && 'Production',
                            !sampleDone && 'Lab sample',
                          ].filter(Boolean).join(' · ')} still needed
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => allDone && setSignOffModal(true)}
                      disabled={!allDone}
                      className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition flex-shrink-0 ${allDone ? 'bg-white text-black hover:bg-gray-100 cursor-pointer' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                      Mark ready for client sign-off →
                    </button>
                  </div>
                )
              })()}
            </>
          )}

          {/* No version yet — prompt */}
          {!activeId && versions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center space-y-3">
              <p className="text-4xl">🧪</p>
              <p className="font-semibold text-gray-800">No recipe started yet</p>
              <p className="text-sm text-gray-400">Click "+ Create recipe" in the sidebar to start the first version.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create recipe / New version modal ─────────────────────────────── */}
      {versionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{versions.length === 0 ? 'Create recipe' : 'Save as new version'}</h2>
              {versions.length === 0
                ? <p className="text-sm text-gray-400 mt-1">Start the first version of this recipe.</p>
                : <p className="text-sm text-gray-400 mt-1">All current data is copied across. Give this version a name.</p>
              }
            </div>

            {/* Product + client (read-only display for first version) */}
            {versions.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</p>
                <p className="text-sm font-semibold text-gray-900">{brief.productName}</p>
                <p className="text-xs text-gray-500">{brief.clientName}</p>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sample ID</p>
                <p className="text-xs text-gray-400 mt-0.5">Used on the physical sample label</p>
              </div>
              <span className="text-lg font-mono font-bold text-black">
                {nextUid ? `#${nextUid}-V${versions.length + 1}` : `V${versions.length + 1}`}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Version name *</label>
                <input value={versionName} onChange={e => setVersionName(e.target.value)} placeholder="e.g. Initial recipe, Less sugar more rose"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cook</label>
                <select value={versionCook} onChange={e => setVersionCook(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">Select cook...</option>
                  {userList.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {versions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What changed? (optional)</label>
                  <textarea value={versionNote} onChange={e => setVersionNote(e.target.value)}
                    placeholder="e.g. Reduced sugar by 10%, adjusted pH to 3.6, added rose extract..."
                    rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setVersionModal(false); setVersionNote(''); setVersionName(''); setVersionCook('') }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveVersion} disabled={saving || !versionName.trim()}
                className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">
                {saving ? 'Saving…' : versions.length === 0 ? 'Create recipe' : `Save as V${versions.length + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign-off confirm modal ────────────────────────────────────────── */}
      {signOffModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-4 text-center">
            <p className="text-3xl">🧪</p>
            <h2 className="text-xl font-bold text-gray-900">Mark ready for client sign-off?</h2>
            <p className="text-sm text-gray-400">This version will be locked. The pipeline will advance to sample sending — you'll then log who sends the sample, how many, and when it's expected to arrive.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSignOffModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={signOff} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">Mark ready ✓</button>
            </div>
          </div>
        </div>
      )}
      {autoFill && (
        <LabAutoFillModal
          brief={brief}
          onApply={async (extracted) => {
            const merged = deepMerge(data, extracted)
            setData(merged)
            setAutoFill(false)
            if (activeId) {
              try { await updateDoc(doc(db, 'labSheets', activeId), { data: merged }) }
              catch (e) { console.error(e) }
            }
          }}
          onClose={() => setAutoFill(false)}
        />
      )}
    </div>
  )
}

// ── Deep merge helper ─────────────────────────────────────────────────────────
function deepMerge(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (override[key] === null || override[key] === undefined) continue
    if (Array.isArray(override[key]) && override[key].length > 0) {
      result[key] = override[key]
    } else if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] || {}, override[key])
    } else if (override[key] !== '') {
      result[key] = override[key]
    }
  }
  return result
}
function IngredientCombobox({ value, disabled, suggestions, usedNames, onChange, onSelect }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value || '')
  const ref = useRef(null)

  useEffect(() => { setSearch(value || '') }, [value])
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} className="relative min-w-[160px]">
      <input disabled={disabled} value={search}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => !disabled && setOpen(true)}
        placeholder="Ingredient name"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {filtered.length === 0
            ? <p className="text-xs text-gray-400 px-4 py-3 text-center">No matches — type to add new</p>
            : <>
                <p className="text-xs text-gray-400 px-3 pt-2.5 pb-1 font-medium">Ordered for this product</p>
                {filtered.map((s, i) => {
                  const used = usedNames.includes(s.name.trim().toLowerCase())
                  return (
                    <button key={i} onMouseDown={e => { e.preventDefault(); if (!used) { onSelect(s); setOpen(false); setSearch(s.name) } }}
                      className={`w-full text-left px-3 py-2.5 border-t border-gray-50 transition flex items-center justify-between gap-2 ${used ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50'}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        {s.supplierName && <p className="text-xs text-gray-400">{s.supplierName}</p>}
                      </div>
                      {used && <span className="text-xs text-gray-400">✓ added</span>}
                    </button>
                  )
                })}
              </>
          }
        </div>
      )}
    </div>
  )
}

// ─── Photo upload ─────────────────────────────────────────────────────────────
function PhotoUpload({ label, hint, url, uploading, onUpload, disabled }) {
  const fileRef = useRef(null)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
          {!disabled && <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white text-sm font-semibold">Replace</button>}
        </div>
      ) : (
        <button disabled={disabled || uploading} onClick={() => fileRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 transition disabled:opacity-50">
          {uploading ? <><span className="text-xl">⏳</span><span className="text-xs">Uploading...</span></> : <><span className="text-2xl">📸</span><span className="text-xs font-medium">Tap to upload</span></>}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </div>
  )
}

// ─── Lab AutoFill Modal ───────────────────────────────────────────────────────
const LAB_SCHEMA = {
  requiredLitres: 'number — batch size in litres',
  requiredLitresUnit: 'string — L or mL',
  ingredients: 'array of { ingredient: string, supplier: string, unit: string (KG/G/L/ML/PCS/OZ), qty: string }',
  heatingRequired: 'string — Yes or No',
  maxTemp: 'string — max temperature in °C e.g. "85"',
  steps: 'array of strings — each cooking step in order',
  criticalAdditionNotes: 'string — when to add flavours, acids, colours',
  coolingPoint: 'string — cooling temp before fill e.g. "40°C"',
  processNotes: 'string — other critical process notes',
  analytical: 'object with brix and ph each having { min: string, target: string, max: string, conditions: string }',
  fillWeightPerVolume: 'string — e.g. "755g per 750ml bottle"',
  density: 'string — g/mL e.g. "1.007"',
  colourNeat: 'string — colour of the syrup in the bottle',
  colourInDrink: 'string — colour in the finished drink',
  appearanceNotes: 'string',
  primaryFlavour: 'string',
  secondaryFlavour: 'string',
  aroma: 'string',
  texture: 'string',
  keyTopNotes: 'string',
  aftertaste: 'string',
  sweetness: 'one of: Dry | Lightly Sweet | Balanced | Sweet | Very Sweet',
  acidity: 'one of: None | Low | Medium | High',
  offNotes: 'one of: Yes | No',
  offNotesDetail: 'string — if off notes present',
  balanceNotes: 'string — overall tasting notes',
  criticalAttributes: 'array of strings — attributes that must not change between batches',
  doseRate: 'string — e.g. "15ml per 250ml drink"',
  applicationIssues: 'string',
  hotOrColdProcess: 'one of: Hot fill | Cold mix',
  estimatedCookTime: 'string — e.g. "45 mins"',
  productionLimitations: 'string',
  retainSampleKept: 'one of: Yes | No',
  sampleLocation: 'string',
  sampleLabel: 'string',
}

const FIELD_SECTION = {
  requiredLitres: 'Recipe', requiredLitresUnit: 'Recipe', ingredients: 'Recipe',
  heatingRequired: 'Recipe', maxTemp: 'Recipe', steps: 'Recipe',
  criticalAdditionNotes: 'Recipe', coolingPoint: 'Recipe', processNotes: 'Recipe',
  analytical: 'Specs', fillWeightPerVolume: 'Specs', density: 'Specs',
  colourNeat: 'Specs', colourInDrink: 'Specs', appearanceNotes: 'Specs',
  primaryFlavour: 'Specs', secondaryFlavour: 'Specs', aroma: 'Specs', texture: 'Specs',
  keyTopNotes: 'Specs', aftertaste: 'Specs', sweetness: 'Specs', acidity: 'Specs',
  offNotes: 'Specs', offNotesDetail: 'Specs', balanceNotes: 'Specs',
  criticalAttributes: 'Application', doseRate: 'Application', applicationIssues: 'Application',
  hotOrColdProcess: 'Production', estimatedCookTime: 'Production', productionLimitations: 'Production',
  retainSampleKept: 'Production', sampleLocation: 'Production', sampleLabel: 'Production',
}

const SECTION_COLORS = {
  Recipe: 'bg-blue-50 text-blue-600', Specs: 'bg-purple-50 text-purple-600',
  Application: 'bg-amber-50 text-amber-700', Production: 'bg-green-50 text-green-700',
}

const FIELD_LABELS = {
  requiredLitres: 'Batch size', ingredients: 'Ingredients', heatingRequired: 'Heating required',
  maxTemp: 'Max temp', steps: 'Cooking steps', criticalAdditionNotes: 'Critical addition notes',
  coolingPoint: 'Cooling point', processNotes: 'Process notes', analytical: 'Analytical (Brix/pH)',
  fillWeightPerVolume: 'Fill weight per volume', density: 'Density',
  colourNeat: 'Syrup colour', colourInDrink: 'End drink colour', appearanceNotes: 'Appearance notes',
  primaryFlavour: 'Primary flavour', secondaryFlavour: 'Secondary flavour', aroma: 'Aroma',
  texture: 'Texture', keyTopNotes: 'Key top notes', aftertaste: 'Aftertaste',
  sweetness: 'Sweetness', acidity: 'Acidity', offNotes: 'Off notes', offNotesDetail: 'Off notes detail',
  balanceNotes: 'Balance notes', criticalAttributes: 'Critical attributes',
  doseRate: 'Dose rate', applicationIssues: 'Application issues',
  hotOrColdProcess: 'Hot/cold process', estimatedCookTime: 'Cook time',
  productionLimitations: 'Production limitations', retainSampleKept: 'Retain sample kept',
  sampleLocation: 'Sample location', sampleLabel: 'Sample label',
}

function displayVal(v) {
  if (Array.isArray(v)) {
    if (v.length === 0) return '(empty)'
    if (typeof v[0] === 'object') return `${v.length} item(s)`
    return v.slice(0, 3).join(' · ') + (v.length > 3 ? ` +${v.length - 3} more` : '')
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v)
}

function LabAutoFillModal({ brief, onApply, onClose }) {
  const [mode,     setMode]     = useState('text')    // text | voice
  const [text,     setText]     = useState('')
  const [file,     setFile]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState(null)
  const [accepted, setAccepted] = useState({})
  const [dragging, setDragging] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const dropRef    = useRef(null)
  const fileRef    = useRef(null)
  const mediaRef   = useRef(null)
  const chunksRef  = useRef([])

  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''

  // ── File reading ───────────────────────────────────────────────────────────
  const readFile = async (f) => {
    setFile(f)
    const ext = f.name.split('.').pop().toLowerCase()
    if (['txt','md','csv'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = e => setText(e.target.result)
      reader.readAsText(f)
    } else if (ext === 'pdf') {
      // Send as base64 to OpenAI vision
      const reader = new FileReader()
      reader.onload = e => {
        const b64 = e.target.result.split(',')[1]
        setText(`__PDF_BASE64__${b64}__FILENAME__${f.name}`)
      }
      reader.readAsDataURL(f)
    } else if (['xlsx','xls'].includes(ext)) {
      // Read Excel as binary, send as text note
      setText(`[Excel file: ${f.name}] — paste the relevant data as text for best results, or I'll do my best to extract from the filename context.`)
    } else {
      const reader = new FileReader()
      reader.onload = e => setText(e.target.result)
      reader.readAsText(f)
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) readFile(f)
  }

  // ── Voice recording via Web Speech API ────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        // Transcribe via Whisper
        setLoading(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'recording.webm')
          form.append('model', 'whisper-1')
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
          })
          const data = await res.json()
          const t = data.text || ''
          setTranscript(t)
          setText(t)
        } catch (e) { setError('Transcription failed — check your API key') }
        setLoading(false)
      }
      mr.start()
      setRecording(true)
    } catch (e) { setError('Microphone access denied') }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  // ── OpenAI extraction ──────────────────────────────────────────────────────
  const extract = async () => {
    const input = text.trim()
    if (!input) { setError('Add some input first.'); return }
    setLoading(true); setError(''); setResult(null)

    const isPdf = input.startsWith('__PDF_BASE64__')

    const systemPrompt = `You are a lab development data extraction assistant for Bloomin, a functional food & drink company.
Extract lab sheet data from the provided input (cook notes, lab report, Excel export, voice transcript, or any R&D text).
Return ONLY a valid JSON object matching the schema. Only include fields where you found clear information.
Do not invent data. Omit fields you cannot determine.

Product: ${brief?.productName || 'unknown'} for ${brief?.clientName || 'unknown'}

JSON schema:
${JSON.stringify(LAB_SCHEMA, null, 2)}`

    try {
      let messages
      if (isPdf) {
        const b64 = input.replace('__PDF_BASE64__', '').split('__FILENAME__')[0]
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: 'Extract lab sheet data from this PDF:' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${b64}` } },
          ]},
        ]
      } else {
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract lab data from this input:\n\n---\n${input.slice(0, 14000)}\n---\n\nReturn ONLY the JSON object, no markdown, no explanation.` },
        ]
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o', temperature: 0.1, max_tokens: 2000, messages }),
      })

      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `OpenAI ${res.status}`) }
      const resp = await res.json()
      const raw  = resp.choices?.[0]?.message?.content?.trim() || ''
      const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(clean)

      // Filter empty
      const filtered = {}
      const filterVal = (v) => {
        if (v === null || v === undefined || v === '') return false
        if (Array.isArray(v) && v.length === 0) return false
        return true
      }
      Object.entries(parsed).forEach(([k, v]) => { if (filterVal(v)) filtered[k] = v })

      if (Object.keys(filtered).length === 0) {
        setError("Couldn't extract any fields — try more detailed notes or a different format.")
        setLoading(false); return
      }

      const init = {}
      Object.keys(filtered).forEach(k => { init[k] = true })
      setAccepted(init)
      setResult(filtered)
    } catch (e) { setError(e.message || 'Something went wrong.'); console.error(e) }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-lg">✨</div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Auto-fill lab sheet</h2>
              <p className="text-xs text-gray-400 mt-0.5">Drop cook notes, Excel/PDF, or speak your observations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition text-2xl leading-none">×</button>
        </div>

        {!result ? (
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">

            {/* Input mode tabs */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[['text','📝 Notes / paste'],['voice','🎙️ Voice']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-xs font-semibold transition ${mode === m ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'text' && (
              <>
                {/* Drop zone */}
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragging ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}>
                  <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.xlsx,.xls,.json" className="hidden"
                    onChange={e => e.target.files?.[0] && readFile(e.target.files[0])} />
                  <span className="text-3xl">{file ? '📄' : '📎'}</span>
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Click to replace</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600">Drop file here</p>
                      <p className="text-xs text-gray-400 mt-0.5">.txt · .pdf · .xlsx · .csv — or click to browse</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">or paste text</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <textarea
                  value={text} onChange={e => { setText(e.target.value); setFile(null) }}
                  placeholder={`Paste cook notes, lab report, Excel data, or any observations...\n\ne.g. "Batch 5L. Added 500g vanilla extract, 200g citric acid, 50g natural flavour. Heated to 85°C for 20 mins. pH 3.8, Brix 42. Golden amber colour, strong vanilla nose, balanced sweetness..."`}
                  rows={8}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none text-gray-700 placeholder-gray-300"
                />
              </>
            )}

            {mode === 'voice' && (
              <div className="space-y-4">
                <div className={`rounded-2xl border-2 p-8 flex flex-col items-center gap-4 transition-all ${recording ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={loading}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all shadow-lg ${recording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-black text-white hover:bg-gray-800'}`}>
                    {recording ? '⏹' : '🎙️'}
                  </button>
                  <p className="text-sm font-semibold text-gray-700">
                    {recording ? 'Recording… click to stop' : 'Click to start recording'}
                  </p>
                  <p className="text-xs text-gray-400 text-center max-w-xs">
                    Speak your lab observations — batch size, ingredients, steps, sensory notes, pH, Brix. We'll transcribe and extract automatically.
                  </p>
                </div>
                {transcript && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Transcript</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{transcript}</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">GPT-4o · lab sheet extraction</p>
              <button onClick={extract} disabled={loading || !text.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-2xl hover:opacity-90 transition disabled:opacity-40 shadow-md shadow-violet-200">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {recording || mode === 'voice' ? 'Transcribing…' : 'Extracting…'}</>
                ) : (
                  <>✨ Extract & preview</>
                )}
              </button>
            </div>
          </div>

        ) : (
          <>
            <div className="px-7 pt-5 pb-3 flex-shrink-0">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Found {Object.keys(result).length} fields — review and apply</p>
                  <p className="text-xs text-green-600 mt-0.5">Uncheck any you don't want. Existing data will be merged.</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-7 pb-4 space-y-2">
              {Object.entries(result).map(([key, val]) => {
                const section = FIELD_SECTION[key]
                const sectionColor = section ? (SECTION_COLORS[section] || 'bg-gray-100 text-gray-500') : null
                return (
                  <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${accepted[key] ? 'border-violet-200 bg-violet-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <input type="checkbox" checked={accepted[key] || false}
                      onChange={e => setAccepted(a => ({ ...a, [key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-violet-500 flex-shrink-0 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{FIELD_LABELS[key] || key}</p>
                        {section && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sectionColor}`}>{section}</span>}
                      </div>
                      <p className="text-sm text-gray-900 break-words">{displayVal(val)}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-white">
              <button onClick={() => { setResult(null); setError('') }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                ← Try again
              </button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">{Object.values(accepted).filter(Boolean).length} of {Object.keys(result).length} selected</p>
                <button
                  onClick={() => {
                    const toApply = {}
                    Object.entries(result).forEach(([k, v]) => { if (accepted[k]) toApply[k] = v })
                    onApply(toApply)
                  }}
                  disabled={!Object.values(accepted).some(Boolean)}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-40">
                  Apply to lab sheet ✓
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Ingredient name combobox ─────────────────────────────────────────────────