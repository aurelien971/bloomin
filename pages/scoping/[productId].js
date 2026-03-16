import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'oz']
const EMPTY_ROW = () => ({ name: '', quantity: '', unit: 'g', notes: '' })

export default function ScopingPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,     setProduct]     = useState(null)
  const [brief,       setBrief]       = useState(null)
  const [scoping,     setScoping]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [ingredients, setIngredients] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [submitted,   setSubmitted]   = useState(false)

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

      const sSnap = await getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', productId)))
      if (!sSnap.empty) {
        const s = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() }
        setScoping(s)
        if (s.ingredients?.length) setIngredients(s.ingredients)
        setSubmitted(s.status === 'submitted')
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const setRow  = (i, f, v) => setIngredients(r => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row))
  const addRow  = () => setIngredients(r => [...r, EMPTY_ROW()])
  const removeRow = (i) => setIngredients(r => r.filter((_, idx) => idx !== i))

  const save = async (submit = false) => {
    if (!product) return
    setSaving(true)
    const clean = ingredients.filter(r => r.name.trim())
    const data  = {
      productId, briefId: product.briefId || '',
      productName: product.productName, clientName: product.clientName,
      ingredients: clean,
      status:    submit ? 'submitted' : 'draft',
      updatedAt: new Date().toISOString(),
    }
    try {
      if (scoping) {
        await updateDoc(doc(db, 'scopingSheets', scoping.id), data)
        setScoping(s => ({ ...s, ...data }))
      } else {
        const ref = await addDoc(collection(db, 'scopingSheets'), { ...data, createdAt: new Date().toISOString() })
        setScoping({ id: ref.id, ...data })
      }
      if (submit) {
        await updateDoc(doc(db, 'products', productId), {
          'stages.scoping.status':      'complete',
          'stages.scoping.submittedAt': new Date().toISOString(),
          'stages.procurement.status':  'in-progress',
        })
        setSubmitted(true)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const reopen = async () => {
    if (!scoping) return
    await updateDoc(doc(db, 'scopingSheets', scoping.id), { status: 'draft' })
    await updateDoc(doc(db, 'products', productId), {
      'stages.scoping.status':     'in-progress',
      'stages.procurement.status': 'not-started',
    })
    setSubmitted(false)
  }

  const fd = brief?.formData || {}

  if (loading) return <Loader />

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Ingredient Scoping — {product?.productName}</title></Head>

      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm">← Back</button>
            <div className="w-px h-5 bg-white/20" />
            <div>
              <p className="font-bold text-white">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5">{product?.clientName} · Ingredient Scoping</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {submitted ? (
              <>
                <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">Sent to Chris ✓</span>
                <button onClick={reopen} className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition">Re-open</button>
              </>
            ) : (
              <>
                <button onClick={() => save(false)} disabled={saving} className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition">Save draft</button>
                <button
                  onClick={() => save(true)}
                  disabled={saving || ingredients.filter(r => r.name.trim()).length === 0}
                  className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
                >
                  Submit to Chris →
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Brief summary */}
        {brief?.submitted && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Brief Summary</h2>
              <p className="text-xs text-gray-400 mt-0.5">What the client is asking for — use this to guide your ingredient choices.</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-5">
              {[
                { label: 'Primary flavour',  val: fd.primaryFlavour },
                { label: 'Secondary notes',  val: fd.secondaryFlavour },
                { label: 'Colour',           val: fd.colourDescription },
                { label: 'Used in',          val: Array.isArray(fd.uses) ? fd.uses.join(', ') : fd.uses },
                { label: 'Dietary',          val: Array.isArray(fd.dietary) ? fd.dietary.join(', ') : fd.dietary },
                { label: 'Sweetness',        val: fd.sweetness },
                { label: 'Milk type',        val: fd.milkType },
                { label: 'Preservatives',    val: fd.preservatives },
                { label: 'Allergens',        val: fd.allergens },
                { label: 'Restrictions',     val: fd.ingredientRestrictions },
              ].filter(f => f.val).map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="text-sm text-gray-900">{f.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ingredient table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ingredients needed for experimentation</h2>
            <p className="text-xs text-gray-400 mt-0.5">List everything you need to start cooking. Chris will source from approved suppliers.</p>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-12 gap-3 mb-2 px-0.5">
              {['Ingredient', '', 'Qty', 'Unit', 'Notes', ''].map((h, i) => (
                <div key={i} className={`text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? 'col-span-4' : i === 1 ? 'hidden' : i === 2 ? 'col-span-2' : i === 3 ? 'col-span-2' : i === 4 ? 'col-span-3' : 'col-span-1'}`}>{h}</div>
              ))}
            </div>
            <div className="space-y-2">
              {ingredients.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 items-center">
                  <input disabled={submitted} value={row.name} onChange={e => setRow(i, 'name', e.target.value)} placeholder="e.g. Black sesame paste" className="col-span-4 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400" />
                  <input disabled={submitted} value={row.quantity} onChange={e => setRow(i, 'quantity', e.target.value)} placeholder="500" className="col-span-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400" />
                  <select disabled={submitted} value={row.unit} onChange={e => setRow(i, 'unit', e.target.value)} className="col-span-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50 disabled:text-gray-400">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input disabled={submitted} value={row.notes} onChange={e => setRow(i, 'notes', e.target.value)} placeholder="Notes (optional)" className="col-span-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400" />
                  {!submitted && (
                    <button onClick={() => removeRow(i)} className="col-span-1 flex items-center justify-center text-gray-300 hover:text-red-400 transition text-xl">×</button>
                  )}
                </div>
              ))}
            </div>
            {!submitted && (
              <button onClick={addRow} className="mt-4 text-sm text-gray-500 hover:text-black font-medium transition">+ Add ingredient</button>
            )}
          </div>
        </div>

        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5">
            <p className="text-sm font-semibold text-green-800">✓ List submitted to Chris</p>
            <p className="text-xs text-green-600 mt-1">Chris will source these from approved suppliers and log expected delivery dates. You'll be able to start cooking once everything is delivered.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )
}