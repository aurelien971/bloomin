import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { db, storage } from '../../lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  collection, query, where, orderBy, getDocs,
  addDoc, doc, getDoc, updateDoc,
} from 'firebase/firestore'

const EMPTY_DATA = {
  requiredLitres: '',
  ingredients: [
    { ingredient: '', supplier: '', supplierCode: '', unit: 'KG', qty1000L: '', qty1L: '' },
    { ingredient: '', supplier: '', supplierCode: '', unit: 'KG', qty1000L: '', qty1L: '' },
    { ingredient: '', supplier: '', supplierCode: '', unit: 'KG', qty1000L: '', qty1L: '' },
    { ingredient: '', supplier: '', supplierCode: '', unit: 'KG', qty1000L: '', qty1L: '' },
  ],
  fillMethod: '', heatingRequired: '', maxTemp: '',
  steps: ['', '', '', '', '', '', '', ''],
  flavoursAdded: '', acidsAdded: '', coloursAdded: '', coolingPoint: '', processNotes: '',
  analytical: {
    brix:         { min: '', target: '', max: '', conditions: 'Must only be done at 20°C' },
    ph:           { min: '', target: '', max: '', conditions: 'Must only be done at 20°C' },
    citricAcid:   { min: '', target: '', max: '', conditions: 'Tested externally by certified lab' },
    waterActivity:{ min: '', target: '', max: '', conditions: 'Tested externally by certified lab' },
    cookingTemp:  { min: '', target: '', max: '', conditions: 'Must be held at target for 10 mins' },
  },
  viscosity: '', fillWeight: '',
  colourNeat: '', colourWater: '', colourMilk: '', colourSoda: '', appearanceNotes: '',
  primaryFlavour: '', secondaryFlavour: '', aroma: '', texture: '',
  keyTopNotes: '', aftertaste: '', sweetness: '', acidity: '',
  offNotes: '', offNotesDetail: '', balanceNotes: '',
  criticalAttributes: ['', '', ''],
  acceptableVariation: ['', ''],
  testedMilk: '', milkResult: '', milkPass: '', milkType: '', milkSplit: '',
  testedWater: '', waterResult: '', waterPass: '',
  testedSoda: '', sodaResult: '', sodaPass: '',
  testedHot: '', hotResult: '', hotPass: '',
  doseRate: '', applicationIssues: '',
  suitableBRC: '',
  madeAtRed: '', redNotes: '',
  madeAtCalyx: '', calyxNotes: '',
  madeAtVoxel: '', voxelNotes: '',
  madeAtRhodeIsland: '', rhodeIslandNotes: '',
  estimatedCookTime: '', hotOrColdProcess: '', productionLimitations: '',
  retainSampleKept: '', sampleLocation: '', sampleLabel: '',
  retainSamplePhotoUrl: '', drinkPhotoUrl: '',
  submittedToClientVersion: '', submittedDate: '',
  clientFeedback: '', signedOffByClient: '', clientSignOffDate: '',
  signedOffInternallyBy: '', internalSignOffDate: '',
  postSignOffQA: '', qaNotes: '',
}

const UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'OZ']
const ANALYTICAL_ROWS = [
  { key: 'brix',         label: 'Brix' },
  { key: 'ph',           label: 'pH' },
  { key: 'citricAcid',   label: 'Citric Acid Equivalent Acidity @ pH8' },
  { key: 'waterActivity',label: 'Water Activity' },
  { key: 'cookingTemp',  label: 'Cooking Temp' },
]

