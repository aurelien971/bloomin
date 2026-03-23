import { useState, useEffect } from 'react'
import FeedbackWidget from '../../components/FeedbackWidget'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function BatchDecisionPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [batches,  setBatches]  = useState([])
  const [teamList, setTeamList] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  const [form, setForm] = useState({
    decision:         '',
    approvedBy:       '',
    approvedAt:       new Date().toISOString().split('T')[0],
    notes:            '',
    nextStep:         '',
    productionFacility: '',
    productionDateBooked: '',
    assignedCook:     '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }
      setProduct(p)

      // Load existing decision if already done
      const bd = p.stages?.batchDecision
      if (bd?.decision) {
        setForm(f => ({
          ...f,
          decision:             bd.decision             || '',
          approvedBy:           bd.approvedBy           || '',
          approvedAt:           bd.approvedAt?.split('T')[0] || f.approvedAt,
          notes:                bd.notes                || '',
          nextStep:             bd.nextStep             || '',
          productionFacility:   bd.productionFacility   || '',
          productionDateBooked: bd.productionDateBooked || '',
          assignedCook:         bd.assignedCook         || '',
        }))
      }

      // Load batches for summary
      const bSnap = await getDocs(query(
        collection(db, 'validationBatches'),
        where('productId', '==', productId),
        orderBy('batchNumber', 'asc')
      ))
      setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // Team
      const uSnap = await getDocs(collection(db, 'users'))
      setTeamList(uSnap.docs.map(d => d.data().name).filter(Boolean).sort())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const done = product?.stages?.batchDecision?.status === 'complete'

  const submit = async () => {
    if (!form.decision || !form.approvedBy) return
    setSaving(true)
    try {
      const isApproved = form.decision === 'approved' || form.decision === 'approved-with-note'
      await updateDoc(doc(db, 'products', productId), {
        'stages.batchDecision.status':      'complete',
        'stages.batchDecision.decision':    form.decision,
        'stages.batchDecision.approvedBy':  form.approvedBy,
        'stages.batchDecision.approvedAt':  new Date(form.approvedAt).toISOString(),
        'stages.batchDecision.productionFacility':   form.productionFacility,
        'stages.batchDecision.productionDateBooked': form.productionDateBooked,
        'stages.batchDecision.assignedCook':         form.assignedCook,
        'stages.batchDecision.notes':                form.notes,
        'stages.batchDecision.nextStep':             form.nextStep,
        ...(isApproved ? { 'stages.labTesting.status': 'in-progress' } : {}),
      })
      router.push(`/product/${productId}`)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const reopen = async () => {
    await updateDoc(doc(db, 'products', productId), {
      'stages.batchDecision.status':  'in-progress',
      'stages.labTesting.status':     'not-started',
    })
    setForm(f => ({ ...f, decision: '' }))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  const allPass = batches.length > 0 && batches.every(b => b.visual?.overallVisual === 'Pass' && b.sensory?.overallSensory === 'Pass')
  const anyFail = batches.some(b => b.visual?.overallVisual === 'Fail' || b.sensory?.overallSensory === 'Fail')

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Batch Decision — {product?.productName}</title></Head>

      {/* Header */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-6 sm:h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50 hidden sm:block">{product?.clientName} · Batch Decision</p>
            </div>
          </div>
          {done && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full flex-shrink-0">Decision recorded ✓</span>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page title */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{product?.clientName}</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{product?.productName} — Internal Batch Decision</h1>
          <p className="text-sm text-gray-400 mt-1">Based on the test batch results, make a final internal call. Approving will unlock lab testing.</p>
        </div>

        {/* Batch results summary */}
        {batches.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Test batch summary</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {batches.map((bat, i) => {
                const checks = [
                  { label: 'Visual',      val: bat.visual?.overallVisual },
                  { label: 'Sensory',     val: bat.sensory?.overallSensory },
                  { label: 'Application', val: bat.application?.overallApplication },
                  { label: 'Process',     val: bat.process?.overallProcess },
                ]
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-800">Batch {i + 1}</p>
                      {bat.facility && <p className="text-xs text-gray-400">{bat.facility} · {bat.date ? new Date(bat.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {checks.map(c => (
                        <div key={c.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${c.val === 'Pass' ? 'bg-green-50 border-green-200 text-green-700' : c.val === 'Fail' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                          <span>{c.label}</span>
                          <span>{c.val || '—'}</span>
                        </div>
                      ))}
                    </div>
                    {bat.sensory?.clientWouldNotice && (
                      <p className={`text-xs mt-2 ${bat.sensory.clientWouldNotice === 'Yes' ? 'text-red-600' : bat.sensory.clientWouldNotice === 'Possibly' ? 'text-amber-600' : 'text-green-600'}`}>
                        Client would notice difference: <strong>{bat.sensory.clientWouldNotice}</strong>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Auto-recommendation */}
            {batches.length > 0 && (
              <div className={`px-5 py-4 border-t ${allPass ? 'bg-green-50 border-green-100' : anyFail ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-sm font-semibold ${allPass ? 'text-green-800' : anyFail ? 'text-red-800' : 'text-amber-800'}`}>
                  {allPass ? '✓ All checks passed — looks ready to approve' : anyFail ? '✗ Some checks failed — review before approving' : '⚠ Some checks incomplete — review before deciding'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Decision form */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Internal decision</h2>
          </div>
          <div className="px-5 py-5 space-y-5">

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Decision *</label>
              <div className="flex gap-3 flex-wrap">
                {[
                  { val: 'approved',           label: '✓ Approved',               color: 'bg-green-500', text: 'text-green-700', border: 'border-green-500' },
                  { val: 'approved-with-note', label: '⚠ Approved with note',     color: 'bg-amber-400', text: 'text-amber-700', border: 'border-amber-400' },
                  { val: 'rejected',           label: '✗ Rejected — redo batch',  color: 'bg-red-500',   text: 'text-red-700',   border: 'border-red-500'   },
                ].map(d => (
                  <label key={d.val} disabled={done}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${form.decision === d.val ? `${d.color} text-white border-transparent` : `border-gray-200 text-gray-600 hover:border-gray-400`} ${done ? 'cursor-default opacity-60' : ''}`}>
                    <input type="radio" className="hidden" onChange={() => !done && set('decision', d.val)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Decided by *</label>
                <input
                  list="team-decision-list"
                  value={form.approvedBy} onChange={e => set('approvedBy', e.target.value)}
                  placeholder="Type a name..."
                  disabled={done}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50"
                />
                <datalist id="team-decision-list">
                  {teamList.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</label>
                <input type="date" value={form.approvedAt} onChange={e => set('approvedAt', e.target.value)} disabled={done}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes / reasoning</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} disabled={done}
                placeholder="Why this decision? Any deviations accepted? What needs to change if rejected?"
                rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:bg-gray-50" />
            </div>

            {form.decision === 'approved' || form.decision === 'approved-with-note' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next step</label>
                <input value={form.nextStep} onChange={e => set('nextStep', e.target.value)} disabled={done}
                  placeholder="e.g. Submit to Eurofins for shelf-life testing, send to client, proceed to production"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
            ) : null}

            {/* Production booking — so Asif can schedule capacity */}
            {(form.decision === 'approved' || form.decision === 'approved-with-note') && (
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Production booking</p>
                <p className="text-xs text-gray-400">Book the factory slot now so Asif can block capacity and schedule the run.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Production facility</label>
                    <input list="facility-list" value={form.productionFacility} onChange={e => set('productionFacility', e.target.value)} disabled={done}
                      placeholder="e.g. Red Distillery"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                    <datalist id="facility-list">
                      {teamList.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Production date booked</label>
                    <input type="date" value={form.productionDateBooked} onChange={e => set('productionDateBooked', e.target.value)} disabled={done}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned cook / supervisor</label>
                    <input list="cook-list" value={form.assignedCook} onChange={e => set('assignedCook', e.target.value)} disabled={done}
                      placeholder="e.g. Dima"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                    <datalist id="cook-list">
                      {teamList.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        {done ? (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">Decision recorded. Edit if needed.</p>
            <button onClick={reopen} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">Edit decision</button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              {form.decision === 'approved' || form.decision === 'approved-with-note' ? 'Approving will unlock lab testing.' : form.decision === 'rejected' ? 'Rejecting will require a new test batch.' : 'Select a decision above.'}
            </p>
            <button onClick={submit} disabled={saving || !form.decision || !form.approvedBy}
              className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40 flex-shrink-0">
              {saving ? 'Saving...' : 'Record decision →'}
            </button>
          </div>
        )}
      </div>

      <FeedbackWidget page="batchdecision" label="Batch Decision" pageId={productId} />
    </div>
  )
}