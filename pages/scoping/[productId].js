import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  doc, getDoc, collection, query, where,
  getDocs, addDoc, updateDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'oz']
const EMPTY_ROW = () => ({
  name: '', quantity: '', unit: 'g',
  supplierId: '', supplierName: '', notes: '',
  riskFactor: '',
  costPerUnit: '', costCurrency: '£',
  ordered: false, orderedAt: '', orderCode: '',
  expectedDelivery: '', delivered: false, deliveredAt: '',
})

// ─── Phase helpers ────────────────────────────────────────────────────────────
// draft      → Dima is listing ingredients + picking suppliers
// ordering   → list locked, marking items as ordered with code + expected delivery
// delivered  → all items delivered, stage complete

export default function ScopingPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,     setProduct]     = useState(null)
  const [brief,       setBrief]       = useState(null)
  const [scoping,     setScoping]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [ingredients, setIngredients] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [phase,       setPhase]       = useState('draft')   // draft | ordering | delivered
  const [suppliers,   setSuppliers]   = useState([])

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
        if (s.ingredients?.length) setIngredients(s.ingredients.map(r => ({ ...EMPTY_ROW(), ...r })))
        setPhase(s.phase || (s.status === 'submitted' ? 'ordering' : 'draft'))
      }

      const supSnap = await getDocs(collection(db, 'suppliers'))
      const sorted = supSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      setSuppliers(sorted)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // ── Ingredient list helpers ──────────────────────────────────────────────────
  const setRow = (i, f, v) => setIngredients(r => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row))

  const setSupplierForRow = (i, supplierId) => {
    if (supplierId?.startsWith('__request__:')) {
      const reqName = supplierId.replace('__request__:', '')
      setIngredients(r => r.map((row, idx) => idx === i
        ? { ...row, supplierId: '', supplierName: `⚠ Requested: ${reqName}`, supplierRequest: reqName }
        : row
      ))
      // Write to supplierRequests collection so Chris can see it on the suppliers page
      addDoc(collection(db, 'supplierRequests'), {
        supplierName:  reqName,
        requestedBy:   product?.owner || '',
        productName:   product?.productName || '',
        clientName:    product?.clientName || '',
        productId,
        ingredientName: ingredients[i]?.name || '',
        status:        'pending',
        createdAt:     new Date().toISOString(),
      }).catch(console.error)
      return
    }
    const sup = suppliers.find(s => s.id === supplierId)
    setIngredients(r => r.map((row, idx) => idx === i
      ? { ...row, supplierId, supplierName: sup?.name || '', supplierRequest: '' }
      : row
    ))
  }

  const toggleDelivered = (i) => {
    setIngredients(r => r.map((row, idx) => {
      if (idx !== i) return row
      const nowDelivered = !row.delivered
      return { ...row, delivered: nowDelivered, deliveredAt: nowDelivered ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' }
    }))
  }

  // Auto-set expectedDelivery → marks ingredient as ordered implicitly
  const setDeliveryDate = async (i, date) => {
    const updated = ingredients.map((row, idx) => idx === i ? { ...row, expectedDelivery: date } : row)
    setIngredients(updated)
    // Sync the latest expected delivery date to product stages so calendar + dashboard see it
    if (productId) {
      const latest = updated
        .filter(r => r.expectedDelivery)
        .sort((a, b) => new Date(b.expectedDelivery) - new Date(a.expectedDelivery))[0]?.expectedDelivery
      if (latest) {
        try {
          await updateDoc(doc(db, 'products', productId), {
            'stages.scoping.expectedDelivery': latest,
            'stages.scoping.updatedAt': new Date().toISOString(),
          })
        } catch (e) { console.error(e) }
      }
    }
  }

  const toggleOrdered = (i) => {
    setIngredients(r => r.map((row, idx) => {
      if (idx !== i) return row
      const nowOrdered = !row.ordered
      return { ...row, ordered: nowOrdered, orderedAt: nowOrdered ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' }
    }))
  }

  const setOrderCode = (i, code) => {
    setIngredients(r => r.map((row, idx) => idx !== i ? row : { ...row, orderCode: code }))
  }

  const addRow    = () => setIngredients(r => [...r, EMPTY_ROW()])
  const removeRow = (i) => setIngredients(r => r.filter((_, idx) => idx !== i))

  const allDelivered = ingredients.length > 0 && ingredients.every(r => r.delivered)
  const anyDelivery  = ingredients.some(r => r.expectedDelivery)
  const clean        = ingredients.filter(r => r.name.trim())

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const saveData = async (newPhase) => {
    if (!product) return
    const data = {
      productId, briefId: product.briefId || '',
      productName: product.productName, clientName: product.clientName,
      ingredients: clean,
      phase: newPhase,
      status: newPhase === 'draft' ? 'draft' : 'submitted',
      updatedAt: new Date().toISOString(),
    }
    if (scoping) {
      await updateDoc(doc(db, 'scopingSheets', scoping.id), data)
      setScoping(s => ({ ...s, ...data }))
    } else {
      const ref = await addDoc(collection(db, 'scopingSheets'), { ...data, createdAt: new Date().toISOString() })
      setScoping({ id: ref.id, ...data })
    }
    return data
  }

  // Draft → lock list, move to delivery tracking
  const submitList = async () => {
    if (clean.length === 0) return
    setSaving(true)
    try {
      await saveData('ordering')
      await updateDoc(doc(db, 'products', productId), {
        'stages.scoping.status':      'in-progress',
        'stages.scoping.phase':       'ordering',
        'stages.scoping.submittedAt': new Date().toISOString(),
      })
      setPhase('ordering')
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  // Save delivery dates progress
  const saveDelivery = async () => {
    setSaving(true)
    try {
      const latestDate = ingredients
        .filter(r => r.expectedDelivery)
        .sort((a, b) => new Date(b.expectedDelivery) - new Date(a.expectedDelivery))[0]?.expectedDelivery

      await saveData(allDelivered ? 'delivered' : 'ordering')
      const stageUpdate = {
        'stages.scoping.updatedAt': new Date().toISOString(),
      }
      if (latestDate) stageUpdate['stages.scoping.expectedDelivery'] = latestDate
      if (allDelivered) {
        stageUpdate['stages.scoping.status']      = 'complete'
        stageUpdate['stages.scoping.phase']       = 'delivered'
        stageUpdate['stages.scoping.deliveredAt'] = new Date().toISOString()
        stageUpdate['stages.lab.status']          = 'in-progress'
      }
      await updateDoc(doc(db, 'products', productId), stageUpdate)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  // Mark all delivered → advance to lab
  const markAllDelivered = async () => {
    setSaving(true)
    try {
      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const updated = ingredients.map(r => ({ ...r, delivered: true, deliveredAt: r.deliveredAt || now }))
      setIngredients(updated)
      const data = {
        productId, briefId: product.briefId || '',
        productName: product.productName, clientName: product.clientName,
        ingredients: updated.filter(r => r.name.trim()),
        phase: 'delivered', status: 'submitted',
        updatedAt: new Date().toISOString(),
      }
      if (scoping) {
        await updateDoc(doc(db, 'scopingSheets', scoping.id), data)
        setScoping(s => ({ ...s, ...data }))
      }
      await updateDoc(doc(db, 'products', productId), {
        'stages.scoping.status':      'complete',
        'stages.scoping.phase':       'delivered',
        'stages.scoping.deliveredAt': new Date().toISOString(),
        'stages.lab.status':          'in-progress',
      })
      setPhase('delivered')
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  // Go back to editing the list
  const reopen = async (targetPhase = null) => {
    setSaving(true)
    const PHASES = ['draft','ordering','delivered-tracking','delivered']
    const goTo = targetPhase || PHASES[Math.max(0, PHASES.indexOf(phase) - 1)]
    try {
      await saveData(goTo)
      await updateDoc(doc(db, 'products', productId), {
        'stages.scoping.status': 'in-progress',
        'stages.scoping.phase':  goTo,
        ...(goTo === 'draft' ? { 'stages.lab.status': 'not-started' } : {}),
      })
      setPhase(goTo)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const fd = brief?.formData || {}
  const deliveredCount = ingredients.filter(r => r.delivered).length

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Ingredients — {product?.productName}</title></Head>

      {/* Header */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5">{product?.clientName} · Ingredients & Sourcing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {phase === 'delivered' && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">All delivered ✓</span>}
            {phase === 'ordering' && <span className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full">{deliveredCount}/{ingredients.length} delivered</span>}
            <button onClick={() => router.push('/suppliers')} className="px-3 py-1.5 border border-white/20 text-white/70 hover:text-white text-xs font-medium rounded-lg hover:bg-white/10 transition">
              Suppliers ↗
            </button>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex gap-0 overflow-x-auto">
          {[
            { key: 'draft',             label: '1  List ingredients' },
            { key: 'ordering',          label: '2  Mark as ordered'  },
            { key: 'delivered-tracking',label: '3  Track delivery'   },
            { key: 'delivered',         label: '4  All delivered'    },
          ].map((p, i) => {
            const PHASES = ['draft','ordering','delivered-tracking','delivered']
            const isActive = phase === p.key
            const isDone   = PHASES.indexOf(phase) > i
            return (
              <div key={p.key} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${isActive ? 'border-white text-white' : isDone ? 'border-green-400 text-green-400' : 'border-transparent text-white/30'}`}>
                {isDone ? '✓ ' : ''}{p.label}
              </div>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Brief summary */}
        {brief?.submitted && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Brief summary</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(product?.productType === 'drink' ? [
                { label: 'Flavour direction',  val: fd.flavourDirection },
                { label: 'Protein target',     val: fd.proteinTarget ? `${fd.proteinTarget}g` : null },
                { label: 'Protein blend',      val: fd.proteinBlend },
                { label: 'Electrolytes',       val: fd.electrolytes },
                { label: 'Sweetener',          val: fd.sweetener },
                { label: 'Carbonation',        val: fd.carbonation },
                { label: 'Format',             val: fd.format },
                { label: 'Markets',            val: Array.isArray(fd.markets) ? fd.markets.join(', ') : fd.markets },
                { label: 'Functional claims',  val: Array.isArray(fd.functionalClaims) ? fd.functionalClaims.join(', ') : fd.functionalClaims },
                { label: 'Restrictions',       val: fd.formulaRestrictions },
                { label: 'Allergen notes',     val: fd.allergenNotes },
              ] : [
                { label: 'Primary flavour',    val: fd.primaryFlavour },
                { label: 'Secondary notes',    val: fd.secondaryFlavour },
                { label: 'Used in',            val: Array.isArray(fd.uses) ? fd.uses.join(', ') : fd.uses },
                { label: 'Dietary',            val: Array.isArray(fd.dietary) ? fd.dietary.join(', ') : fd.dietary },
                { label: 'Sweetness',          val: fd.sweetness },
                { label: 'Milk types',         val: Array.isArray(fd.milkTypes) ? fd.milkTypes.join(', ') : fd.milkTypes },
                { label: 'Allergens',          val: fd.allergens },
                { label: 'Restrictions',       val: fd.ingredientRestrictions },
                { label: 'Preservatives',      val: fd.preservatives },
              ]).filter(f => f.val).map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="text-sm text-gray-900">{f.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COG Calculator ─────────────────────────────────────────────────── */}
        {(() => {
          // Parse bottle volume from brief
          const bottleVolumeMl = (() => {
            if (product?.productType === 'drink') {
              const fmt = fd.format || ''
              const m = fmt.match(/(\d+)\s*ml/i)
              return m ? parseInt(m[1]) : 330
            }
            if (fd.standardBottleOk === 'No — I need something different' && fd.bottleAlternative) {
              const m = fd.bottleAlternative.match(/(\d+)\s*ml/i)
              if (m) return parseInt(m[1])
            }
            return 750 // default standard bottle
          })()

          // Calculate total ingredient cost for the batch
          const costedRows = ingredients.filter(r => r.name?.trim() && r.costPerUnit && r.quantity)
          const totalBatchCost = costedRows.reduce((sum, r) => {
            const cost = parseFloat(r.costPerUnit) || 0
            const qty  = parseFloat(r.quantity)    || 0
            return sum + (cost * qty)
          }, 0)

          const hasCosts = costedRows.length > 0
          const batchVolumeMl = ingredients.reduce((sum, r) => {
            const qty = parseFloat(r.quantity) || 0
            if (r.unit === 'ml' || r.unit === 'L') return sum + (r.unit === 'L' ? qty * 1000 : qty)
            return sum + qty // assume g ≈ ml for syrup
          }, 0)

          const bottlesPerBatch = batchVolumeMl > 0 && bottleVolumeMl > 0
            ? Math.floor(batchVolumeMl / bottleVolumeMl)
            : null

          const cogPerBottle = bottlesPerBatch && bottlesPerBatch > 0 && totalBatchCost > 0
            ? totalBatchCost / bottlesPerBatch
            : null

          const targetCostMax = parseFloat(fd.targetCostMax || 0)
          const onTarget = cogPerBottle && targetCostMax ? cogPerBottle <= targetCostMax : null

          if (!hasCosts && phase === 'draft') return null // don't show until costs entered

          return (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cost of Goods</h2>
                  <span className="text-xs text-gray-400">· {bottleVolumeMl}ml bottle</span>
                </div>
                {onTarget !== null && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${onTarget ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {onTarget ? '✓ On target' : '⚠ Over target'}
                  </span>
                )}
              </div>
              <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Order costs entered</p>
                  <p className="text-xl font-bold text-gray-900">{costedRows.length}<span className="text-sm text-gray-400 font-normal"> / {ingredients.filter(r => r.name?.trim()).length}</span></p>
                  <p className="text-[10px] text-gray-400 mt-0.5">ingredients</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Total ingredient cost</p>
                  <p className="text-xl font-bold text-gray-900">{hasCosts ? `£${totalBatchCost.toFixed(2)}` : '—'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">sum of order costs</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Bottles per batch</p>
                  <p className="text-xl font-bold text-gray-900">{bottlesPerBatch ?? '—'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{bottleVolumeMl}ml bottles</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Est. COG / bottle</p>
                  <p className={`text-xl font-bold ${onTarget === false ? 'text-red-600' : onTarget ? 'text-green-600' : 'text-gray-900'}`}>
                    {cogPerBottle ? `£${cogPerBottle.toFixed(2)}` : '—'}
                  </p>
                  {targetCostMax > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">Target: £{targetCostMax.toFixed(2)}</p>
                  )}
                </div>
              </div>
              {costedRows.length < ingredients.filter(r => r.name?.trim()).length && (
                <div className="px-5 pb-3">
                  <p className="text-xs text-amber-600">⚠ {ingredients.filter(r => r.name?.trim()).length - costedRows.length} ingredient{ingredients.filter(r => r.name?.trim()).length - costedRows.length !== 1 ? 's' : ''} missing order cost — COG is a partial estimate</p>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── PHASE 1: List ingredients ─────────────────────────────────────── */}
        {phase === 'draft' && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-visible">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ingredients needed</h2>
                  <p className="text-xs text-gray-400 mt-0.5">List every ingredient. Pick an approved supplier for each — or leave blank and add a note.</p>
                </div>
                {phase !== 'draft' && (
                  <button onClick={reopen} className="text-xs text-gray-400 hover:text-black transition font-medium flex-shrink-0">Edit list ←</button>
                )}
              </div>
              <div className="px-5 py-5 space-y-3">
                {ingredients.map((row, i) => (
                  <IngredientCard
                    key={i} row={row} index={i}
                    suppliers={suppliers} readOnly={false}
                    onChange={(f, v) => setRow(i, f, v)}
                    onSupplierChange={(id) => setSupplierForRow(i, id)}
                    onRemove={() => removeRow(i)}
                  />
                ))}
                <button onClick={addRow} className="text-sm text-gray-500 hover:text-black font-medium transition mt-1">+ Add ingredient</button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 space-y-3">
              {ingredients.some(r => r.supplierRequest) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800">⚠ New supplier requests — Chris needs to approve these before ordering:</p>
                  <ul className="mt-1 space-y-0.5">
                    {ingredients.filter(r => r.supplierRequest).map((r, i) => (
                      <li key={i} className="text-xs text-amber-700">· {r.name}: {r.supplierRequest}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{clean.length} ingredient{clean.length !== 1 ? 's' : ''} added</p>
                <button
                  onClick={submitList}
                  disabled={saving || clean.length === 0}
                  className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Lock list & track delivery →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── PHASE 2: Mark as ordered ─────────────────────────────────────── */}
        {phase === 'ordering' && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mark ingredients as ordered</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Add the order code / reference and expected delivery for each item.</p>
                </div>
                <button onClick={reopen} className="text-xs text-gray-400 hover:text-black transition font-medium">Edit list ←</button>
              </div>

              <div className="divide-y divide-gray-50">
                {ingredients.filter(r => r.name.trim()).map((row, i) => (
                  <div key={i} className={`px-5 py-4 transition-colors ${row.ordered ? 'bg-green-50/40' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Status dot + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.ordered ? 'bg-green-400' : 'bg-gray-200'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{row.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">{row.quantity} {row.unit}</span>
                            {row.supplierName && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{row.supplierName}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Order code + expected delivery */}
                      <div className="flex items-end gap-3 pl-5 sm:pl-0 flex-shrink-0 flex-wrap">
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">Order code / ref</label>
                          <input
                            value={row.orderCode || ''}
                            onChange={e => setOrderCode(i, e.target.value)}
                            placeholder="e.g. PO-2024-001"
                            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-36"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">Expected delivery</label>
                          <input
                            type="date"
                            value={row.expectedDelivery || ''}
                            onChange={e => setDeliveryDate(i, e.target.value)}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          />
                        </div>
                        <button
                          onClick={() => toggleOrdered(i)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex-shrink-0 ${row.ordered ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-black text-white border-black hover:bg-gray-900'}`}
                        >
                          {row.ordered ? `✓ Ordered ${row.orderedAt}` : 'Mark ordered'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-400">
                {ingredients.filter(r => r.name.trim() && r.ordered).length} of {ingredients.filter(r => r.name.trim()).length} items ordered
              </p>
              <div className="flex items-center gap-3">
                <button onClick={saveDelivery} disabled={saving} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await saveData('delivered-tracking')
                      await updateDoc(doc(db, 'products', productId), {
                        'stages.scoping.phase': 'delivered-tracking',
                        'stages.scoping.updatedAt': new Date().toISOString(),
                      })
                      setPhase('delivered-tracking')
                    } catch (e) { console.error(e) }
                    setSaving(false)
                  }}
                  disabled={saving || ingredients.filter(r => r.name.trim() && !r.ordered).length > 0}
                  className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'All ordered — track delivery →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── PHASE 3: Track delivery ───────────────────────────────────────── */}
        {(phase === 'delivered-tracking' || phase === 'delivered') && (
          <>
            {phase === 'delivered' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
                <p className="text-sm font-semibold text-green-800">✓ All ingredients delivered — Dima can start cooking</p>
                <p className="text-xs text-green-600 mt-0.5">The lab development stage is now unlocked.</p>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Delivery tracking</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Mark items as they arrive.</p>
                </div>
                {phase !== 'delivered' && (
                  <button onClick={() => reopen('ordering')} className="text-xs text-gray-400 hover:text-black transition font-medium">← Back to ordering</button>
                )}
              </div>

              <div className="divide-y divide-gray-50">
                {ingredients.filter(r => r.name.trim()).map((row, i) => (
                  <DeliveryRow
                    key={i} row={row} index={i}
                    readOnly={phase === 'delivered'}
                    onDateChange={(date) => setDeliveryDate(i, date)}
                    onToggleDelivered={() => toggleDelivered(i)}
                  />
                ))}
              </div>
            </div>

            {phase !== 'delivered' && (
              <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-gray-400">
                  {deliveredCount} of {ingredients.filter(r => r.name.trim()).length} ingredients delivered
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={saveDelivery} disabled={saving} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={allDelivered ? saveDelivery : markAllDelivered}
                    disabled={saving}
                    className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40"
                  >
                    {allDelivered ? 'Complete stage →' : 'Mark all delivered →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Ingredient card (Phase 1) ────────────────────────────────────────────────
function IngredientCard({ row, index, suppliers, readOnly, onChange, onSupplierChange, onRemove }) {
  const [dropdownOpen,    setDropdownOpen]    = useState(false)
  const [search,          setSearch]          = useState('')
  const [requestingNew,   setRequestingNew]   = useState(false)
  const [requestName,     setRequestName]     = useState('')

  const expanded = readOnly || !!row.name?.trim()

  const selectedSupplier = suppliers.find(s => s.id === row.supplierId)

  const filtered = suppliers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className={`border rounded-2xl overflow-visible transition-all ${expanded ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/40'}`}>
      {/* Name row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-xs font-bold text-gray-300 w-4 text-right flex-shrink-0">{index + 1}</span>
        <input
          disabled={readOnly} value={row.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Ingredient name — e.g. Black sesame paste"
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50 disabled:text-gray-500"
        />
        {!readOnly && (
          <button onClick={onRemove} className="text-gray-200 hover:text-red-400 transition text-xl flex-shrink-0">×</button>
        )}
      </div>

      {/* Details — only shown once name has text */}
      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {/* Qty + unit + notes + risk */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              disabled={readOnly} value={row.quantity}
              onChange={e => onChange('quantity', e.target.value)}
              placeholder="Qty"
              className="w-20 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50"
            />
            <select
              disabled={readOnly} value={row.unit}
              onChange={e => onChange('unit', e.target.value)}
              className="px-2 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white disabled:bg-gray-50"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {/* Cost — price paid for this order */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide leading-none">Order cost</span>
              <div className="flex items-center gap-0 rounded-xl border border-green-200 bg-green-50/50 overflow-hidden">
                <span className="px-2 text-xs font-semibold text-green-600 border-r border-green-200">£</span>
                <input
                  disabled={readOnly} value={row.costPerUnit || ''}
                  onChange={e => onChange('costPerUnit', e.target.value)}
                  placeholder={`for ${row.quantity || '?'} ${row.unit || ''}`}
                  type="number" min="0" step="0.01"
                  title={`Total price paid for ${row.quantity || '?'} ${row.unit || ''} of this ingredient`}
                  className="w-28 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
            <input
              disabled={readOnly} value={row.notes}
              onChange={e => onChange('notes', e.target.value)}
              placeholder="Notes — grade, organic, etc."
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50"
            />
            <input
              disabled={readOnly} value={row.riskFactor || ''}
              onChange={e => onChange('riskFactor', e.target.value)}
              placeholder="Risk flag?"
              className="w-28 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/60 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 flex-shrink-0"
              title="e.g. microbe, allergen, shelf life"
            />
          </div>
          {/* Supplier selector */}
          <div className="relative">
            <button
              onClick={() => !readOnly && setDropdownOpen(o => !o)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border text-sm transition text-left ${selectedSupplier || row.supplierRequest ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 text-gray-400 bg-white hover:border-gray-400'} ${readOnly ? 'cursor-default' : ''}`}
            >
              <span className="flex-shrink-0 text-base">🏭</span>
              <span className="flex-1 truncate">
                {row.supplierRequest
                  ? <span className="text-amber-700">⚠ Requested: {row.supplierRequest}</span>
                  : selectedSupplier
                  ? <><strong>{selectedSupplier.name}</strong><span className="font-normal text-blue-500 ml-1.5">· {selectedSupplier.category}</span></>
                  : <span className="text-gray-400">Select approved supplier (optional)</span>
                }
              </span>
              {(selectedSupplier || row.supplierRequest) && !readOnly && (
                <button onClick={e => { e.stopPropagation(); onSupplierChange('') }}
                  className="text-blue-400 hover:text-blue-700 text-lg font-bold leading-none flex-shrink-0">×</button>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[200] overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search suppliers..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {Object.keys(grouped).length === 0
                    ? <p className="text-sm text-gray-400 text-center py-6">No suppliers found</p>
                    : Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50">{cat}</p>
                        {items.map(s => (
                          <button key={s.id} onClick={() => { onSupplierChange(s.id); setDropdownOpen(false); setSearch('') }}
                            className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b border-gray-50 last:border-0 ${row.supplierId === s.id ? 'bg-blue-50' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                              {s.certifications && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{s.certifications}</span>}
                            </div>
                            {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                            {s.contact && <p className="text-xs text-gray-400 mt-0.5">{s.contact}</p>}
                          </button>
                        ))}
                      </div>
                    ))
                  }
                </div>
                <div className="border-t border-gray-100">
                  {requestingNew ? (
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-700">Request a new supplier</p>
                      <input
                        autoFocus
                        value={requestName}
                        onChange={e => setRequestName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && requestName.trim()) {
                            onSupplierChange('__request__:' + requestName.trim())
                            setDropdownOpen(false); setSearch(''); setRequestingNew(false); setRequestName('')
                          }
                          if (e.key === 'Escape') { setRequestingNew(false); setRequestName('') }
                        }}
                        placeholder="Supplier name..."
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!requestName.trim()) return
                            onSupplierChange('__request__:' + requestName.trim())
                            setDropdownOpen(false); setSearch(''); setRequestingNew(false); setRequestName('')
                          }}
                          disabled={!requestName.trim()}
                          className="flex-1 py-2 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition disabled:opacity-40"
                        >Submit request</button>
                        <button onClick={() => { setRequestingNew(false); setRequestName('') }}
                          className="px-3 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 flex items-center justify-between gap-2">
                      <button onClick={() => setRequestingNew(true)}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1 transition flex items-center gap-1">
                        ⚠ Can't find it? Request new supplier
                      </button>
                      <button onClick={() => { setDropdownOpen(false); setSearch('') }} className="text-xs text-gray-400 hover:text-black px-2 py-1 transition">Close</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Delivery row (Phase 2) ───────────────────────────────────────────────────
function DeliveryRow({ row, index, readOnly, onDateChange, onToggleDelivered }) {
  return (
    <div className={`px-5 py-4 transition-colors ${row.delivered ? 'bg-green-50/50' : row.expectedDelivery ? 'bg-amber-50/30' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Status dot + name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.delivered ? 'bg-green-400' : row.expectedDelivery ? 'bg-amber-400' : 'bg-gray-200'}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{row.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">{row.quantity} {row.unit}</span>
              {row.supplierRequest
                ? <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠ Requested: {row.supplierRequest}</span>
                : row.supplierName && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{row.supplierName}</span>
              }
              {row.notes && <span className="text-xs text-gray-400 italic truncate">— {row.notes}</span>}
            </div>
          </div>
        </div>

        {/* Expected delivery date */}
        <div className="flex items-center gap-3 pl-5 sm:pl-0 flex-shrink-0">
          {!readOnly ? (
            <div>
              <label className="text-xs text-gray-400 block mb-0.5">Expected delivery</label>
              <input
                type="date"
                value={row.expectedDelivery || ''}
                onChange={e => onDateChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          ) : row.expectedDelivery ? (
            <span className="text-xs text-gray-500">{new Date(row.expectedDelivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
          ) : null}

          {/* Delivered toggle */}
          {!readOnly ? (
            <button
              onClick={onToggleDelivered}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex-shrink-0 ${row.delivered ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {row.delivered ? `✓ Delivered ${row.deliveredAt}` : 'Mark delivered'}
            </button>
          ) : (
            <span className="text-xs font-semibold text-green-600">✓ Delivered {row.deliveredAt}</span>
          )}
        </div>
      </div>
    </div>
  )
}