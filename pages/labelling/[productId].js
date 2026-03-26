import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'

// ── Constants ─────────────────────────────────────────────────────────────────
const ALLERGENS = [
  'Cereals containing gluten',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Peanuts',
  'Soybeans',
  'Milk',
  'Nuts',
  'Celery',
  'Mustard',
  'Sesame seeds',
  'Sulphur dioxide and sulphites (>10ppm SO₂)',
  'Lupin',
  'Molluscs',
]

const NUTRIENT_ROWS = [
  { key: 'energyKj',    label: 'Energy (kJ)',          indent: false },
  { key: 'energyKcal',  label: 'Energy (kcal)',         indent: false },
  { key: 'fat',         label: 'Fat (g)',               indent: false },
  { key: 'saturates',   label: 'Of which — Saturates',  indent: true  },
  { key: 'carbs',       label: 'Carbohydrate (g)',       indent: false },
  { key: 'sugars',      label: 'Of which — Sugars',     indent: true  },
  { key: 'fibre',       label: 'Fibre (g)',             indent: false },
  { key: 'protein',     label: 'Protein (N×6.25) (g)',  indent: false },
  { key: 'salt',        label: 'Salt (g)',              indent: false },
]

const EMPTY_ALLERGEN = () => ({ contains: '', crossContamination: '' })
const EMPTY_NUTRIENT = () => ({ per100: '', perServing: '', ri: '' })
const EMPTY_ACTIVE   = { name: '', per100: '', perServing: '', ri: '' }
const EMPTY_CLAIM    = { claim: '', permitted: '', ingredient: '', levelPerServe: '' }

const EMPTY_DATA = () => ({
  designedBy:      'Bloomin',   // 'Bloomin' | 'Client'
  servingSize:     '',
  allergens:       Object.fromEntries(ALLERGENS.map(a => [a, EMPTY_ALLERGEN()])),
  targetNutrients: Object.fromEntries([...NUTRIENT_ROWS.map(r => r.key)].map(k => [k, EMPTY_NUTRIENT()])),
  calcNutrients:   Object.fromEntries([...NUTRIENT_ROWS.map(r => r.key)].map(k => [k, EMPTY_NUTRIENT()])),
  activeIngredients: [
    { ...EMPTY_ACTIVE }, { ...EMPTY_ACTIVE }, { ...EMPTY_ACTIVE }, { ...EMPTY_ACTIVE },
  ],
  claims:          [{ ...EMPTY_CLAIM }],
  labelFiles:      [],   // [{ name, url, uploadedAt, uploadedBy }]
  notes:           '',
})

