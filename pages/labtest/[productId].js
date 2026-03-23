import { useState, useEffect } from 'react'
import FeedbackWidget from '../../components/FeedbackWidget'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const LABS  = ['Eurofins', 'Intertek', 'SGS', 'LGC', 'Other']

const EMPTY_TEST = {
  sentBy: '', lab: 'Eurofins', labOther: '',
  dateSent: '', unitsSent: '',
  testTypes: [],
  expectedResultsDate: '',
  status: 'pending',
  results: {
    shelfLife: { result: '', pass: '' },
    micro:     { result: '', pass: '' },
    notes: '',
  },
  completedAt: '',
  overallPass: '',
}

export default function LabTestPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [labTest,  setLabTest]  = useState(null)
  const [form,     setForm]     = useState(EMPTY_TEST)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [userList, setUserList] = useState([])

  useEffect(() => { if (productId) init() }, [productId])
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      setUserList(snap.docs.map(d => d.data().name).filter(Boolean).sort())
    }).catch(console.error)
  }, [])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      setProduct({ id: pSnap.id, ...pSnap.data() })

      const tSnap = await getDocs(query(collection(db, 'labTests'), where('productId', '==', productId)))
      if (!tSnap.empty) {
        const t = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() }
        setLabTest(t)
        setForm({ ...EMPTY_TEST, ...t })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setResult = (key, field, val) => setForm(f => ({ ...f, results: { ...f.results, [key]: { ...f.results[key], [field]: val } } }))

  const toggleTest = (type) => {
    setForm(f => ({
      ...f,
      testTypes: f.testTypes.includes(type)
        ? f.testTypes.filter(t => t !== type)
        : [...f.testTypes, type],
    }))
  }

  const save = async (markComplete = false) => {
    if (!product) return
    setSaving(true)
    const data = {
      ...form,
      productId,
      productName: product.productName,
      status: markComplete ? 'results-received' : 'pending',
      completedAt: markComplete ? new Date().toISOString() : form.completedAt,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (labTest) {
        await updateDoc(doc(db, 'labTests', labTest.id), data)
        setLabTest(t => ({ ...t, ...data }))
      } else {
        const ref = await addDoc(collection(db, 'labTests'), { ...data, createdAt: new Date().toISOString() })
        setLabTest({ id: ref.id, ...data })
      }
      setForm(data)

      // Update product stage
      const stageUpdate = { 'stages.labTesting.status': 'in-progress' }
      if (form.expectedResultsDate) stageUpdate['stages.labTesting.expectedResultsDate'] = form.expectedResultsDate
      if (markComplete) {
        const overallPass = form.testTypes.every(t => form.results[t]?.pass === 'Pass')
        if (overallPass) {
          stageUpdate['stages.labTesting.status'] = 'complete'
          stageUpdate['stages.release.status']    = 'complete'
        } else {
          stageUpdate['stages.labTesting.status'] = 'failed'
        }
      }
      await updateDoc(doc(db, 'products', productId), stageUpdate)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const resultsIn = form.status === 'results-received'
  const allPass   = form.testTypes.length > 0 && form.testTypes.every(t => form.results[t]?.pass === 'Pass')

  if (loading) return <Loader />

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Lab Testing — {product?.productName}</title></Head>

      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5 hidden sm:block">{product?.clientName} · Lab Testing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {resultsIn && allPass && (
              <span className="px-2 sm:px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">All passed ✓</span>
            )}
            {resultsIn && !allPass && (
              <span className="px-2 sm:px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-full hidden sm:inline">Failed — investigate</span>
            )}
            <button onClick={() => save(false)} disabled={saving} className="px-3 sm:px-4 py-2 border border-white/20 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-white/10 transition">
              Save
            </button>
            {!resultsIn && (
              <button
                onClick={() => save(true)}
                disabled={saving || !form.sentBy || form.testTypes.length === 0}
                className="px-3 sm:px-4 py-2 bg-white text-black text-xs sm:text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
              >
                <span className="hidden sm:inline">Mark results received →</span>
                <span className="sm:hidden">Results in →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Submission details */}
        <Card title="Submission details">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label>Sent by</Label>
              <select value={form.sentBy} onChange={e => set('sentBy', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">Select...</option>
                {userList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Lab</Label>
              <div className="flex gap-2">
                <select value={form.lab} onChange={e => set('lab', e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  {LABS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {form.lab === 'Other' && (
                  <input value={form.labOther} onChange={e => set('labOther', e.target.value)} placeholder="Lab name" className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                )}
              </div>
            </div>
            <div>
              <Label>Date sent</Label>
              <input type="date" value={form.dateSent} onChange={e => set('dateSent', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <Label>Units sent</Label>
              <input value={form.unitsSent} onChange={e => set('unitsSent', e.target.value)} placeholder="e.g. 6 bottles" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <Label>Expected results date</Label>
              <input type="date" value={form.expectedResultsDate} onChange={e => set('expectedResultsDate', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <Label>Tests requested</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {[
                  { val: 'shelfLife', label: 'Shelf life' },
                  { val: 'micro',     label: 'Micro'      },
                ].map(t => (
                  <label key={t.val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium ${form.testTypes.includes(t.val) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    <input type="checkbox" className="hidden" checked={form.testTypes.includes(t.val)} onChange={() => toggleTest(t.val)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Results */}
        {form.testTypes.length > 0 && (
          <Card title="Results" sub={resultsIn ? 'Results recorded' : 'Fill in once results are received from the lab'}>
            <div className="space-y-4">
              {form.testTypes.includes('shelfLife') && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Shelf life</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Result / finding</Label>
                      <textarea value={form.results.shelfLife?.result || ''} onChange={e => setResult('shelfLife', 'result', e.target.value)} placeholder="e.g. 18 months at ambient temperature..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                    </div>
                    <div>
                      <Label>Pass / Fail</Label>
                      <div className="flex gap-2 mt-1">
                        {['Pass', 'Fail'].map(o => (
                          <label key={o} className={`px-5 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition ${form.results.shelfLife?.pass === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                            <input type="radio" className="hidden" onChange={() => setResult('shelfLife', 'pass', o)} />{o}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {form.testTypes.includes('micro') && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Microbiological</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Result / finding</Label>
                      <textarea value={form.results.micro?.result || ''} onChange={e => setResult('micro', 'result', e.target.value)} placeholder="e.g. TVC, yeast/mould counts within spec..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                    </div>
                    <div>
                      <Label>Pass / Fail</Label>
                      <div className="flex gap-2 mt-1">
                        {['Pass', 'Fail'].map(o => (
                          <label key={o} className={`px-5 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition ${form.results.micro?.pass === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                            <input type="radio" className="hidden" onChange={() => setResult('micro', 'pass', o)} />{o}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Additional notes</Label>
                <textarea value={form.results.notes || ''} onChange={e => setForm(f => ({ ...f, results: { ...f.results, notes: e.target.value } }))} placeholder="Any other notes from the lab report..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
              </div>

              {/* Summary */}
              {resultsIn && (
                <div className={`rounded-2xl px-6 py-5 text-center border ${allPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  {allPass ? (
                    <>
                      <p className="text-sm font-bold text-green-800">✓ All tests passed — product cleared for Business as Usual</p>
                      <p className="text-xs text-green-600 mt-1">This product can now move to routine production and release.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-red-800">One or more tests failed — investigation required</p>
                      <p className="text-xs text-red-600 mt-1">Do not release to client until issues are resolved and re-tested.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <FeedbackWidget page="labtesting" pageId={productId} />
    </div>
  )
}

function Card({ title, sub, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}
function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{children}</p>
}
function Loader() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>
}