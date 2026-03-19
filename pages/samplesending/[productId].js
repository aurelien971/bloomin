import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const EMPTY_PACKAGE = () => ({ bottles: '', courier: '', trackingNumber: '', expectedArrival: '' })

export default function SampleSendingPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [brief,    setBrief]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [sent,     setSent]     = useState(false)
  const [userList, setUserList] = useState([])

  const [form, setForm] = useState({
    sentBy:           '',
    sentDate:         new Date().toISOString().split('T')[0],
    recipientName:    '',
    recipientEmail:   '',
    recipientAddress: '',
    notes:            '',
  })
  const [packages, setPackages] = useState([EMPTY_PACKAGE()])

  const setF = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setPkg = (i, f, v) => setPackages(ps => ps.map((p, idx) => idx === i ? { ...p, [f]: v } : p))
  const addPackage = () => setPackages(ps => [...ps, EMPTY_PACKAGE()])
  const removePackage = (i) => setPackages(ps => ps.filter((_, idx) => idx !== i))

  const totalBottles = packages.reduce((sum, p) => sum + (parseInt(p.bottles) || 0), 0)
  const earliestArrival = packages
    .filter(p => p.expectedArrival)
    .sort((a, b) => new Date(a.expectedArrival) - new Date(b.expectedArrival))[0]?.expectedArrival

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
          const fd = b.formData || {}
          setForm(f => ({
            ...f,
            recipientName:    fd.sampleName || fd.contactName || '',
            recipientEmail:   fd.contactEmail || '',
            recipientAddress: [fd.sampleStreet, fd.sampleCity, fd.samplePostcode, fd.sampleCountry].filter(Boolean).join(', '),
          }))
        }
      }

      const ss = p.stages?.sampleSending
      if (ss?.sentAt) {
        setSent(true)
        setForm(f => ({
          ...f,
          sentBy:           ss.sentBy           || '',
          sentDate:         ss.sentAt?.split('T')[0] || '',
          recipientName:    ss.recipientName     || '',
          recipientEmail:   ss.recipientEmail    || '',
          recipientAddress: ss.recipientAddress  || '',
          notes:            ss.notes             || '',
        }))
        if (ss.packages?.length) setPackages(ss.packages)
      }

      const uSnap = await getDocs(collection(db, 'users'))
      setUserList(uSnap.docs.map(d => d.data().name).filter(Boolean).sort())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const submit = async () => {
    if (!form.sentBy || !form.recipientName || totalBottles === 0) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'products', productId), {
        'stages.sampleSending.status':          'complete',
        'stages.sampleSending.sentAt':          new Date(form.sentDate).toISOString(),
        'stages.sampleSending.sentBy':          form.sentBy,
        'stages.sampleSending.bottlesSent':     String(totalBottles),
        'stages.sampleSending.packages':        packages,
        'stages.sampleSending.recipientName':   form.recipientName,
        'stages.sampleSending.recipientEmail':  form.recipientEmail,
        'stages.sampleSending.recipientAddress':form.recipientAddress,
        'stages.sampleSending.expectedArrival': earliestArrival || '',
        'stages.sampleSending.notes':           form.notes,
        'stages.clientSignOff.status':          'in-progress',
      })
      setSent(true)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const reopen = async () => {
    await updateDoc(doc(db, 'products', productId), {
      'stages.sampleSending.status':  'in-progress',
      'stages.clientSignOff.status':  'not-started',
    })
    setSent(false)
  }

  const fd = brief?.formData || {}

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Sample Sending — {product?.productName}</title></Head>

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
              <p className="text-xs text-white/50 hidden sm:block">{product?.clientName} · Sample Sending</p>
            </div>
          </div>
          {sent && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full flex-shrink-0">Sent ✓</span>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {sent && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-800">✓ Samples sent — waiting for client sign-off</p>
              <p className="text-xs text-green-600 mt-0.5">
                {totalBottles} bottle{totalBottles !== 1 ? 's' : ''} · {packages.length} box{packages.length !== 1 ? 'es' : ''} · to {form.recipientName}
                {earliestArrival ? ` · first arrival ${new Date(earliestArrival).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
              </p>
            </div>
            <button onClick={reopen} className="px-4 py-2 border border-green-300 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition flex-shrink-0">Edit</button>
          </div>
        )}

        {/* Brief reference */}
        {!sent && (fd.contactName || fd.contactEmail || fd.sampleStreet) && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-blue-700 mb-2">📋 From the client brief</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Contact', val: fd.contactName },
                { label: 'Email',   val: fd.contactEmail },
                { label: 'Address', val: [fd.sampleStreet, fd.sampleCity, fd.samplePostcode, fd.sampleCountry].filter(Boolean).join(', ') },
              ].filter(f => f.val).map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">{f.label}</p>
                  <p className="text-xs text-blue-800 mt-0.5">{f.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent by + date */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Shipment details</h2>
          </div>
          <div className="px-5 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sent by *</label>
                <select value={form.sentBy} onChange={e => setF('sentBy', e.target.value)} disabled={sent}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50">
                  <option value="">Select...</option>
                  {userList.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date sent</label>
                <input type="date" value={form.sentDate} onChange={e => setF('sentDate', e.target.value)} disabled={sent}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input placeholder="Full name" value={form.recipientName} onChange={e => setF('recipientName', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input type="email" placeholder="Email address" value={form.recipientEmail} onChange={e => setF('recipientEmail', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
                </div>
              </div>
              <input placeholder="Delivery address" value={form.recipientAddress} onChange={e => setF('recipientAddress', e.target.value)} disabled={sent}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
              <textarea placeholder="e.g. fragile, keep refrigerated, include tasting notes..." value={form.notes} onChange={e => setF('notes', e.target.value)} disabled={sent}
                rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Packages</h2>
              <p className="text-xs text-gray-400 mt-0.5">One row per box. Each can have its own tracking number and arrival date.</p>
            </div>
            {totalBottles > 0 && (
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                {totalBottles} bottle{totalBottles !== 1 ? 's' : ''} total · {packages.length} box{packages.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 pt-4 pb-2">
            {[['Box', 1], ['Bottles', 2], ['Courier', 3], ['Tracking number', 3], ['Expected arrival', 3]].map(([h, span]) => (
              <p key={h} className={`text-xs font-semibold text-gray-400 uppercase tracking-wide col-span-${span}`}>{h}</p>
            ))}
          </div>

          <div className="px-5 pb-4 space-y-3">
            {packages.map((pkg, i) => (
              <div key={i} className="sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center space-y-2 sm:space-y-0 bg-gray-50 sm:bg-transparent rounded-xl sm:rounded-none p-3 sm:p-0">
                {/* Box number */}
                <div className="sm:col-span-1 flex items-center justify-between sm:block">
                  <span className="text-xs font-bold text-gray-400 sm:hidden">Box {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <span className="hidden sm:block text-xs font-bold text-gray-400">{i + 1}</span>
                    {!sent && packages.length > 1 && (
                      <button onClick={() => removePackage(i)} className="text-gray-300 hover:text-red-400 transition text-lg sm:ml-1">×</button>
                    )}
                  </div>
                </div>
                {/* Bottles */}
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-400 sm:hidden block mb-0.5">Bottles in this box</label>
                  <input type="number" min="1" placeholder="e.g. 2" value={pkg.bottles} onChange={e => setPkg(i, 'bottles', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
                </div>
                {/* Courier */}
                <div className="sm:col-span-3">
                  <label className="text-xs text-gray-400 sm:hidden block mb-0.5">Courier</label>
                  <input placeholder="e.g. DHL" value={pkg.courier} onChange={e => setPkg(i, 'courier', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
                </div>
                {/* Tracking */}
                <div className="sm:col-span-3">
                  <label className="text-xs text-gray-400 sm:hidden block mb-0.5">Tracking number</label>
                  <input placeholder="Optional" value={pkg.trackingNumber} onChange={e => setPkg(i, 'trackingNumber', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
                </div>
                {/* Expected arrival */}
                <div className="sm:col-span-3">
                  <label className="text-xs text-gray-400 sm:hidden block mb-0.5">Expected arrival</label>
                  <input type="date" value={pkg.expectedArrival} onChange={e => setPkg(i, 'expectedArrival', e.target.value)} disabled={sent}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
                </div>
              </div>
            ))}

            {!sent && (
              <button onClick={addPackage} className="text-sm text-gray-500 hover:text-black font-medium transition mt-1">
                + Add another box
              </button>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        {!sent && (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-400">Once confirmed, the pipeline advances to client sign-off.</p>
              {totalBottles === 0 && <p className="text-xs text-amber-600 mt-0.5">Add at least one box with bottles above.</p>}
            </div>
            <button onClick={submit}
              disabled={saving || !form.sentBy || !form.recipientName || totalBottles === 0}
              className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40 flex-shrink-0">
              {saving ? 'Saving...' : 'Confirm sample sent →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}