function Radio({ label, name, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="flex gap-3 flex-wrap">
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

function SectionCard({ id, title, children }) {
  return (
    <div id={id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden scroll-mt-24">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function PhotoUpload({ label, hint, url, uploading, onUpload, disabled }) {
  const fileRef = useRef(null)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
          {!disabled && (
            <button onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white text-sm font-semibold">
              Replace photo
            </button>
          )}
        </div>
      ) : (
        <button disabled={disabled || uploading} onClick={() => fileRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {uploading
            ? <><span className="text-xl">⏳</span><span className="text-xs font-medium">Uploading...</span></>
            : <><span className="text-2xl">📸</span><span className="text-xs font-medium">Tap to upload photo</span></>
          }
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </div>
  )
}

export default function LabSheet() {
  const router = useRouter()
  const { briefId } = router.query

  const [brief,        setBrief]        = useState(null)
  const [versions,     setVersions]     = useState([])
  const [activeId,     setActiveId]     = useState(null)
  const [data,         setData]         = useState(EMPTY_DATA)
  const [isSignedOff,  setIsSignedOff]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [versionModal, setVersionModal] = useState(false)
  const [versionNote,  setVersionNote]  = useState('')
  const [signOffModal, setSignOffModal] = useState(false)
  const [uploading,    setUploading]    = useState({})

  useEffect(() => { if (briefId) init() }, [briefId])

  const init = async () => {
    const bSnap = await getDoc(doc(db, 'briefs', briefId))
    if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })
    const vSnap = await getDocs(query(collection(db, 'labSheets'), where('briefId', '==', briefId), orderBy('createdAt', 'desc')))
    const docs = vSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    setVersions(docs)
    if (docs.length > 0) {
      setActiveId(docs[0].id)
      setData({ ...EMPTY_DATA, ...docs[0].data })
      setIsSignedOff(docs[0].status === 'signed-off')
    }
  }

  const loadVersion = (v) => {
    setActiveId(v.id)
    setData({ ...EMPTY_DATA, ...v.data })
    setIsSignedOff(v.status === 'signed-off')
  }

  const set = (key, val) => setData(d => ({ ...d, [key]: val }))
  const setAnalytical = (row, field, val) =>
    setData(d => ({ ...d, analytical: { ...d.analytical, [row]: { ...(d.analytical?.[row] || {}), [field]: val } } }))

  const saveVersion = async () => {
    if (!brief) return
    setSaving(true)
    const vNum = versions.length + 1
    const newDoc = {
      briefId, productName: brief.productName, clientName: brief.clientName,
      versionNumber: vNum,
      versionNote: versionNote.trim() || `Version ${vNum}`,
      status: 'draft', createdAt: new Date().toISOString(), data,
    }
    const docRef = await addDoc(collection(db, 'labSheets'), newDoc)
    const newVersion = { id: docRef.id, ...newDoc }
    setVersions(v => [newVersion, ...v])
    setActiveId(docRef.id)
    setIsSignedOff(false)
    setVersionModal(false)
    setVersionNote('')
    setSaving(false)
  }

  const signOff = async () => {
    if (!activeId) return
    await updateDoc(doc(db, 'labSheets', activeId), { status: 'signed-off' })
    setVersions(vs => vs.map(v => v.id === activeId ? { ...v, status: 'signed-off' } : v))
    setIsSignedOff(true)
    setSignOffModal(false)
  }

  const autosave = async () => {
    if (!activeId || isSignedOff) return
    setSaving(true)
    try { await updateDoc(doc(db, 'labSheets', activeId), { data }) }
    catch (e) { console.error('Save failed', e) }
    setSaving(false)
  }

  const setIngredient = (i, field, val) => {
    const next = [...data.ingredients]
    next[i] = { ...next[i], [field]: val }
    if (field === 'qty1000L') {
      next[i].qty1L = val ? (parseFloat(val) / 1000).toFixed(5).replace(/\.?0+$/, '') : ''
    }
    set('ingredients', next)
  }

  const uploadPhoto = async (file, field) => {
    if (!file) return
    setUploading(u => ({ ...u, [field]: true }))
    try {
      const sRef = storageRef(storage, `retain-samples/${briefId}/${field}-${Date.now()}`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      set(field, url)
    } catch (e) { console.error('Upload failed', e) }
    setUploading(u => ({ ...u, [field]: false }))
  }

  const reqL = parseFloat(data.requiredLitres) || 0
  const readOnly = isSignedOff

  if (!brief) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head><title>Lab Sheet — {brief.productName}</title></Head>

      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20" />
            <button onClick={() => router.back()} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20" />
            <div>
              <p className="text-sm font-semibold text-white">{brief.productName}</p>
              <p className="text-xs text-white/50">{brief.clientName} · Lab Development Sheet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {readOnly
              ? <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">Signed off ✓</span>
              : <>
                  <button onClick={autosave} disabled={saving} className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setSignOffModal(true)} disabled={!activeId}
                    className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
                    Sign off ✓
                  </button>
                </>
            }
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 w-full flex gap-8">

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 space-y-3 sticky top-24 self-start">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Versions</p>
          <button onClick={() => setVersionModal(true)}
            className="w-full px-3 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-gray-900 transition">
            + New version
          </button>
          {versions.length === 0
            ? <p className="text-xs text-gray-400 px-1">No versions saved yet</p>
            : versions.map(v => (
                <button key={v.id} onClick={() => loadVersion(v)}
                  className={`w-full text-left px-3 py-3 rounded-xl text-sm transition ${activeId === v.id ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold">V{v.versionNumber}</span>
                    {v.status === 'signed-off' && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">✓</span>}
                  </div>
                  <p className={`text-xs truncate ${activeId === v.id ? 'text-white/60' : 'text-gray-400'}`}>{v.versionNote}</p>
                  <p className={`text-xs mt-0.5 ${activeId === v.id ? 'text-white/40' : 'text-gray-300'}`}>
                    {new Date(v.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </p>
                </button>
              ))
          }
        </div>

        {/* All sections in one scroll */}
        <div className="flex-1 min-w-0 space-y-8">

          {readOnly && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-green-800">This version is signed off — read only</p>
              <p className="text-xs text-green-600 mt-0.5">Click "+ New version" in the sidebar to continue iterating.</p>
            </div>
          )}

          {/* A — Recipe / BOM */}
          <SectionCard id="section-a" title="Section A — Recipe / Bill of Materials">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Record the exact supplier and supplier code for every ingredient. Chris needs this to source at scale.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Batch size calculator</p>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Required litres</label>
                  <input type="number" min="0" placeholder="e.g. 750" value={data.requiredLitres}
                    onChange={e => set('requiredLitres', e.target.value)} disabled={readOnly}
                    className="w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
                </div>
                {reqL > 0 && (
                  <p className="text-sm text-gray-500 mt-5">Quantities in blue = KG needed for <strong>{reqL}L</strong></p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    {['Ingredient Name', 'Supplier', 'Code', 'Unit', 'Qty / 1000L', 'Qty / 1L', ...(reqL > 0 ? [`KG for ${reqL}L`, 'lbs'] : [])].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.ingredients.map((row, i) => {
                    const kgNeeded  = reqL && row.qty1000L ? ((parseFloat(row.qty1000L) / 1000) * reqL).toFixed(3) : ''
                    const lbsNeeded = kgNeeded ? (parseFloat(kgNeeded) * 2.20462).toFixed(3) : ''
                    return (
                      <tr key={i}>
                        <td className="pr-2 pb-2"><input disabled={readOnly} value={row.ingredient} onChange={e => setIngredient(i, 'ingredient', e.target.value)} placeholder="Ingredient name" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 min-w-[140px]" /></td>
                        <td className="pr-2 pb-2"><input disabled={readOnly} value={row.supplier} onChange={e => setIngredient(i, 'supplier', e.target.value)} placeholder="Supplier" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 min-w-[110px]" /></td>
                        <td className="pr-2 pb-2"><input disabled={readOnly} value={row.supplierCode} onChange={e => setIngredient(i, 'supplierCode', e.target.value)} placeholder="Code" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 min-w-[80px]" /></td>
                        <td className="pr-2 pb-2">
                          <select disabled={readOnly} value={row.unit} onChange={e => setIngredient(i, 'unit', e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white disabled:bg-gray-50">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="pr-2 pb-2"><input disabled={readOnly} value={row.qty1000L} onChange={e => setIngredient(i, 'qty1000L', e.target.value)} placeholder="—" className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 text-right" /></td>
                        <td className="pr-2 pb-2"><input disabled={readOnly} value={row.qty1L} onChange={e => setIngredient(i, 'qty1L', e.target.value)} placeholder="—" className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 text-right" /></td>
                        {reqL > 0 && <>
                          <td className="pr-2 pb-2"><div className="w-20 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800 font-medium text-right">{kgNeeded || '—'}</div></td>
                          <td className="pr-2 pb-2"><div className="w-20 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-500 text-right">{lbsNeeded || '—'}</div></td>
                        </>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!readOnly && (
              <button onClick={() => set('ingredients', [...data.ingredients, { ingredient: '', supplier: '', supplierCode: '', unit: 'KG', qty1000L: '', qty1L: '' }])}
                className="text-sm text-gray-500 hover:text-black font-medium transition">+ Add row</button>
            )}
          </SectionCard>

          {/* B — Process */}
          <SectionCard id="section-b" title="Section B — Process Method">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-red-700">⚠ Maximum cook time: 90 minutes. No 3-hour steeps.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Radio label="Fill method" name="fillMethod" value={data.fillMethod} onChange={v => set('fillMethod', v)} options={['Cold fill', 'Hot fill']} disabled={readOnly} />
              <Radio label="Heating required" name="heatingRequired" value={data.heatingRequired} onChange={v => set('heatingRequired', v)} options={['Yes', 'No']} disabled={readOnly} />
            </div>
            {data.heatingRequired === 'Yes' && <Field label="Max temperature (°C)" value={data.maxTemp} onChange={v => set('maxTemp', v)} placeholder="e.g. 85" disabled={readOnly} />}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cooking instructions — step by step</label>
              <p className="text-xs text-gray-400 mb-3">Be specific — include temperatures, times, order of addition.</p>
              <div className="space-y-2">
                {data.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
                    <input disabled={readOnly} value={step}
                      onChange={e => { const n = [...data.steps]; n[i] = e.target.value; set('steps', n) }}
                      placeholder={`Step ${i + 1}...`}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                    {!readOnly && (
                      <button onClick={() => set('steps', data.steps.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition text-lg flex-shrink-0">×</button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <button onClick={() => set('steps', [...data.steps, ''])} className="mt-3 text-sm text-gray-500 hover:text-black font-medium transition">+ Add step</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="When are flavours added?" value={data.flavoursAdded} onChange={v => set('flavoursAdded', v)} placeholder="e.g. After step 3" disabled={readOnly} />
              <Field label="When are acids added?" value={data.acidsAdded} onChange={v => set('acidsAdded', v)} placeholder="e.g. Final step" disabled={readOnly} />
              <Field label="When are colours added?" value={data.coloursAdded} onChange={v => set('coloursAdded', v)} disabled={readOnly} />
              <Field label="Cooling point before fill (°C)" value={data.coolingPoint} onChange={v => set('coolingPoint', v)} placeholder="e.g. 40°C" disabled={readOnly} />
            </div>
            <TextArea label="Other critical process notes" value={data.processNotes} onChange={v => set('processNotes', v)} disabled={readOnly} />
          </SectionCard>

          {/* C — Analytical Specs */}
          <SectionCard id="section-c" title="Section C — Analytical Values">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 text-left w-52"></th>
                    {['Minimum value', 'Target', 'Max value', 'Conditions of test'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ANALYTICAL_ROWS.map(({ key, label }) => {
                    const row = data.analytical?.[key] || { min: '', target: '', max: '', conditions: '' }
                    return (
                      <tr key={key} className="border-t border-gray-50">
                        <td className="py-2.5 pr-4 font-semibold text-gray-700 text-sm">{label}</td>
                        {['min', 'target', 'max'].map(f => (
                          <td key={f} className="py-2 pr-3">
                            <input disabled={readOnly} value={row[f]} onChange={e => setAnalytical(key, f, e.target.value)} placeholder="—"
                              className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 text-center" />
                          </td>
                        ))}
                        <td className="py-2">
                          <input disabled={readOnly} value={row.conditions} onChange={e => setAnalytical(key, 'conditions', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
              <Field label="Viscosity" value={data.viscosity} onChange={v => set('viscosity', v)} placeholder="Subjective or measured" disabled={readOnly} />
              <Field label="Fill weight / volume" value={data.fillWeight} onChange={v => set('fillWeight', v)} placeholder="e.g. 750ml" disabled={readOnly} />
              <Field label="Colour — neat syrup" value={data.colourNeat} onChange={v => set('colourNeat', v)} placeholder="e.g. Deep amber" disabled={readOnly} />
              <Field label="Colour — in water" value={data.colourWater} onChange={v => set('colourWater', v)} disabled={readOnly} />
              <Field label="Colour — in milk" value={data.colourMilk} onChange={v => set('colourMilk', v)} disabled={readOnly} />
              <Field label="Colour — in soda" value={data.colourSoda} onChange={v => set('colourSoda', v)} disabled={readOnly} />
            </div>
            <TextArea label="Appearance notes" value={data.appearanceNotes} onChange={v => set('appearanceNotes', v)} disabled={readOnly} />
          </SectionCard>

          {/* D — Sensory */}
          <SectionCard id="section-d" title="Section D — Sensory Profile">
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              Complete after sign-off. This becomes the gold standard reference for all future batches.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary flavour" value={data.primaryFlavour} onChange={v => set('primaryFlavour', v)} disabled={readOnly} />
              <Field label="Secondary flavour notes" value={data.secondaryFlavour} onChange={v => set('secondaryFlavour', v)} disabled={readOnly} />
              <Field label="Aroma" value={data.aroma} onChange={v => set('aroma', v)} disabled={readOnly} />
              <Field label="Texture / mouthfeel" value={data.texture} onChange={v => set('texture', v)} disabled={readOnly} />
              <Field label="Key top notes (must be present)" value={data.keyTopNotes} onChange={v => set('keyTopNotes', v)} disabled={readOnly} />
              <Field label="Aftertaste" value={data.aftertaste} onChange={v => set('aftertaste', v)} disabled={readOnly} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Radio label="Sweetness" name="sweetness" value={data.sweetness} onChange={v => set('sweetness', v)} options={['Very Sweet', 'Sweet', 'Balanced', 'Lightly Sweet', 'Dry']} disabled={readOnly} />
              <Radio label="Acidity" name="acidity" value={data.acidity} onChange={v => set('acidity', v)} options={['High', 'Medium', 'Low', 'None']} disabled={readOnly} />
            </div>
            <Radio label="Off-notes present?" name="offNotes" value={data.offNotes} onChange={v => set('offNotes', v)} options={['Yes', 'No']} disabled={readOnly} />
            {data.offNotes === 'Yes' && <Field label="Describe off-notes" value={data.offNotesDetail} onChange={v => set('offNotesDetail', v)} disabled={readOnly} />}
            <TextArea label="Overall balance notes" value={data.balanceNotes} onChange={v => set('balanceNotes', v)} disabled={readOnly} />
            <div>
              <label className="block text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">⚠ Critical attributes — if these change, product is unacceptable</label>
              <div className="space-y-2">
                {data.criticalAttributes.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                    <input disabled={readOnly} value={a}
                      onChange={e => { const n = [...data.criticalAttributes]; n[i] = e.target.value; set('criticalAttributes', n) }}
                      placeholder="Critical attribute..."
                      className="flex-1 px-3 py-2 rounded-xl border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-50" />
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* E — Application */}
          <SectionCard id="section-e" title="Section E — Application Testing">
            <Field label="Dose rate tested at" value={data.doseRate} onChange={v => set('doseRate', v)} placeholder="e.g. 15ml per 250ml drink" disabled={readOnly} />
            {[
              { key: 'Milk', resultKey: 'milkResult', passKey: 'milkPass', extras: true },
              { key: 'Water', resultKey: 'waterResult', passKey: 'waterPass' },
              { key: 'Soda', resultKey: 'sodaResult', passKey: 'sodaPass' },
              { key: 'Hot', resultKey: 'hotResult', passKey: 'hotPass' },
            ].map(({ key, resultKey, passKey, extras }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Tested in {key}</p>
                  <div className="flex gap-2">
                    {['Yes', 'No'].map(o => (
                      <label key={o} className={`px-3 py-1 rounded-lg border text-xs font-medium ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'} transition ${data[`tested${key}`] === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
                        <input type="radio" className="hidden" onChange={() => !readOnly && set(`tested${key}`, o)} />{o}
                      </label>
                    ))}
                  </div>
                </div>
                {data[`tested${key}`] === 'Yes' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Result" value={data[resultKey]} onChange={v => set(resultKey, v)} placeholder="Describe result..." disabled={readOnly} />
                    <Radio label="Pass / Fail" name={passKey} value={data[passKey]} onChange={v => set(passKey, v)} options={['Pass', 'Fail']} disabled={readOnly} />
                    {extras && <>
                      <Field label="Milk type used" value={data.milkType} onChange={v => set('milkType', v)} placeholder="e.g. Oat, whole, Gail's farm" disabled={readOnly} />
                      <Radio label="Did it split?" name="milkSplit" value={data.milkSplit} onChange={v => set('milkSplit', v)} options={['Yes', 'No']} disabled={readOnly} />
                    </>}
                  </div>
                )}
              </div>
            ))}
            <TextArea label="Any issues in application" value={data.applicationIssues} onChange={v => set('applicationIssues', v)} disabled={readOnly} />
          </SectionCard>

          {/* F — Production */}
          <SectionCard id="section-f" title="Section F — Production Considerations">
            <Radio label="Suitable for BRC manufacturing?" name="suitableBRC" value={data.suitableBRC} onChange={v => set('suitableBRC', v)} options={['Yes', 'No']} disabled={readOnly} />
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'Red', noteKey: 'redNotes', label: 'Red' },
                { key: 'Calyx', noteKey: 'calyxNotes', label: 'Calyx' },
                { key: 'Voxel', noteKey: 'voxelNotes', label: 'Voxel' },
                { key: 'RhodeIsland', noteKey: 'rhodeIslandNotes', label: 'Rhode Island' },
              ].map(({ key, noteKey, label }) => (
                <div key={key} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <Radio label={`Can be made at ${label}?`} name={`madeAt${key}`} value={data[`madeAt${key}`]}
                    onChange={v => set(`madeAt${key}`, v)} options={['Yes', 'No']} disabled={readOnly} />
                  {data[`madeAt${key}`] === 'Yes' && <Field label="Notes" value={data[noteKey]} onChange={v => set(noteKey, v)} disabled={readOnly} />}
                </div>
              ))}
            </div>
            <Radio label="Hot fill or cold mix process?" name="hotOrColdProcess" value={data.hotOrColdProcess} onChange={v => set('hotOrColdProcess', v)} options={['Hot fill', 'Cold mix']} disabled={readOnly} />
            <Field label="Estimated cook time per batch" value={data.estimatedCookTime} onChange={v => set('estimatedCookTime', v)} placeholder="e.g. 45 mins" disabled={readOnly} />
            <TextArea label="Production limitations to flag" value={data.productionLimitations} onChange={v => set('productionLimitations', v)} disabled={readOnly} />
          </SectionCard>

          {/* G — Retain Sample */}
          <SectionCard id="section-g" title="Section G — Retain Sample Log">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-800">Always make two lab samples at sign-off — one for client, one retained in the lab.</p>
            </div>
            <Radio label="Lab retain sample kept?" name="retainSampleKept" value={data.retainSampleKept} onChange={v => set('retainSampleKept', v)} options={['Yes', 'No']} disabled={readOnly} />
            {data.retainSampleKept === 'Yes' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Sample location" value={data.sampleLocation} onChange={v => set('sampleLocation', v)} placeholder="e.g. Lab fridge shelf 2" disabled={readOnly} />
                  <Field label="Sample label" value={data.sampleLabel} onChange={v => set('sampleLabel', v)} placeholder="Product · V1 · date" disabled={readOnly} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PhotoUpload
                    label="📸 Photo of retain sample bottle"
                    hint="Upload a photo of the labelled bottle being kept in the lab."
                    url={data.retainSamplePhotoUrl}
                    uploading={uploading.retainSamplePhotoUrl}
                    onUpload={file => uploadPhoto(file, 'retainSamplePhotoUrl')}
                    disabled={readOnly}
                  />
                  <PhotoUpload
                    label="🥤 Photo of prepared drink"
                    hint="Upload a photo of the syrup made up in a drink — the reference shot."
                    url={data.drinkPhotoUrl}
                    uploading={uploading.drinkPhotoUrl}
                    onUpload={file => uploadPhoto(file, 'drinkPhotoUrl')}
                    disabled={readOnly}
                  />
                </div>
              </>
            )}
          </SectionCard>

          {/* H — Sign-off */}
          <SectionCard id="section-h" title="Section H — Sign-off">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Version submitted to client" value={data.submittedToClientVersion} onChange={v => set('submittedToClientVersion', v)} placeholder="e.g. V2" disabled={readOnly} />
              <Field label="Date submitted" value={data.submittedDate} onChange={v => set('submittedDate', v)} type="date" disabled={readOnly} />
            </div>
            <TextArea label="Client feedback" value={data.clientFeedback} onChange={v => set('clientFeedback', v)} rows={3} disabled={readOnly} />
            <div className="grid grid-cols-2 gap-4">
              <Radio label="Signed off by client?" name="signedOffByClient" value={data.signedOffByClient} onChange={v => set('signedOffByClient', v)} options={['Yes', 'No']} disabled={readOnly} />
              {data.signedOffByClient === 'Yes' && <Field label="Client sign-off date" value={data.clientSignOffDate} onChange={v => set('clientSignOffDate', v)} type="date" disabled={readOnly} />}
              <Field label="Signed off internally by" value={data.signedOffInternallyBy} onChange={v => set('signedOffInternallyBy', v)} placeholder="e.g. Dima" disabled={readOnly} />
              <Field label="Internal sign-off date" value={data.internalSignOffDate} onChange={v => set('internalSignOffDate', v)} type="date" disabled={readOnly} />
            </div>
            <Radio label="Post sign-off Q&A done with client?" name="postSignOffQA" value={data.postSignOffQA} onChange={v => set('postSignOffQA', v)} options={['Yes', 'No']} disabled={readOnly} />
            <TextArea label="Q&A notes" hint="Ask: why did you prefer this version? What are the critical things you love?" value={data.qaNotes} onChange={v => set('qaNotes', v)} rows={4} disabled={readOnly} />
            {!readOnly && activeId && (
              <button onClick={() => setSignOffModal(true)} className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition">
                Mark this version as signed off ✓
              </button>
            )}
          </SectionCard>

        </div>
      </div>

      {/* New version modal */}
      {versionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Save as new version</h2>
              <p className="text-sm text-gray-400 mt-1">All current data will be copied across. What are you changing?</p>
            </div>
            <textarea value={versionNote} onChange={e => setVersionNote(e.target.value)}
              placeholder="e.g. Reduced sugar by 10%, adjusted pH, added rose extract..."
              rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setVersionModal(false); setVersionNote('') }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveVersion} disabled={saving} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">
                {saving ? 'Saving…' : `Save as V${versions.length + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign-off modal */}
      {signOffModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-4 text-center">
            <p className="text-3xl">✅</p>
            <h2 className="text-xl font-bold text-gray-900">Sign off this version?</h2>
            <p className="text-sm text-gray-400">This version will be locked. Use "+ New version" in the sidebar to continue iterating.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSignOffModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={signOff} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">Sign off ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}