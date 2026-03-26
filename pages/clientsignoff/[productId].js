import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  doc, getDoc, collection, query, where,
  getDocs, updateDoc, orderBy,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function ClientSignOffPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,    setProduct]    = useState(null)
  const [brief,      setBrief]      = useState(null)
  const [labSheets,  setLabSheets]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [signedOff,  setSignedOff]  = useState(false)
  const [userList,   setUserList]   = useState([])

  const [form, setForm] = useState({
    signedOffVersion:   '',        // labSheet versionNumber
    signedOffBy:        '',        // client name (free text)
    signedOffInternally:'',        // internal person (dropdown from users)
    signedOffDate:      new Date().toISOString().split('T')[0],
    initialOrderVolume: '',        // e.g. "500 bottles" or "50 cases"
    initialOrderUnit:   'bottles',
    deliveryAddress:    '',
    targetDeliveryDate: '',
    clientFeedback:     '',        // any comments from client at sign-off
    notes:              '',        // internal notes
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

      if (p.briefId) {
        const bSnap = await getDoc(doc(db, 'briefs', p.briefId))
        if (bSnap.exists()) {
          const b = { id: bSnap.id, ...bSnap.data() }
          setBrief(b)
          // Pre-fill delivery address from brief
          const fd = b.formData || {}
          set('deliveryAddress', [fd.sampleStreet, fd.sampleCity, fd.samplePostcode, fd.sampleCountry].filter(Boolean).join(', '))
        }

        const lSnap = await getDocs(query(
          collection(db, 'labSheets'),
          where('briefId', '==', p.briefId),
          orderBy('createdAt', 'desc')
        ))
        const sheets = lSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setLabSheets(sheets)

        // Auto-select signed-off version
        const signedSheet = sheets.find(s => s.status === 'signed-off')
        if (signedSheet) set('signedOffVersion', String(signedSheet.versionNumber))
      }

      // Load existing sign-off data if already done
      const cso = p.stages?.clientSignOff
      if (cso?.status === 'complete') {
        setSignedOff(true)
        setForm(f => ({
          ...f,
          signedOffVersion:    cso.signedOffVersion    || '',
          signedOffBy:         cso.signedOffBy         || '',
          signedOffInternally: cso.signedOffInternally || '',
          signedOffDate:       cso.signedOffDate?.split('T')[0] || f.signedOffDate,
          initialOrderVolume:  cso.initialOrderVolume  || '',
          initialOrderUnit:    cso.initialOrderUnit    || 'bottles',
          deliveryAddress:     cso.deliveryAddress     || '',
          targetDeliveryDate:  cso.targetDeliveryDate  || '',
          clientFeedback:      cso.clientFeedback      || '',
          notes:               cso.notes               || '',
        }))
      }

      // Load users for internal sign-off dropdown
      const uSnap = await getDocs(collection(db, 'users'))
      setUserList(uSnap.docs.map(d => d.data().name).filter(Boolean).sort())

    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const submit = async () => {
    if (!form.signedOffVersion || !form.signedOffBy) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'products', productId), {
        'stages.clientSignOff.status':            'complete',
        'stages.clientSignOff.signedOffVersion':  form.signedOffVersion,
        'stages.clientSignOff.signedOffBy':       form.signedOffBy,
        'stages.clientSignOff.signedOffInternally': form.signedOffInternally,
        'stages.clientSignOff.signedOffDate':     new Date(form.signedOffDate).toISOString(),
        'stages.clientSignOff.initialOrderVolume':form.initialOrderVolume,
        'stages.clientSignOff.initialOrderUnit':  form.initialOrderUnit,
        'stages.clientSignOff.deliveryAddress':   form.deliveryAddress,
        'stages.clientSignOff.targetDeliveryDate':form.targetDeliveryDate,
        'stages.clientSignOff.clientFeedback':    form.clientFeedback,
        'stages.clientSignOff.notes':             form.notes,
        'stages.validation.status':              'in-progress',
      })
      setSignedOff(true)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const reopen = async () => {
    await updateDoc(doc(db, 'products', productId), {
      'stages.clientSignOff.status':   'in-progress',
      'stages.validation.status':      'not-started',
    })
    setSignedOff(false)
  }

  const fd = brief?.formData || {}
  const signedSheet = labSheets.find(s => s.status === 'signed-off')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Client Sign-off — {product?.productName}</title></Head>

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
              <p className="text-xs text-white/50 hidden sm:block">{product?.clientName} · Client Sign-off</p>
            </div>
          </div>
          {signedOff && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full flex-shrink-0">Signed off ✓</span>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Signed off banner */}
        {signedOff && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-800">✓ Client has signed off</p>
              <p className="text-xs text-green-600 mt-0.5">
                V{form.signedOffVersion} · {form.signedOffBy}
                {form.signedOffDate ? ` · ${new Date(form.signedOffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                {form.initialOrderVolume ? ` · ${form.initialOrderVolume} ${form.initialOrderUnit}` : ''}
              </p>
            </div>
            <button onClick={reopen} className="px-4 py-2 border border-green-300 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition flex-shrink-0">Edit</button>
          </div>
        )}

        {/* No signed-off lab sheet warning */}
        {!signedSheet && !signedOff && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-amber-800">No lab sheet marked ready yet</p>
            <p className="text-xs text-amber-600 mt-0.5">Go back to Lab Development and mark a version ready before logging client sign-off.</p>
          </div>
        )}

        {/* Version reference card */}
        {labSheets.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lab versions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Select which version the client is signing off.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {labSheets.map(s => (
                <label key={s.id} className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition ${!signedOff ? 'hover:bg-gray-50' : 'cursor-default'}`}>
                  <input
                    type="radio" name="version" value={String(s.versionNumber)}
                    checked={form.signedOffVersion === String(s.versionNumber)}
                    onChange={() => !signedOff && set('signedOffVersion', String(s.versionNumber))}
                    disabled={signedOff}
                    className="accent-black flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">V{s.versionNumber}</span>
                      <span className="text-sm text-gray-700">{s.versionName}</span>
                      {s.status === 'signed-off' && (
                        <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Ready ✓</span>
                      )}
                    </div>
                    {s.versionNote && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.versionNote}</p>}
                    {s.versionCook && <p className="text-xs text-gray-400">by {s.versionCook}</p>}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sign-off details */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sign-off details</h2>
            <p className="text-xs text-gray-400 mt-0.5">Log who approved, when, and the initial order.</p>
          </div>
          <div className="px-5 py-5 space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Signed off by (client) *</label>
                <input value={form.signedOffBy} onChange={e => set('signedOffBy', e.target.value)} disabled={signedOff}
                  placeholder={fd.contactName || 'Client name'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Signed off date *</label>
                <input type="date" value={form.signedOffDate} onChange={e => set('signedOffDate', e.target.value)} disabled={signedOff}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Signed off internally by</label>
              <select value={form.signedOffInternally} onChange={e => set('signedOffInternally', e.target.value)} disabled={signedOff}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50">
                <option value="">Select team member...</option>
                {userList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client feedback at sign-off</label>
              <textarea value={form.clientFeedback} onChange={e => set('clientFeedback', e.target.value)} disabled={signedOff}
                placeholder="What did they love? Any conditions? Any tweaks requested for future batches?"
                rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Initial order */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Initial order</h2>
            <p className="text-xs text-gray-400 mt-0.5">What's the first production run they've asked for?</p>
          </div>
          <div className="px-5 py-5 space-y-5">

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Volume</label>
                <input type="number" min="0" value={form.initialOrderVolume} onChange={e => set('initialOrderVolume', e.target.value)} disabled={signedOff}
                  placeholder={fd.casesPerMonth || 'e.g. 50'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
                <select value={form.initialOrderUnit} onChange={e => set('initialOrderUnit', e.target.value)} disabled={signedOff}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50">
                  {['bottles', 'cases', 'litres'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Target delivery</label>
                <input type="date" value={form.targetDeliveryDate} onChange={e => set('targetDeliveryDate', e.target.value)} disabled={signedOff}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
            </div>

            {form.initialOrderVolume && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600">
                {form.initialOrderUnit === 'cases' && <>
                  <span className="font-semibold">{form.initialOrderVolume} cases</span> = {parseInt(form.initialOrderVolume) * 6} bottles
                </>}
                {form.initialOrderUnit === 'bottles' && <>
                  <span className="font-semibold">{form.initialOrderVolume} bottles</span> = {Math.ceil(parseInt(form.initialOrderVolume) / 6)} cases
                </>}
                {form.initialOrderUnit === 'litres' && <>
                  <span className="font-semibold">{form.initialOrderVolume} litres</span>
                </>}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery address</label>
              <input value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)} disabled={signedOff}
                placeholder="Where should the first order be delivered?"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Internal notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} disabled={signedOff}
                placeholder="Anything else ops needs to know for the first production run..."
                rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        {!signedOff && (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Confirming this advances the pipeline to Test Batch production.</p>
              {!form.signedOffVersion && <p className="text-xs text-amber-600 mt-0.5">Select a version above first.</p>}
            </div>
            <button
              onClick={submit}
              disabled={saving || !form.signedOffVersion || !form.signedOffBy}
              className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40 flex-shrink-0"
            >
              {saving ? 'Saving...' : 'Confirm client sign-off →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}