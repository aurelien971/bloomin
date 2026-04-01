import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const LABS = ['Eurofins', 'Intertek', 'SGS', 'LGC', 'Other']

const TEST_TYPES = [
  { val: 'energy',      label: 'Energy (kcal/kJ)'   },
  { val: 'fat',         label: 'Total fat'           },
  { val: 'saturates',   label: 'Saturates'           },
  { val: 'carbs',       label: 'Carbohydrates'       },
  { val: 'sugars',      label: 'Sugars'              },
  { val: 'fibre',       label: 'Dietary fibre'       },
  { val: 'protein',     label: 'Protein'             },
  { val: 'salt',        label: 'Salt'                },
  { val: 'vitamins',    label: 'Vitamins & minerals' },
  { val: 'claims',      label: 'Nutrition claims'    },
]

const EMPTY_TEST = {
  sentBy: '', lab: 'Eurofins', labOther: '',
  dateSent: '', unitsSent: '',
  testTypes: [],
  expectedResultsDate: '',
  claimsBeingTested: '',
  status: 'pending',
  results: {},
  notes: '',
  completedAt: '',
  overallPass: '',
}

export default function NutritionalTestPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [nutTest,  setNutTest]  = useState(null)
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

      const tSnap = await getDocs(query(collection(db, 'nutritionalTests'), where('productId', '==', productId)))
      if (!tSnap.empty) {
        const t = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() }
        setNutTest(t)
        setForm({ ...EMPTY_TEST, ...t })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setResult = (key, field, val) => setForm(f => ({ ...f, results: { ...f.results, [key]: { ...(f.results[key] || {}), [field]: val } } }))
  const toggleTest = (type) => setForm(f => ({
    ...f,
    testTypes: f.testTypes.includes(type) ? f.testTypes.filter(t => t !== type) : [...f.testTypes, type],
  }))

  const save = async (markComplete = false) => {
    if (!product) return
    setSaving(true)
    const allPass = form.testTypes.length > 0 && form.testTypes.every(t => form.results[t]?.pass === 'Pass')
    const data = {
      ...form, productId,
      productName: product.productName,
      status: markComplete ? 'results-received' : 'pending',
      completedAt: markComplete ? new Date().toISOString() : form.completedAt,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (nutTest) {
        await updateDoc(doc(db, 'nutritionalTests', nutTest.id), data)
        setNutTest(t => ({ ...t, ...data }))
      } else {
        const ref = await addDoc(collection(db, 'nutritionalTests'), { ...data, createdAt: new Date().toISOString() })
        setNutTest({ id: ref.id, ...data })
      }
      setForm(data)

      const stageUpdate = { 'stages.nutritionalTesting.status': 'in-progress' }
      if (form.expectedResultsDate) stageUpdate['stages.nutritionalTesting.expectedResultsDate'] = form.expectedResultsDate
      if (markComplete) {
        stageUpdate['stages.nutritionalTesting.status'] = allPass ? 'complete' : 'failed'
        if (allPass) stageUpdate['stages.labelling.status'] = 'in-progress'
      }
      await updateDoc(doc(db, 'products', productId), stageUpdate)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const resultsIn = form.status === 'results-received'
  const allPass   = form.testTypes.length > 0 && form.testTypes.every(t => form.results[t]?.pass === 'Pass')

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Nutritional Testing — {product?.productName}</title></Head>

      {/* Header */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5 hidden sm:block">{product?.clientName} · Nutritional Testing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {resultsIn && allPass && <span className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-full">All passed ✓</span>}
            {resultsIn && !allPass && <span className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-full hidden sm:inline">Failed — investigate</span>}
            <button onClick={() => save(false)} disabled={saving} className="px-3 sm:px-4 py-2 border border-white/20 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-white/10 transition">Save</button>
            {!resultsIn && (
              <button onClick={() => save(true)} disabled={saving || !form.sentBy || form.testTypes.length === 0}
                className="px-3 sm:px-4 py-2 bg-white text-black text-xs sm:text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
                Mark results received →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* What is this */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-blue-900">🧫 Nutritional Testing</p>
          <p className="text-sm text-blue-700 mt-1">Send samples to the lab for full nutritional analysis — energy, macros, salt, vitamins, and any nutrition claims (e.g. "low sugar", "high protein"). Results are required before labelling can be finalised.</p>
        </div>

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
              <Label>Nutrition claims being tested</Label>
              <input value={form.claimsBeingTested} onChange={e => set('claimsBeingTested', e.target.value)}
                placeholder="e.g. Low sugar, Source of vitamin C"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
        </Card>

        {/* Tests requested */}
        <Card title="Tests requested" sub="Select every nutrient/claim being tested">
          <div className="flex flex-wrap gap-2">
            {TEST_TYPES.map(t => (
              <label key={t.val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium ${form.testTypes.includes(t.val) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                <input type="checkbox" className="hidden" checked={form.testTypes.includes(t.val)} onChange={() => toggleTest(t.val)} />
                {t.label}
              </label>
            ))}
          </div>
        </Card>

        {/* Results — only show once sent */}
        {form.testTypes.length > 0 && (
          <Card title="Results" sub="Enter lab results once received">
            <div className="space-y-3">
              {form.testTypes.map(type => {
                const t = TEST_TYPES.find(x => x.val === type)
                const r = form.results[type] || {}
                return (
                  <div key={type} className="grid grid-cols-3 gap-3 items-end border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="col-span-2">
                      <Label>{t?.label}</Label>
                      <input value={r.result || ''} onChange={e => setResult(type, 'result', e.target.value)}
                        placeholder="e.g. 2.3g per 100ml"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <Label>Pass / Fail</Label>
                      <select value={r.pass || ''} onChange={e => setResult(type, 'pass', e.target.value)}
                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white ${r.pass === 'Pass' ? 'border-green-300 bg-green-50 text-green-800' : r.pass === 'Fail' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-200'}`}>
                        <option value="">—</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    </div>
                  </div>
                )
              })}
              <div>
                <Label>Notes</Label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any deviations, clarifications or follow-up actions..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
              </div>
            </div>
          </Card>
        )}

        {/* Overall result */}
        {resultsIn && (
          <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between ${allPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div>
              <p className={`text-sm font-bold ${allPass ? 'text-green-800' : 'text-red-800'}`}>
                {allPass ? '✓ All nutritional tests passed' : '✗ One or more tests failed'}
              </p>
              <p className={`text-xs mt-0.5 ${allPass ? 'text-green-600' : 'text-red-600'}`}>
                {allPass ? 'Labelling can now be finalised.' : 'Investigate failures before proceeding to labelling.'}
              </p>
            </div>
            <span className="text-2xl">{allPass ? '🎉' : '⚠️'}</span>
          </div>
        )}
      </div>
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