import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function ProcurementPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,     setProduct]     = useState(null)
  const [scoping,     setScoping]     = useState(null)
  const [procurement, setProcurement] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [items,       setItems]       = useState([])

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      setProduct({ id: pSnap.id, ...pSnap.data() })

      const sSnap = await getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', productId)))
      let scopingData = null
      if (!sSnap.empty) {
        scopingData = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() }
        setScoping(scopingData)
      }

      const oSnap = await getDocs(query(collection(db, 'procurementOrders'), where('productId', '==', productId)))
      if (!oSnap.empty) {
        const o = { id: oSnap.docs[0].id, ...oSnap.docs[0].data() }
        setProcurement(o)
        setItems(o.items || [])
      } else if (scopingData?.ingredients?.length) {
        setItems(scopingData.ingredients.map(ing => ({
          ...ing,
          supplier: '', supplierCode: '', unitCost: '', qtyToOrder: ing.quantity,
          leadTime: '', expectedDelivery: '',
          ordered: false, orderedAt: '', delivered: false, deliveredAt: '',
        })))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const setItem = (i, f, v) => setItems(rows => rows.map((r, idx) => {
    if (idx !== i) return r
    const updated = { ...r, [f]: v }
    // Filling in an expected delivery date implicitly means it's been ordered
    if (f === 'expectedDelivery' && v) {
      updated.ordered   = true
      updated.orderedAt = updated.orderedAt || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return updated
  }))

  const toggleOrdered = (i) => setItems(rows => rows.map((r, idx) => idx === i ? {
    ...r,
    ordered: !r.ordered,
    orderedAt: !r.ordered ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
  } : r))

  const toggleDelivered = (i) => setItems(rows => rows.map((r, idx) => idx === i ? {
    ...r,
    delivered: !r.delivered,
    deliveredAt: !r.delivered ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
  } : r))

  const allOrdered   = items.length > 0 && items.every(i => i.ordered)
  const allDelivered = items.length > 0 && items.every(i => i.delivered)

  // Find latest expected delivery (the bottleneck)
  const latestDelivery = items
    .filter(i => i.expectedDelivery)
    .sort((a, b) => new Date(b.expectedDelivery) - new Date(a.expectedDelivery))[0]?.expectedDelivery

  const save = async () => {
    if (!product) return
    setSaving(true)
    const data = {
      productId, productName: product.productName,
      items, allOrdered, allDelivered,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (procurement) {
        await updateDoc(doc(db, 'procurementOrders', procurement.id), data)
        setProcurement(p => ({ ...p, ...data }))
      } else {
        const ref = await addDoc(collection(db, 'procurementOrders'), { ...data, createdAt: new Date().toISOString() })
        setProcurement({ id: ref.id, ...data })
      }

      const stageUpdate = {}
      if (allDelivered) {
        stageUpdate['stages.procurement.status'] = 'complete'
        stageUpdate['stages.procurement.phase']  = 'delivered'
        stageUpdate['stages.lab.status']         = 'in-progress'
      } else if (allOrdered) {
        stageUpdate['stages.procurement.status']           = 'in-progress'
        stageUpdate['stages.procurement.phase']            = 'awaiting-delivery'
        if (latestDelivery) stageUpdate['stages.procurement.expectedDelivery'] = latestDelivery
      } else {
        stageUpdate['stages.procurement.status'] = 'in-progress'
        stageUpdate['stages.procurement.phase']  = 'ordering'
      }
      await updateDoc(doc(db, 'products', productId), stageUpdate)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  if (loading) return <Loader />

  if (!scoping || scoping.status !== 'submitted') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <p className="text-4xl">⏳</p>
        <p className="font-semibold text-gray-800">Waiting for Dima's ingredient list</p>
        <p className="text-sm text-gray-400">This page unlocks once Dima submits the scoping sheet.</p>
        <button onClick={() => router.push(`/product/${productId}`)} className="mt-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">← Back to product</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Procurement — {product?.productName}</title></Head>

      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm">← Back</button>
            <div className="w-px h-5 bg-white/20" />
            <div>
              <p className="font-bold text-white">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5">{product?.clientName} · Procurement</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {allDelivered && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">All delivered ✓</span>}
            {allOrdered && !allDelivered && <span className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full">Awaiting delivery</span>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Ingredients', value: items.length, sub: 'from Dima' },
            { label: 'Ordered', value: `${items.filter(i => i.ordered).length} / ${items.length}`, sub: allOrdered ? 'all ordered ✓' : 'pending' },
            { label: 'Delivered', value: `${items.filter(i => i.delivered).length} / ${items.length}`, sub: allDelivered ? 'all delivered ✓' : latestDelivery ? `latest by ${latestDelivery}` : 'awaiting orders' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Ingredient order rows */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ingredient orders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Approved suppliers only. Contact Dima before any substitution.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((item, i) => (
              <div key={i} className={`px-6 py-5 transition-colors ${item.delivered ? 'bg-green-50/40' : item.ordered ? 'bg-amber-50/30' : ''}`}>
                {/* Item header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.delivered ? 'bg-green-400' : item.ordered ? 'bg-amber-400' : 'bg-gray-200'}`} />
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <span className="text-sm text-gray-400 flex-shrink-0">{item.quantity} {item.unit}</span>
                    {item.notes && <span className="text-xs text-gray-400 italic hidden sm:inline">— {item.notes}</span>}
                  </div>
                  <button
                    onClick={() => toggleDelivered(i)}
                    className={`self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex-shrink-0 ${item.delivered ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                  >
                    {item.delivered ? `✓ Delivered ${item.deliveredAt}` : 'Mark delivered'}
                  </button>
                </div>

                {/* Supplier fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <Label>Supplier</Label>
                    <Input value={item.supplier} onChange={v => setItem(i, 'supplier', v)} placeholder="Supplier name" />
                  </div>
                  <div>
                    <Label>Supplier code</Label>
                    <Input value={item.supplierCode} onChange={v => setItem(i, 'supplierCode', v)} placeholder="Code" />
                  </div>
                  <div>
                    <Label>Lead time</Label>
                    <Input value={item.leadTime} onChange={v => setItem(i, 'leadTime', v)} placeholder="e.g. 5 days" />
                  </div>
                  <div>
                    <Label>Expected delivery</Label>
                    <input
                      type="date"
                      value={item.expectedDelivery}
                      onChange={e => setItem(i, 'expectedDelivery', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {allDelivered ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-green-800">✓ All ingredients delivered</p>
              <p className="text-xs text-green-600 mt-1">Dima is now unblocked and can start experimenting in the lab.</p>
            </div>
            <button onClick={save} disabled={saving} className="px-4 py-2 border border-green-300 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition self-start sm:self-auto flex-shrink-0">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-400">
              {items.filter(i => i.delivered).length} of {items.length} ingredients delivered
            </p>
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={saving} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={save}
                disabled={saving || !allOrdered}
                className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40"
              >
                Mark all delivered →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{children}</p>
}
function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
    />
  )
}
function Loader() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>
}