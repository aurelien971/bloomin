import { useState, useEffect } from 'react'
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

        {/* Eurofins submission guide */}
        {form.lab === 'Eurofins' && <EurofinsGuide productName={product?.productName} />}

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
    </div>
  )
}

function EurofinsGuide({ productName }) {
  const [open,    setOpen]    = useState(true)
  const [checked, setChecked] = useState({})
  const [copied,  setCopied]  = useState(false)

  const toggleCheck = (key) => setChecked(c => ({ ...c, [key]: !c[key] }))

  const ADDRESS = 'Eurofins Food Testing UK Limited\n54 Business Park\nValiant Way\nWolverhampton\nWV9 5GB'

  const copyAddress = () => {
    navigator.clipboard.writeText(ADDRESS)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const STEPS = [
    {
      key: 'login',
      icon: '🔐',
      title: 'Log in to the Eurofins portal',
      tag: { text: 'Jesse has login', color: 'bg-red-50 text-red-600 border-red-200' },
      body: 'Jesse has the Bloomin Foods account credentials. Ask him before you start.',
    },
    {
      key: 'create',
      icon: '📋',
      title: 'Create a new order',
      body: 'From the Eurofins dashboard, click "Create Order".',
    },
    {
      key: 'account',
      icon: '🏭',
      title: 'Select Bloomin Foods',
      body: 'In the first dropdown, select "Bloomin Foods" as the account.',
    },
    {
      key: 'testtype',
      icon: '🧪',
      title: 'Select the test type',
      body: 'Second dropdown — choose your test type: Micro, Shelf Life Extension, or both.',
    },
    {
      key: 'samples',
      icon: '📦',
      title: 'Add samples',
      substeps: [
        'Select your dispatch date',
        'Click "Add Sample"',
        `Category → Finished product`,
        `Sample Description → ${productName || '[product name]'}`,
        'Enter the Batch Code',
        'Testing Schedule → Default',
        'Repeat for each additional sample',
        'Click "Generate Barcodes" once all samples are added',
      ],
    },
    {
      key: 'submit',
      icon: '✅',
      title: 'Submit & pay',
      substeps: [
        'Click Next (bottom right)',
        'Update package dropdown to match test type (e.g. Micro)',
        'Click Submit (bottom right)',
        'Review the preview page carefully — go back if anything looks wrong',
        'Download the Submit Order Review page',
        'Click the final Submit button',
        'Complete the payment process',
      ],
    },
    {
      key: 'ship',
      icon: '🚚',
      title: 'Pack & ship via DHL',
      substeps: [
        'Print the Order Review page — it contains the barcodes',
        'Place the barcode sheet inside the package',
        'Label all bottles clearly',
        'Pack bottles carefully to avoid breakages',
        'Book DHL collection at dhl.com',
      ],
      address: true,
    },
  ]

  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-base flex-shrink-0">📘</div>
          <div>
            <p className="text-sm font-bold text-gray-900">How to submit to Eurofins</p>
            <p className="text-xs text-gray-400 mt-0.5">{STEPS.length} steps · {doneCount} of {STEPS.length} checked off</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Mini progress */}
          <div className="hidden sm:flex items-center gap-1.5">
            {STEPS.map(s => (
              <div key={s.key} className={`w-2 h-2 rounded-full transition-all ${checked[s.key] ? 'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <span className={`text-gray-400 text-xs transition-transform inline-block ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Steps */}
          <div className="px-6 py-5">
            <div className="space-y-0">
              {STEPS.map((s, i) => {
                const done = !!checked[s.key]
                const isLast = i === STEPS.length - 1
                return (
                  <div key={s.key} className="flex gap-4">
                    {/* Left — connector line + circle */}
                    <div className="flex flex-col items-center flex-shrink-0 w-9">
                      <button
                        onClick={() => toggleCheck(s.key)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 border-2 transition-all ${
                          done ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200' : 'bg-white border-gray-200 hover:border-gray-400'
                        }`}>
                        {done ? '✓' : s.icon}
                      </button>
                      {!isLast && <div className={`w-px flex-1 min-h-[20px] my-1 transition-colors ${done ? 'bg-green-200' : 'bg-gray-100'}`} />}
                    </div>

                    {/* Right — content */}
                    <div className={`flex-1 min-w-0 pt-1.5 ${!isLast ? 'pb-6' : 'pb-0'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold transition-colors ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {s.title}
                        </p>
                        {s.tag && !done && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.tag.color}`}>{s.tag.text}</span>
                        )}
                        {done && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Done</span>}
                      </div>

                      {!done && (
                        <>
                          {s.body && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{s.body}</p>}
                          {s.substeps && (
                            <div className="mt-2 space-y-1.5 pl-1">
                              {s.substeps.map((sub, si) => (
                                <div key={si} className="flex items-start gap-2.5">
                                  <span className="text-[10px] font-bold text-gray-300 mt-1 flex-shrink-0">{si + 1}.</span>
                                  <p className="text-sm text-gray-600 leading-relaxed">{sub}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {s.address && (
                            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Ship to</p>
                                  <p className="text-sm font-semibold text-gray-900">Eurofins Food Testing UK Limited</p>
                                  <p className="text-sm text-gray-600">54 Business Park, Valiant Way</p>
                                  <p className="text-sm text-gray-600">Wolverhampton, WV9 5GB</p>
                                  <p className="text-xs text-gray-400 mt-1.5">📦 Book DHL at dhl.com</p>
                                </div>
                                <button onClick={copyAddress}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex-shrink-0 ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                                  {copied ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className={`px-6 py-3.5 border-t transition-colors ${doneCount === STEPS.length ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
            {doneCount === STEPS.length ? (
              <p className="text-xs text-green-700 font-semibold">🎉 All steps complete — don't forget to log the expected results date above so it shows on the calendar.</p>
            ) : (
              <p className="text-xs text-blue-700 font-medium">💡 Check off each step as you go. Once submitted, enter the expected results date above.</p>
            )}
          </div>
        </div>
      )}
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