// ── YesNo chip ────────────────────────────────────────────────────────────────
function YesNoChip({ value, onChange, yesLabel = 'Yes', noLabel = 'No', disabled }) {
  return (
    <div className="flex gap-1">
      {[yesLabel, noLabel].map(o => (
        <button key={o} type="button" disabled={disabled} onClick={() => !disabled && onChange(o)}
          className={`px-2 py-1 rounded-lg border text-xs font-semibold transition ${value === o
            ? o === yesLabel ? 'bg-red-500 text-white border-red-500' : 'bg-green-500 text-white border-green-500'
            : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LabellingPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,    setProduct]    = useState(null)
  const [brief,      setBrief]      = useState(null)
  const [labTesting, setLabTesting] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [activeTab,  setActiveTab]  = useState('allergens')
  const [data,       setData]       = useState(EMPTY_DATA())
  const [userList,   setUserList]   = useState([])
  const fileRef = useRef(null)

  const labTestingDone = product?.stages?.labTesting?.status === 'complete'

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }
      setProduct(p)

      if (p.briefId) {
        const bSnap = await getDoc(doc(db, 'briefs', p.briefId))
        if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })
      }

      // Load existing labelling data
      if (p.stages?.labelling?.data) {
        setData({ ...EMPTY_DATA(), ...p.stages.labelling.data })
      } else {
        // Pre-populate allergens from brief if available
        const fd = p.stages?.brief ? {} : {}
        setData(EMPTY_DATA())
      }

      // Load lab testing results for auto-population hint
      const ltSnap = await getDocs(query(
        collection(db, 'labTests'),
        where('productId', '==', productId)
      ))
      if (!ltSnap.empty) setLabTesting({ id: ltSnap.docs[0].id, ...ltSnap.docs[0].data() })

      const uSnap = await getDocs(collection(db, 'users'))
      setUserList(uSnap.docs.map(d => d.data().name).filter(Boolean).sort())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const set = (path, value) => {
    setData(d => {
      const clone = JSON.parse(JSON.stringify(d))
      const keys = path.split('.')
      let cur = clone
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]
      cur[keys[keys.length - 1]] = value
      return clone
    })
  }

  const save = async (markComplete = false) => {
    if (!product) return
    setSaving(true)
    try {
      const update = {
        'stages.labelling.data':      data,
        'stages.labelling.updatedAt':    new Date().toISOString(),
        'stages.labelling.labelVersion': (product?.stages?.labelling?.labelVersion || 0) + 1,
      }
      if (markComplete) {
        update['stages.labelling.status']      = 'complete'
        update['stages.labelling.completedAt'] = new Date().toISOString()
        update['stages.release.status']        = 'in-progress'
      } else {
        update['stages.labelling.status'] = 'in-progress'
      }
      await updateDoc(doc(db, 'products', productId), update)
      setProduct(p => ({ ...p, stages: { ...p.stages, labelling: { ...p.stages?.labelling, ...update } } }))
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const uploadFile = async (file) => {
    setUploading(true)
    try {
      const sRef = storageRef(storage, `labelling/${productId}/${Date.now()}-${file.name}`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      const newFile = { name: file.name, url, uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
      set('labelFiles', [...(data.labelFiles || []), newFile])
    } catch (e) { console.error(e) }
    setUploading(false)
  }

  const allAllergensFilled = ALLERGENS.every(a => data.allergens?.[a]?.contains)
  const targetNutrientsFilled = data.targetNutrients?.energyKj?.per100
  const done = product?.stages?.labelling?.status === 'complete'

  const fd = brief?.formData || {}

  const TABS = [
    { key: 'allergens',   label: '⚠️ Allergens',     done: allAllergensFilled },
    { key: 'nutrition',   label: '📊 Nutrition',      done: !!targetNutrientsFilled },
    { key: 'claims',      label: '✓ Claims',          done: data.claims?.some(c => c.claim) },
    { key: 'design',      label: '🎨 Label Design',   done: data.labelFiles?.length > 0 },
  ]

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Head><title>Labelling — {product?.productName}</title></Head>

      {/* Header */}
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
              <p className="text-xs text-white/50">{product?.clientName} · Labelling</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {done && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">Complete ✓</span>}
            <button onClick={() => save(false)} disabled={saving}
              className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Title */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{product?.clientName}</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{product?.productName} — Labelling</h1>
          <p className="text-sm text-gray-400 mt-1">Allergen declaration, nutritional panel, product claims and label design files.</p>
          {product?.stages?.labelling?.labelVersion && (
            <p className="text-xs mt-1">
              <span className="font-semibold text-gray-600">Label v{product.stages.labelling.labelVersion}</span>
              {product.stages.labelling.updatedAt ? <span className="text-gray-400"> · Last saved {new Date(product.stages.labelling.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(product.stages.labelling.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> : ''}
            </p>
          )}
        </div>

        {/* Label ownership toggle */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Who is designing the label?</p>
            <p className="text-xs text-gray-400 mt-0.5">This determines who needs to provide artwork files. Technical data (allergens, nutrition) is always filled by Bloomin.</p>
          </div>
          <div className="flex gap-2">
            {['Bloomin', 'Client'].map(o => (
              <button key={o} onClick={() => set('designedBy', o)}
                className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition ${data.designedBy === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Serving size — used across both nutritional panels */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Serving size</p>
            <p className="text-xs text-gray-400 mt-0.5">Used to calculate per serving columns across both nutritional panels.</p>
          </div>
          <input value={data.servingSize || ''} onChange={e => set('servingSize', e.target.value)}
            placeholder="e.g. 20ml (2 pumps)"
            className="w-48 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        </div>

        {/* Section tabs */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition ${activeTab === t.key ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.done ? 'bg-green-400' : 'bg-gray-200'}`} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-5 space-y-6">

            {/* ── ALLERGENS ────────────────────────────────────────────── */}
            {activeTab === 'allergens' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800">⚠️ Draft allergen declaration — must be verified against final recipe and supplier specs before printing.</p>
                </div>

                {/* Brief reference for allergen context */}
                {(fd.allergens || fd.dietary?.length) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2">📋 From the client brief</p>
                    <div className="flex flex-wrap gap-3">
                      {fd.allergens && <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Allergens flagged</p><p className="text-xs text-blue-800">{fd.allergens}</p></div>}
                      {fd.dietary?.length && <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Dietary</p><p className="text-xs text-blue-800">{(fd.dietary || []).join(', ')}</p></div>}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 pr-4 text-left w-8">#</th>
                        <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 pr-8 text-left">Allergen</th>
                        <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 pr-4 text-left">Contains?</th>
                        <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 text-left">Cross-contamination risk?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALLERGENS.map((allergen, i) => {
                        const row = data.allergens?.[allergen] || EMPTY_ALLERGEN()
                        return (
                          <tr key={allergen} className={`border-t border-gray-50 ${row.contains === 'Yes' ? 'bg-red-50/30' : ''}`}>
                            <td className="py-2.5 pr-4 text-xs text-gray-400 font-medium">{i + 1}</td>
                            <td className="py-2.5 pr-8">
                              <p className="text-sm text-gray-800">{allergen}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <YesNoChip value={row.contains} onChange={v => set(`allergens.${allergen}.contains`, v)} />
                            </td>
                            <td className="py-2">
                              <YesNoChip value={row.crossContamination}
                                onChange={v => set(`allergens.${allergen}.crossContamination`, v)}
                                yesLabel="Risk" noLabel="No risk" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── NUTRITION ────────────────────────────────────────────── */}
            {activeTab === 'nutrition' && (
              <>
                {/* Active ingredient names */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Active ingredient labels</p>
                  <p className="text-xs text-gray-400 mb-3">Name your active ingredients — these labels appear in both nutritional panels below.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {data.activeIngredients.map((ai, i) => (
                      <div key={i}>
                        <label className="block text-xs text-gray-400 mb-1">Active {i + 1}</label>
                        <input value={ai.name || ''} onChange={e => {
                          const n = [...data.activeIngredients]; n[i] = { ...n[i], name: e.target.value }
                          set('activeIngredients', n)
                        }} placeholder={`e.g. Lion's Mane`}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target nutritional */}
                <NutritionalPanel
                  title="Target Nutritional Information"
                  subtitle="Based on recipe — to be confirmed by lab testing."
                  color="blue"
                  data={data.targetNutrients}
                  activeIngredients={data.activeIngredients}
                  servingSize={data.servingSize}
                  onChange={(key, field, val) => set(`targetNutrients.${key}.${field}`, val)}
                  onActiveChange={(i, field, val) => {
                    const n = [...data.activeIngredients]; n[i] = { ...n[i], [field]: val }
                    set('activeIngredients', n)
                  }}
                  locked={false}
                />

                {/* Calculated nutritional — locked until lab testing done */}
                <NutritionalPanel
                  title="Calculated Nutritional Information"
                  subtitle={labTestingDone ? "From confirmed lab results." : "Unlocks after lab testing is complete."}
                  color="green"
                  data={data.calcNutrients}
                  activeIngredients={data.activeIngredients}
                  servingSize={data.servingSize}
                  onChange={(key, field, val) => set(`calcNutrients.${key}.${field}`, val)}
                  onActiveChange={(i, field, val) => {
                    const n = [...data.activeIngredients]; n[i] = { ...n[i], [field]: val }
                    set('activeIngredients', n)
                  }}
                  locked={!labTestingDone}
                />
              </>
            )}

            {/* ── CLAIMS ───────────────────────────────────────────────── */}
            {activeTab === 'claims' && (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Desired product claims</p>
                  <p className="text-xs text-gray-400 mb-4">Each claim needs to be substantiated by a specific ingredient at a required level per serve.</p>

                  {/* Brief claims reference */}
                  {(fd.healthClaims?.length || fd.nutritionalClaims?.length || fd.productClaims?.length) && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
                      <p className="text-xs font-semibold text-blue-700 mb-2">📋 Claims requested in the brief</p>
                      <div className="flex flex-wrap gap-2">
                        {[...(fd.productClaims || []), ...(fd.nutritionalClaims || []), ...(fd.healthClaims || [])].map(c => (
                          <span key={c} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Claims table */}
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-3">
                      {[['Claim', 4], ['Permitted in market?', 3], ['Ingredient to substantiate', 3], ['Required per serve', 2]].map(([h, span]) => (
                        <p key={h} className={`text-xs font-semibold text-gray-400 uppercase tracking-wide col-span-${span}`}>{h}</p>
                      ))}
                    </div>

                    {data.claims.map((claim, i) => (
                      <div key={i} className="sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center space-y-2 sm:space-y-0 bg-gray-50 sm:bg-transparent rounded-xl p-3 sm:p-0">
                        <input value={claim.claim || ''} onChange={e => { const n = [...data.claims]; n[i] = { ...n[i], claim: e.target.value }; set('claims', n) }}
                          placeholder="e.g. Low sugar, Gut health, Vegan"
                          className="sm:col-span-4 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                        <div className="sm:col-span-3 flex gap-1">
                          {['Yes', 'No', 'TBC'].map(o => (
                            <button key={o} onClick={() => { const n = [...data.claims]; n[i] = { ...n[i], permitted: o }; set('claims', n) }}
                              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${claim.permitted === o ? (o === 'Yes' ? 'bg-green-500 text-white border-green-500' : o === 'No' ? 'bg-red-500 text-white border-red-500' : 'bg-amber-400 text-white border-amber-400') : 'border-gray-200 text-gray-500'}`}>
                              {o}
                            </button>
                          ))}
                        </div>
                        <input value={claim.ingredient || ''} onChange={e => { const n = [...data.claims]; n[i] = { ...n[i], ingredient: e.target.value }; set('claims', n) }}
                          placeholder="e.g. Lion's Mane Extract"
                          className="sm:col-span-3 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                        <div className="sm:col-span-2 flex items-center gap-2">
                          <input value={claim.levelPerServe || ''} onChange={e => { const n = [...data.claims]; n[i] = { ...n[i], levelPerServe: e.target.value }; set('claims', n) }}
                            placeholder="e.g. 500mg"
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                          <button onClick={() => set('claims', data.claims.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition text-lg flex-shrink-0">×</button>
                        </div>
                      </div>
                    ))}

                    <button onClick={() => set('claims', [...data.claims, { ...EMPTY_CLAIM }])}
                      className="text-sm text-gray-500 hover:text-black font-medium transition">+ Add claim</button>
                  </div>
                </div>
              </>
            )}

            {/* ── LABEL DESIGN ─────────────────────────────────────────── */}
            {activeTab === 'design' && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Label design files</p>
                    <p className="text-xs text-gray-400">
                      {data.designedBy === 'Client'
                        ? 'The client is designing the label. Upload their artwork files here for your records.'
                        : 'Bloomin is designing the label. Upload artwork versions here.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Accepts PDF, PNG, JPG, AI, EPS — any format.</p>
                  </div>
                  <label className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex-shrink-0 ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-black text-white hover:bg-gray-900'}`}>
                    {uploading ? 'Uploading…' : '+ Upload file'}
                    <input type="file" accept="*/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                  </label>
                </div>

                {data.labelFiles?.length === 0 ? (
                  <label className="cursor-pointer w-full py-16 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 transition">
                    <span className="text-3xl">🎨</span>
                    <span className="text-sm font-medium">Drop a file or click to upload</span>
                    <span className="text-xs">PDF, PNG, JPG, AI, EPS...</span>
                    <input type="file" accept="*/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                  </label>
                ) : (
                  <div className="space-y-2">
                    {data.labelFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{f.name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400">{f.uploadedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <a href={f.url} target="_blank" rel="noreferrer"
                            className="text-xs text-gray-500 hover:text-black font-medium transition border border-gray-200 px-3 py-1.5 rounded-lg">
                            Open ↗
                          </a>
                          <button onClick={() => set('labelFiles', data.labelFiles.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-400 transition text-lg">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Label notes</label>
                  <textarea value={data.notes || ''} onChange={e => set('notes', e.target.value)}
                    placeholder="e.g. Print-ready by 15 Apr, use Bloomin brand guidelines v2, client wants rose gold foil..."
                    rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer CTA */}
        <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <div>
            {done
              ? <p className="text-sm font-semibold text-green-800">✓ Labelling complete — ready for release</p>
              : <p className="text-sm text-gray-500">Complete all tabs to mark labelling done and unlock release.</p>
            }
            {!done && (
              <p className="text-xs text-gray-400 mt-0.5">
                {[
                  !allAllergensFilled && 'Allergens',
                  !targetNutrientsFilled && 'Nutrition',
                  !data.claims?.some(c => c.claim) && 'Claims',
                ].filter(Boolean).join(' · ')} still needed
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => save(false)} disabled={saving}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition disabled:opacity-40">
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            {!done && (
              <button onClick={() => save(true)} disabled={saving || !allAllergensFilled || !targetNutrientsFilled}
                className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40">
                Mark complete →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Nutritional Panel component ────────────────────────────────────────────────
function NutritionalPanel({ title, subtitle, color, data, activeIngredients, servingSize, onChange, onActiveChange, locked }) {
  const colors = {
    blue:  { header: 'bg-blue-50 border-blue-100',  badge: 'text-blue-700', label: 'text-blue-600' },
    green: { header: 'bg-green-50 border-green-100', badge: 'text-green-700', label: 'text-green-600' },
  }
  const c = colors[color]

  return (
    <div className={`border rounded-2xl overflow-hidden ${locked ? 'opacity-50' : ''}`}>
      <div className={`px-5 py-3 border-b flex items-center justify-between ${c.header}`}>
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${c.badge}`}>{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {servingSize && <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full">Per serving = {servingSize}</span>}
        {locked && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">🔒 Locked</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 text-left py-3 px-5 w-52">Nutrient</th>
              {['Per 100g/ml', 'Per serving', '% RI'].map(h => (
                <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-3 text-left py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_ROWS.map(({ key, label, indent }) => {
              const row = data?.[key] || EMPTY_NUTRIENT()
              return (
                <tr key={key} className="border-t border-gray-50">
                  <td className={`py-2 pr-4 px-5 text-sm ${indent ? 'pl-10 text-gray-500 italic' : 'font-medium text-gray-700'}`}>{label}</td>
                  {['per100', 'perServing', 'ri'].map(f => (
                    <td key={f} className="py-1.5 pr-3">
                      <input disabled={locked} value={row[f] || ''} onChange={e => onChange(key, f, e.target.value)}
                        placeholder="—" className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50 text-right" />
                    </td>
                  ))}
                </tr>
              )
            })}

            {/* Active ingredients */}
            {activeIngredients.map((ai, i) => (
              ai.name ? (
                <tr key={`active-${i}`} className="border-t border-gray-50">
                  <td className="py-2 pr-4 px-5 text-sm font-medium text-gray-700">{ai.name}</td>
                  {['per100', 'perServing', 'ri'].map(f => (
                    <td key={f} className="py-1.5 pr-3">
                      <input disabled={locked} value={ai[f] || ''} onChange={e => onActiveChange(i, f, e.target.value)}
                        placeholder="—" className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50 text-right" />
                    </td>
                  ))}
                </tr>
              ) : null
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}