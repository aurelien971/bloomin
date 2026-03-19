import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  doc, getDoc, collection, query, where,
  orderBy, getDocs, addDoc, updateDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'

const MATCH_OPTIONS = ['Match', 'Slight deviation', 'Unacceptable']

const EMPTY_BATCH = (n) => ({
  batchNumber: n,
  facility: '', date: '', assessedBy: '',
  // Syrup checks
  batchPhotoUrl: '',
  visual: {
    colourNotes: '', colourPass: '',
    clarity: '', sediment: '', separation: '',
    overallVisual: '', visualNotes: '',
  },
  analytical: {
    brix:       { target: '', actual: '', pass: '' },
    ph:         { target: '', actual: '', pass: '' },
    fillWeight: { target: '', actual: '', pass: '' },
    density:    { target: '', actual: '', pass: '' },
  },
  sensory: {
    aroma:      { match: '', notes: '' },
    sweetness:  { match: '', notes: '' },
    acidity:    { match: '', notes: '' },
    flavour:    { match: '', notes: '' },
    aftertaste: { match: '', notes: '' },
    clientWouldNotice: '',
    overallSensory: '',
  },
  // End drink checks
  application: {
    testedMilk:  '',
    milk:  { milkType: '', split: '', colourCorrect: '', flavourOk: '', pass: '' },
    testedWater: '',
    water: { colourCorrect: '', flavourOk: '', pass: '' },
    testedSoda:  '',
    soda:  { colourCorrect: '', clouding: '', pass: '' },
    overallApplication: '',
  },
  process: {
    correctProcess: '', deviations: '', deviationDetail: '',
    cookTime: '', fillTemp: '', overallProcess: '',
  },
  status: 'draft',
})

export default function ValidationPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,     setProduct]     = useState(null)
  const [brief,       setBrief]       = useState(null)
  const [labSheet,    setLabSheet]    = useState(null)
  const [batches,     setBatches]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState({})
  const [activeBatch, setActiveBatch] = useState(0)
  const [activeSection, setActiveSection] = useState('syrup')
  const [factories,   setFactories]   = useState([])
  const [teamList,    setTeamList]    = useState([])
  const [briefOpen,   setBriefOpen]   = useState(true)

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    setLoading(true)
    let signedSheet = null
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }
      setProduct(p)

      if (p.briefId) {
        const bSnap = await getDoc(doc(db, 'briefs', p.briefId))
        if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })

        const lSnap = await getDocs(query(
          collection(db, 'labSheets'),
          where('briefId', '==', p.briefId),
          orderBy('createdAt', 'desc')
        ))
        const sheets = lSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        signedSheet = sheets.find(s => s.status === 'signed-off') || sheets[0] || null
        if (signedSheet) setLabSheet(signedSheet)
      }

      const bSnap = await getDocs(query(
        collection(db, 'validationBatches'),
        where('productId', '==', productId),
        orderBy('batchNumber', 'asc')
      ))
      if (!bSnap.empty) {
        setBatches(bSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })))
      } else {
        const labData = signedSheet?.data || {}
        const pre = (n) => {
          const b = EMPTY_BATCH(n)
          b.analytical.brix.target       = labData.analytical?.brix?.target || ''
          b.analytical.ph.target         = labData.analytical?.ph?.target   || ''
          b.analytical.fillWeight.target = labData.fillWeightPerVolume       || ''
          b.analytical.density.target    = labData.density                   || ''
          return b
        }
        setBatches([pre(1), pre(2), pre(3)])
      }

      const [fSnap, uSnap] = await Promise.all([
        getDocs(collection(db, 'factories')),
        getDocs(collection(db, 'users')),
      ])
      setFactories(fSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
      setTeamList(uSnap.docs.map(d => d.data().name).filter(Boolean).sort())

    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const upd = (field, value) => {
    setBatches(bs => bs.map((b, i) => i === activeBatch ? deepSet(b, field, value) : b))
  }

  const deepSet = (obj, path, value) => {
    const keys = path.split('.')
    const clone = { ...obj }
    let cur = clone
    for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]] }
    cur[keys[keys.length - 1]] = value
    return clone
  }

  const uploadBatchPhoto = async (file) => {
    setUploading(u => ({ ...u, photo: true }))
    try {
      const sRef = storageRef(storage, `validation/${productId}/batch-${activeBatch + 1}-${Date.now()}`)
      await uploadBytes(sRef, file)
      upd('batchPhotoUrl', await getDownloadURL(sRef))
    } catch (e) { console.error(e) }
    setUploading(u => ({ ...u, photo: false }))
  }

  const saveBatch = async () => {
    if (!product) return
    setSaving(true)
    try {
      const updated = []
      for (const bat of batches) {
        const data = { ...bat, productId, updatedAt: new Date().toISOString() }
        delete data.firestoreId
        if (bat.firestoreId) {
          await updateDoc(doc(db, 'validationBatches', bat.firestoreId), data)
          updated.push({ firestoreId: bat.firestoreId, ...data })
        } else {
          const ref = await addDoc(collection(db, 'validationBatches'), { ...data, createdAt: new Date().toISOString() })
          updated.push({ firestoreId: ref.id, ...data })
        }
      }
      setBatches(updated)
      const completed = updated.filter(bat => bat.visual?.overallVisual && bat.sensory?.overallSensory && bat.process?.overallProcess).length
      await updateDoc(doc(db, 'products', productId), {
        'stages.validation.status':           completed === updated.length ? 'complete' : 'in-progress',
        'stages.validation.batchesCompleted': completed,
        ...(completed === updated.length ? { 'stages.batchDecision.status': 'in-progress' } : {}),
      })
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const b   = batches[activeBatch] || EMPTY_BATCH(activeBatch + 1)
  const fd  = brief?.formData || {}
  const ld  = labSheet?.data  || {}

  const uses         = Array.isArray(fd.uses) ? fd.uses : []
  const milkUses     = ['Hot milk drinks', 'Cold milk drinks', 'Matcha / powder drinks']
  const briefUsesMilk  = uses.some(u => milkUses.includes(u)) || !uses.length
  const briefUsesWater = uses.includes('Still water') || !uses.length
  const briefUsesSoda  = uses.includes('Sparkling water / soda') || !uses.length

  // Section completion per active batch
  const sectionDone = {
    syrup: !!(b.visual?.overallVisual && b.sensory?.overallSensory),
    drink: !!(b.application?.overallApplication || b.process?.overallProcess),
  }
  const allBatchesDone = batches.length > 0 && batches.every(bat =>
    bat.visual?.overallVisual && bat.sensory?.overallSensory
  )

  const criticalAttrs = (ld.criticalAttributes || []).filter(a => a?.trim())

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Head><title>Test Batch — {product?.productName}</title></Head>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-6 sm:h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0 hidden sm:block" />
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-semibold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50">{product?.clientName} · Test Batch</p>
            </div>
          </div>
          <button onClick={saveBatch} disabled={saving} className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40 flex-shrink-0">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Batch tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto border-t border-white/10">
          {batches.map((bat, i) => {
            const done = bat.visual?.overallVisual && bat.sensory?.overallSensory
            return (
              <button key={i} onClick={() => setActiveBatch(i)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${activeBatch === i ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : 'bg-gray-500'}`} />
                Batch {i + 1}
              </button>
            )
          })}
          <button onClick={() => setBatches(bs => [...bs, EMPTY_BATCH(bs.length + 1)])}
            className="px-4 py-2.5 text-sm text-white/30 hover:text-white/60 transition whitespace-nowrap">
            + Add batch
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Page title */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{product?.clientName}</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{product?.productName} — Test Batch Validation</h1>
          <p className="text-sm text-gray-400 mt-1">A bottle came off the factory line. Does it match the signed-off lab version?</p>
          {labSheet && <p className="text-xs text-gray-400 mt-1">Reference: <span className="font-semibold text-gray-600">V{labSheet.versionNumber} — {labSheet.versionName}</span></p>}
        </div>

        {/* Brief reference */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button onClick={() => setBriefOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-50 hover:bg-blue-100 transition">
            <div className="flex items-center gap-2">
              <span className="text-xs">📋</span>
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Brief reference</span>
            </div>
            <span className="text-blue-400 text-xs">{briefOpen ? '▲ hide' : '▼ show'}</span>
          </button>
          {briefOpen && (
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Primary flavour', val: fd.primaryFlavour },
                { label: 'Sweetness',       val: fd.sweetness },
                { label: 'Clarity',         val: fd.clarity },
                { label: 'Syrup colour',    val: fd.syrupColour },
                { label: 'End drink colour',val: fd.endDrinkColour },
                { label: 'End drink type',  val: fd.endDrinkType },
                { label: 'Uses',            val: Array.isArray(fd.uses) ? fd.uses.join(', ') : fd.uses },
                { label: 'Milk types',      val: Array.isArray(fd.milkTypes) ? fd.milkTypes.join(', ') : fd.milkTypes },
                { label: 'Brix target',     val: ld.analytical?.brix?.target ? `${ld.analytical.brix.min}–${ld.analytical.brix.max} (target ${ld.analytical.brix.target})` : null },
                { label: 'pH target',       val: ld.analytical?.ph?.target   ? `${ld.analytical.ph.min}–${ld.analytical.ph.max} (target ${ld.analytical.ph.target})` : null },
                { label: 'Fill weight',     val: ld.fillWeightPerVolume },
                { label: 'Density',         val: ld.density },
              ].filter(f => f.val).map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="text-sm text-gray-800">{f.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Batch info */}
        <Card title={`Batch ${activeBatch + 1} — Details`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Production facility</Label>
              <select value={b.facility || ''} onChange={e => upd('facility', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">Select...</option>
                {factories.length > 0
                  ? factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)
                  : ['Red Distillery', 'Calyx', 'Voxel', 'Rhode Island'].map(f => <option key={f} value={f}>{f}</option>)
                }
              </select>
              {factories.length === 0 && <p className="text-xs text-amber-500 mt-1">Run seedFactories.js to load from DB</p>}
            </div>
            <div>
              <Label>Production date</Label>
              <input type="date" value={b.date || ''} onChange={e => upd('date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <Label>Assessed by</Label>
              <input
                list={`team-list-${activeBatch}`}
                value={b.assessedBy || ''} onChange={e => upd('assessedBy', e.target.value)}
                placeholder="Type a name..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <datalist id={`team-list-${activeBatch}`}>
                {teamList.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>
        </Card>

        {/* Section tabs — Syrup | End Drink */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[
              { key: 'syrup', label: '🫙 The Syrup',    sub: 'Visual, analytical & sensory' },
              { key: 'drink', label: '☕ The End Drink', sub: 'Application & process' },
            ].map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex-1 flex flex-col items-center py-3 px-4 border-b-2 transition ${activeSection === s.key ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sectionDone[s.key] ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <span className="text-xs text-gray-400 mt-0.5 hidden sm:block">{s.sub}</span>
              </button>
            ))}
          </div>

          <div className="px-5 py-5 space-y-6">

            {/* ── SYRUP TAB ──────────────────────────────────────────────── */}
            {activeSection === 'syrup' && <>

              {/* Visual — photo comparison */}
              <Section title="Visual Check" sub="How does this bottle look vs the lab reference?">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lab reference</p>
                    {ld.retainSamplePhotoUrl
                      ? <img src={ld.retainSamplePhotoUrl} alt="Lab reference" className="w-full h-44 object-cover rounded-xl border border-gray-200" />
                      : <div className="w-full h-44 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center"><p className="text-xs text-gray-400 text-center px-4">No lab reference photo</p></div>
                    }
                    {labSheet && <p className="text-xs text-gray-400 mt-1 text-center">V{labSheet.versionNumber} · {labSheet.versionName}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This batch</p>
                    {b.batchPhotoUrl
                      ? <label className="relative group block cursor-pointer">
                          <img src={b.batchPhotoUrl} alt="This batch" className="w-full h-44 object-cover rounded-xl border border-gray-200" />
                          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white text-xs font-semibold">Replace</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && uploadBatchPhoto(e.target.files[0])} />
                        </label>
                      : <label className="cursor-pointer w-full h-44 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-400 transition">
                          {uploading.photo ? <><span className="text-xl">⏳</span><span className="text-xs">Uploading...</span></> : <><span className="text-2xl">📸</span><span className="text-xs font-medium">Take a photo of this bottle</span></>}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && uploadBatchPhoto(e.target.files[0])} />
                        </label>
                    }
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Syrup colour — this batch</Label>
                    {ld.colourNeat && <p className="text-xs text-gray-400 mb-1">Lab: "{ld.colourNeat}"</p>}
                    <input value={b.visual?.colourNotes || ''} onChange={e => upd('visual.colourNotes', e.target.value)}
                      placeholder="Describe the colour..." className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <PassFail label="Colour match?" value={b.visual?.colourPass} onChange={v => upd('visual.colourPass', v)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'clarity',    label: 'Clarity / haze' },
                    { key: 'sediment',   label: 'Particles / sediment' },
                    { key: 'separation', label: 'Separation' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <div className="flex gap-1.5">
                        {['Pass', 'Fail'].map(o => (
                          <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.visual?.[key] === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                            <input type="radio" className="hidden" onChange={() => upd(`visual.${key}`, o)} />{o}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <PassFail label="Overall visual" value={b.visual?.overallVisual} onChange={v => upd('visual.overallVisual', v)} />
                <textarea value={b.visual?.visualNotes || ''} onChange={e => upd('visual.visualNotes', e.target.value)}
                  placeholder="Any other visual notes..." rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
              </Section>

              {/* Analytical */}
              <Section title="Analytical Checks" sub="Measure and compare against lab targets.">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['', 'Lab target', 'This batch', 'Pass / Fail'].map(h => (
                          <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'brix',       label: 'Brix',         range: ld.analytical?.brix   ? `Range: ${ld.analytical.brix.min}–${ld.analytical.brix.max}` : '' },
                        { key: 'ph',         label: 'pH',           range: ld.analytical?.ph     ? `Range: ${ld.analytical.ph.min}–${ld.analytical.ph.max}` : '' },
                        { key: 'fillWeight', label: 'Fill weight',  range: '' },
                        { key: 'density',    label: 'Density (g/mL)', range: '' },
                      ].map(({ key, label, range }) => {
                        const row = b.analytical?.[key] || {}
                        return (
                          <tr key={key} className={`border-t border-gray-50 ${row.pass === 'Fail' ? 'bg-red-50/40' : row.pass === 'Pass' ? 'bg-green-50/20' : ''}`}>
                            <td className="py-2.5 pr-4">
                              <p className="font-semibold text-gray-700">{label}</p>
                              {range && <p className="text-xs text-gray-400">{range}</p>}
                            </td>
                            <td className="py-2 pr-3">
                              <input value={row.target || ''} onChange={e => upd(`analytical.${key}.target`, e.target.value)} placeholder="—" className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                            </td>
                            <td className="py-2 pr-3">
                              <input value={row.actual || ''} onChange={e => upd(`analytical.${key}.actual`, e.target.value)} placeholder="—" className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                {['Pass', 'Fail'].map(o => (
                                  <label key={o} className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${row.pass === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                                    <input type="radio" className="hidden" onChange={() => upd(`analytical.${key}.pass`, o)} />{o}
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Sensory */}
              <Section title="Sensory Check" sub="Blind assessment of the syrup against the lab retain sample.">
                {criticalAttrs.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-red-700 mb-1">⚠ Critical attributes — must match</p>
                    {criticalAttrs.map((a, i) => <p key={i} className="text-xs text-red-700">· {a}</p>)}
                  </div>
                )}
                <div className="space-y-3">
                  {[
                    { key: 'aroma',      label: 'Aroma',             hint: ld.aroma       || '' },
                    { key: 'sweetness',  label: 'Sweetness',         hint: ld.sweetness   || '' },
                    { key: 'acidity',    label: 'Acidity',           hint: ld.acidity     || '' },
                    { key: 'flavour',    label: 'Flavour',           hint: ld.primaryFlavour || '' },
                    { key: 'aftertaste', label: 'Aftertaste / finish', hint: ld.aftertaste || '' },
                  ].map(({ key, label, hint }) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="sm:w-44 flex-shrink-0">
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        {hint && <p className="text-xs text-gray-400 truncate">Lab: {hint}</p>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {MATCH_OPTIONS.map(o => (
                          <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.sensory?.[key]?.match === o ? (o === 'Match' ? 'bg-green-500 text-white border-green-500' : o === 'Slight deviation' ? 'bg-amber-400 text-white border-amber-400' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                            <input type="radio" className="hidden" onChange={() => upd(`sensory.${key}.match`, o)} />{o}
                          </label>
                        ))}
                      </div>
                      <input value={b.sensory?.[key]?.notes || ''} onChange={e => upd(`sensory.${key}.notes`, e.target.value)}
                        placeholder="Notes..." className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-gray-700">Would the client notice a difference vs the signed-off sample?</p>
                  <div className="flex gap-2">
                    {['Yes', 'No', 'Possibly'].map(o => (
                      <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.sensory?.clientWouldNotice === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
                        <input type="radio" className="hidden" onChange={() => upd('sensory.clientWouldNotice', o)} />{o}
                      </label>
                    ))}
                  </div>
                </div>
                <PassFail label="Overall sensory" value={b.sensory?.overallSensory} onChange={v => upd('sensory.overallSensory', v)} />
              </Section>
            </>}

            {/* ── END DRINK TAB ──────────────────────────────────────────── */}
            {activeSection === 'drink' && <>

              {/* Drink reference photo if available */}
              {ld.drinkPhotoUrl && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lab drink reference</p>
                  <img src={ld.drinkPhotoUrl} alt="Lab drink reference" className="h-36 object-cover rounded-xl border border-gray-200" />
                  {ld.colourInDrink && <p className="text-xs text-gray-400 mt-1">Lab colour: "{ld.colourInDrink}"</p>}
                </div>
              )}

              {/* Application */}
              <Section title="Application Check" sub="Does it work in the actual drink? Test against the brief.">
                <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  Only test what's in the client brief. Toggle Yes to expand each test.
                </p>

                {briefUsesMilk && (
                  <AppTest label={`Milk drink ${Array.isArray(fd.milkTypes) && fd.milkTypes.length ? `(${fd.milkTypes.join(', ')})` : ''}`}
                    tested={b.application?.testedMilk} onTestedChange={v => upd('application.testedMilk', v)}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><Label>Milk type used</Label>
                        <input value={b.application?.milk?.milkType || ''} onChange={e => upd('application.milk.milkType', e.target.value)}
                          placeholder={Array.isArray(fd.milkTypes) ? fd.milkTypes[0] : 'e.g. Oat'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                      <YesNo label="Colour correct?" value={b.application?.milk?.colourCorrect} onChange={v => upd('application.milk.colourCorrect', v)} />
                      <YesNo label="Did it split?" value={b.application?.milk?.split} onChange={v => upd('application.milk.split', v)} yesIsBad />
                      <PassFail label="Result" value={b.application?.milk?.pass} onChange={v => upd('application.milk.pass', v)} />
                    </div>
                  </AppTest>
                )}

                {briefUsesWater && (
                  <AppTest label="Still water" tested={b.application?.testedWater} onTestedChange={v => upd('application.testedWater', v)}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <YesNo label="Colour correct?" value={b.application?.water?.colourCorrect} onChange={v => upd('application.water.colourCorrect', v)} />
                      <YesNo label="Flavour correct?" value={b.application?.water?.flavourOk} onChange={v => upd('application.water.flavourOk', v)} />
                      <PassFail label="Result" value={b.application?.water?.pass} onChange={v => upd('application.water.pass', v)} />
                    </div>
                  </AppTest>
                )}

                {briefUsesSoda && (
                  <AppTest label="Sparkling / soda" tested={b.application?.testedSoda} onTestedChange={v => upd('application.testedSoda', v)}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <YesNo label="Colour correct?" value={b.application?.soda?.colourCorrect} onChange={v => upd('application.soda.colourCorrect', v)} />
                      <YesNo label="Clouding present?" value={b.application?.soda?.clouding} onChange={v => upd('application.soda.clouding', v)} yesIsBad />
                      <PassFail label="Result" value={b.application?.soda?.pass} onChange={v => upd('application.soda.pass', v)} />
                    </div>
                  </AppTest>
                )}

                <PassFail label="Overall application" value={b.application?.overallApplication} onChange={v => upd('application.overallApplication', v)} />
              </Section>

              {/* Process */}
              <Section title="Process Check" sub="Was the factory process correct for this batch?">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <YesNo label="Correct process followed?" value={b.process?.correctProcess} onChange={v => upd('process.correctProcess', v)} />
                  <YesNo label="Any deviations recorded?" value={b.process?.deviations} onChange={v => upd('process.deviations', v)} yesIsBad />
                </div>
                {b.process?.deviations === 'Yes' && (
                  <textarea value={b.process?.deviationDetail || ''} onChange={e => upd('process.deviationDetail', e.target.value)}
                    placeholder="Describe deviations..." rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Actual cook time</Label>
                    <input value={b.process?.cookTime || ''} onChange={e => upd('process.cookTime', e.target.value)}
                      placeholder={ld.estimatedCookTime || 'e.g. 45 mins'}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                  <div><Label>Fill temperature (°C)</Label>
                    <input value={b.process?.fillTemp || ''} onChange={e => upd('process.fillTemp', e.target.value)} placeholder="e.g. 40"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                </div>
                <PassFail label="Overall process" value={b.process?.overallProcess} onChange={v => upd('process.overallProcess', v)} />
              </Section>
            </>}
          </div>
        </div>

        {/* Save CTA + completion status */}
        <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${allBatchesDone ? 'bg-black border-black' : 'bg-white border-gray-200'}`}>
          <div>
            <p className={`text-sm font-semibold ${allBatchesDone ? 'text-white' : 'text-gray-500'}`}>
              {allBatchesDone ? `✓ All ${batches.length} batch${batches.length !== 1 ? 'es' : ''} checked — save to advance to batch decision` : `${batches.filter(bat => bat.visual?.overallVisual && bat.sensory?.overallSensory).length} of ${batches.length} batches complete`}
            </p>
            {!allBatchesDone && <p className="text-xs text-gray-400 mt-0.5">Complete visual + sensory on each batch to finish</p>}
          </div>
          <button onClick={saveBatch} disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition flex-shrink-0 ${allBatchesDone ? 'bg-white text-black hover:bg-gray-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-gray-100 pb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function AppTest({ label, tested, onTestedChange, children }) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <div className="flex gap-2">
          {['Yes', 'No'].map(o => (
            <label key={o} className={`px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer transition ${tested === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
              <input type="radio" className="hidden" onChange={() => onTestedChange(o)} />{o}
            </label>
          ))}
        </div>
      </div>
      {tested === 'Yes' && <div className="px-4 py-4">{children}</div>}
    </div>
  )
}

function Card({ title, sub, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="px-5 py-5 space-y-4">{children}</div>
    </div>
  )
}
function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{children}</p>
}
function PassFail({ label, value, onChange }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        {['Pass', 'Fail'].map(o => (
          <label key={o} className={`px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition ${value === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
            <input type="radio" className="hidden" onChange={() => onChange(o)} />{o}
          </label>
        ))}
      </div>
    </div>
  )
}
function YesNo({ label, value, onChange, yesIsBad = false }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        {['Yes', 'No'].map(o => {
          const isGood = yesIsBad ? o === 'No' : o === 'Yes'
          return (
            <label key={o} className={`px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition ${value === o ? (isGood ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              <input type="radio" className="hidden" onChange={() => onChange(o)} />{o}
            </label>
          )
        })}
      </div>
    </div>
  )
}