import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const FACILITIES = ['Red Distillery', 'Kallax', 'Voxel', 'Rhode Island']
const TEAM       = ['Tom', 'Jesse', 'Aurelien', 'Ruth', 'Fiona', 'Dima', 'Asif']

const EMPTY_BATCH = (batchNumber) => ({
  batchNumber,
  facility: '', date: '', assessedBy: '', labReference: '',
  analytical: {
    brix:      { target: '', tolerance: '', actual: '', pass: '' },
    ph:        { target: '', tolerance: '', actual: '', pass: '' },
    viscosity: { target: '', tolerance: '', actual: '', pass: '' },
    fillWeight:{ target: '', tolerance: '', actual: '', pass: '' },
    colour:    { target: '', tolerance: '', actual: '', pass: '' },
  },
  visual: {
    colourNeat:  { labStandard: '', thisBatch: '', match: '', pass: '' },
    colourMilk:  { labStandard: '', thisBatch: '', match: '', pass: '' },
    colourWater: { labStandard: '', thisBatch: '', match: '', pass: '' },
    clarity: '', clarityPass: '',
    sediment: '', sedimentPass: '',
    separation: '', separationPass: '',
    overallVisual: '',
    notes: '',
  },
  sensory: {
    aroma:        { match: '', notes: '' },
    sweetness:    { match: '', notes: '' },
    acidity:      { match: '', notes: '' },
    flavourStr:   { match: '', notes: '' },
    topNotes:     '', aftertaste: { match: '', notes: '' },
    offNotes: '', offNotesDetail: '',
    clientWouldNotice: '',
    overallSensory: '',
  },
  application: {
    milk:  { milkType: '', colourCorrect: '', split: '', flavourOk: '', pass: '' },
    water: { colourCorrect: '', flavourOk: '', pass: '' },
    soda:  { colourCorrect: '', clouding: '', pass: '' },
    overallApplication: '',
  },
  process: {
    correctProcess: '', deviations: '', deviationDetail: '',
    cookTime: '', cookTimeOk: '', fillTemp: '', equipmentIssues: '',
    overallProcess: '',
  },
  micro: {
    submitted: '', submittedTo: '', dateSubmitted: '', expectedBy: '',
    results: '', pass: '',
  },
  decision: '', decisionNotes: '', approvedBy: '', approvedAt: '',
  status: 'draft',
})

const MATCH_OPTIONS = ['Match', 'Slight deviation', 'Unacceptable']

export default function ValidationPage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [batches,  setBatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [activeTab,setActiveTab]= useState(0)

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      setProduct({ id: pSnap.id, ...pSnap.data() })

      const bSnap = await getDocs(query(
        collection(db, 'validationBatches'),
        where('productId', '==', productId),
        orderBy('batchNumber', 'asc')
      ))
      if (!bSnap.empty) {
        setBatches(bSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })))
      } else {
        setBatches([EMPTY_BATCH(1), EMPTY_BATCH(2), EMPTY_BATCH(3)])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const updateBatch = (field, value) => {
    setBatches(bs => bs.map((b, i) => i === activeTab ? deepSet(b, field, value) : b))
  }

  const deepSet = (obj, path, value) => {
    const keys  = path.split('.')
    const clone  = { ...obj }
    let cur      = clone
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = { ...cur[keys[i]] }
      cur = cur[keys[i]]
    }
    cur[keys[keys.length - 1]] = value
    return clone
  }

  const batch = batches[activeTab] || EMPTY_BATCH(activeTab + 1)
  const b = batch

  const sectionsPassed = (bat) => {
    if (!bat) return 0
    return [
      bat.visual?.overallVisual === 'Pass',
      bat.sensory?.overallSensory === 'Pass',
      bat.application?.overallApplication === 'Pass',
      bat.process?.overallProcess === 'Pass',
    ].filter(Boolean).length
  }

  const saveBatch = async () => {
    if (!product) return
    setSaving(true)
    try {
      const updated = []
      for (const bat of batches) {
        const data = { ...bat, productId, updatedAt: new Date().toISOString() }
        delete data.firestoreId
        if (bat.firestoreId) {
          await updateDoc(doc(db, 'validationBatches', bat.firestoreId), data)
          updated.push({ firestoreId: bat.firestoreId, ...data })
        } else {
          const ref = await addDoc(collection(db, 'validationBatches'), { ...data, createdAt: new Date().toISOString() })
          updated.push({ firestoreId: ref.id, ...data })
        }
      }
      setBatches(updated)

      const allApproved = updated.every(bat => bat.decision === 'approved' || bat.decision === 'approved-with-note')
      if (allApproved) {
        await updateDoc(doc(db, 'products', productId), {
          'stages.validation.status':          'complete',
          'stages.validation.batchesCompleted': 3,
          'stages.labTesting.status':           'in-progress',
        })
      } else {
        await updateDoc(doc(db, 'products', productId), {
          'stages.validation.status':          'in-progress',
          'stages.validation.batchesCompleted': updated.filter(bat => bat.decision).length,
        })
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  if (loading) return <Loader />

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Validation — {product?.productName}</title></Head>

      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm">← Back</button>
            <div className="w-px h-5 bg-white/20" />
            <div>
              <p className="font-bold text-white">{product?.productName}</p>
              <p className="text-xs text-white/50 mt-0.5">{product?.clientName} · Scale-Up Validation</p>
            </div>
          </div>
          <button onClick={saveBatch} disabled={saving} className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Batch tabs */}
        <div className="max-w-5xl mx-auto px-6 pb-0 flex gap-1">
          {batches.map((bat, i) => {
            const done = bat.decision === 'approved' || bat.decision === 'approved-with-note'
            const fail = bat.decision === 'rejected'
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition ${activeTab === i ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
              >
                <div className={`w-2 h-2 rounded-full ${done ? 'bg-green-400' : fail ? 'bg-red-400' : 'bg-gray-500'}`} />
                Batch {i + 1}
                {bat.decision && <span className="text-xs opacity-70">{done ? '✓' : '✗'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Batch info */}
        <Card title={`Batch ${activeTab + 1} — Information`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Production facility</Label>
              <select value={b.facility} onChange={e => updateBatch('facility', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">Select...</option>
                {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Production date</Label>
              <input type="date" value={b.date} onChange={e => updateBatch('date', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <Label>Assessed by</Label>
              <select value={b.assessedBy} onChange={e => updateBatch('assessedBy', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">Select...</option>
                {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Lab sheet reference</Label>
              <input value={b.labReference} onChange={e => updateBatch('labReference', e.target.value)} placeholder="e.g. V3" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
        </Card>

        {/* Analytical */}
        <Card title="A — Analytical Checks" sub="Pass or fail. No grey area.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {['Parameter', 'Lab target', 'Tolerance', 'Actual result', 'Pass / Fail'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(b.analytical).map(([key, row]) => (
                  <tr key={key} className={`border-t border-gray-50 ${row.pass === 'Fail' ? 'bg-red-50/50' : row.pass === 'Pass' ? 'bg-green-50/30' : ''}`}>
                    <td className="py-2.5 pr-4 font-medium text-gray-700 capitalize">{key === 'fillWeight' ? 'Fill weight' : key === 'ph' ? 'pH' : key.charAt(0).toUpperCase() + key.slice(1)}</td>
                    {['target', 'tolerance', 'actual'].map(f => (
                      <td key={f} className="py-2 pr-3">
                        <input value={row[f]} onChange={e => updateBatch(`analytical.${key}.${f}`, e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="—" />
                      </td>
                    ))}
                    <td className="py-2">
                      <div className="flex gap-2">
                        {['Pass', 'Fail'].map(o => (
                          <label key={o} className={`flex items-center justify-center px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${row.pass === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                            <input type="radio" className="hidden" onChange={() => updateBatch(`analytical.${key}.pass`, o)} />
                            {o}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Visual */}
        <Card title="B — Visual / Appearance">
          <div className="space-y-4">
            {[
              { key: 'colourNeat',  label: 'Colour — neat syrup'   },
              { key: 'colourMilk',  label: 'Colour — in milk'      },
              { key: 'colourWater', label: 'Colour — in water'      },
            ].map(({ key, label }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-3">{label}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Lab standard</Label><input value={b.visual[key]?.labStandard || ''} onChange={e => updateBatch(`visual.${key}.labStandard`, e.target.value)} placeholder="Lab colour" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                  <div><Label>This batch</Label><input value={b.visual[key]?.thisBatch || ''} onChange={e => updateBatch(`visual.${key}.thisBatch`, e.target.value)} placeholder="Batch colour" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                  <div>
                    <Label>Result</Label>
                    <div className="flex gap-2 flex-wrap">
                      {['Pass', 'Fail'].map(o => (
                        <label key={o} className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.visual[key]?.pass === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                          <input type="radio" className="hidden" onChange={() => updateBatch(`visual.${key}.pass`, o)} />{o}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'clarity', passKey: 'clarityPass', label: 'Clarity / haze' },
                { key: 'sediment', passKey: 'sedimentPass', label: 'Particles / sediment' },
                { key: 'separation', passKey: 'separationPass', label: 'Separation' },
              ].map(({ key, passKey, label }) => (
                <div key={key} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <div className="flex gap-2">
                    {['Pass', 'Fail'].map(o => (
                      <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.visual[passKey] === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                        <input type="radio" className="hidden" onChange={() => updateBatch(`visual.${passKey}`, o)} />{o}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <PassFail label="Overall visual" value={b.visual.overallVisual} onChange={v => updateBatch('visual.overallVisual', v)} />
            <textarea value={b.visual.notes || ''} onChange={e => updateBatch('visual.notes', e.target.value)} placeholder="Visual notes..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
          </div>
        </Card>

        {/* Sensory */}
        <Card title="C — Sensory Check" sub="Blind assessment against lab retain sample.">
          <div className="space-y-3">
            {[
              { key: 'aroma',     label: 'Aroma'           },
              { key: 'sweetness', label: 'Sweetness'        },
              { key: 'acidity',   label: 'Acidity'          },
              { key: 'flavourStr',label: 'Flavour strength' },
              { key: 'aftertaste',label: 'Aftertaste'       },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <p className="text-sm font-medium text-gray-700 w-36 flex-shrink-0">{label}</p>
                <div className="flex gap-2">
                  {MATCH_OPTIONS.map(o => (
                    <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.sensory[key]?.match === o ? (o === 'Match' ? 'bg-green-500 text-white border-green-500' : o === 'Slight deviation' ? 'bg-amber-400 text-white border-amber-400' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500'}`}>
                      <input type="radio" className="hidden" onChange={() => updateBatch(`sensory.${key}.match`, o)} />{o}
                    </label>
                  ))}
                </div>
                <input value={b.sensory[key]?.notes || ''} onChange={e => updateBatch(`sensory.${key}.notes`, e.target.value)} placeholder="Notes..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            ))}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key question</p>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-700">Would the client notice a difference vs the signed-off sample?</p>
                <div className="flex gap-2">
                  {['Yes', 'No', 'Possibly'].map(o => (
                    <label key={o} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${b.sensory.clientWouldNotice === o ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
                      <input type="radio" className="hidden" onChange={() => updateBatch('sensory.clientWouldNotice', o)} />{o}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <PassFail label="Overall sensory" value={b.sensory.overallSensory} onChange={v => updateBatch('sensory.overallSensory', v)} />
          </div>
        </Card>

        {/* Application */}
        <Card title="D — Application Check">
          <div className="space-y-4">
            {/* Milk */}
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Tested in milk</p>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Milk type</Label><input value={b.application.milk?.milkType || ''} onChange={e => updateBatch('application.milk.milkType', e.target.value)} placeholder="e.g. Oat, Gail's" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
                <YesNo label="Colour correct?" value={b.application.milk?.colourCorrect} onChange={v => updateBatch('application.milk.colourCorrect', v)} />
                <YesNo label="Did it split?" value={b.application.milk?.split} onChange={v => updateBatch('application.milk.split', v)} yesIsBad />
                <PassFail label="Result" value={b.application.milk?.pass} onChange={v => updateBatch('application.milk.pass', v)} />
              </div>
            </div>
            {/* Water */}
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Tested in water</p>
              <div className="grid grid-cols-3 gap-3">
                <YesNo label="Colour correct?" value={b.application.water?.colourCorrect} onChange={v => updateBatch('application.water.colourCorrect', v)} />
                <YesNo label="Flavour delivery correct?" value={b.application.water?.flavourOk} onChange={v => updateBatch('application.water.flavourOk', v)} />
                <PassFail label="Result" value={b.application.water?.pass} onChange={v => updateBatch('application.water.pass', v)} />
              </div>
            </div>
            <PassFail label="Overall application" value={b.application.overallApplication} onChange={v => updateBatch('application.overallApplication', v)} />
          </div>
        </Card>

        {/* Process */}
        <Card title="E — Process Check">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <YesNo label="Correct process followed?" value={b.process.correctProcess} onChange={v => updateBatch('process.correctProcess', v)} />
              <YesNo label="Deviations recorded?" value={b.process.deviations} onChange={v => updateBatch('process.deviations', v)} yesIsBad />
            </div>
            {b.process.deviations === 'Yes' && (
              <textarea value={b.process.deviationDetail || ''} onChange={e => updateBatch('process.deviationDetail', e.target.value)} placeholder="Describe deviations..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cook time</Label><input value={b.process.cookTime || ''} onChange={e => updateBatch('process.cookTime', e.target.value)} placeholder="e.g. 45 mins" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
              <div><Label>Fill temperature</Label><input value={b.process.fillTemp || ''} onChange={e => updateBatch('process.fillTemp', e.target.value)} placeholder="°C" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
            </div>
            <PassFail label="Overall process" value={b.process.overallProcess} onChange={v => updateBatch('process.overallProcess', v)} />
          </div>
        </Card>

        {/* Micro */}
        <Card title="F — Micro / Food Safety">
          <div className="grid grid-cols-2 gap-4">
            <YesNo label="Micro sample submitted?" value={b.micro.submitted} onChange={v => updateBatch('micro.submitted', v)} />
            <div><Label>Submitted to</Label><input value={b.micro.submittedTo || ''} onChange={e => updateBatch('micro.submittedTo', e.target.value)} placeholder="e.g. Eurofins" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
            <div><Label>Date submitted</Label><input type="date" value={b.micro.dateSubmitted || ''} onChange={e => updateBatch('micro.dateSubmitted', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
            <div><Label>Results expected by</Label><input type="date" value={b.micro.expectedBy || ''} onChange={e => updateBatch('micro.expectedBy', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
            <div><Label>Results</Label><input value={b.micro.results || ''} onChange={e => updateBatch('micro.results', e.target.value)} placeholder="When received..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" /></div>
            <PassFail label="Micro result" value={b.micro.pass} onChange={v => updateBatch('micro.pass', v)} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-2">
            <p className="text-xs font-semibold text-amber-800">Do not release this batch to the client until micro results are confirmed clean.</p>
          </div>
        </Card>

        {/* Batch decision */}
        <Card title="G — Batch Decision">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Visual',      val: b.visual?.overallVisual      },
              { label: 'Sensory',     val: b.sensory?.overallSensory    },
              { label: 'Application', val: b.application?.overallApplication },
              { label: 'Process',     val: b.process?.overallProcess    },
              { label: 'Micro',       val: b.micro?.pass                },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border px-3 py-2.5 text-center ${s.val === 'Pass' ? 'bg-green-50 border-green-200' : s.val === 'Fail' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-sm font-bold ${s.val === 'Pass' ? 'text-green-700' : s.val === 'Fail' ? 'text-red-700' : 'text-gray-400'}`}>{s.val || '—'}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Label>Decision</Label>
            <div className="flex gap-3 flex-wrap">
              {[
                { val: 'approved',           label: 'Approved',                color: 'bg-green-500' },
                { val: 'approved-with-note', label: 'Approved with note',      color: 'bg-amber-400' },
                { val: 'rejected',           label: 'Rejected — investigate',  color: 'bg-red-500'   },
              ].map(d => (
                <label key={d.val} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition ${b.decision === d.val ? `${d.color} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  <input type="radio" className="hidden" onChange={() => updateBatch('decision', d.val)} />
                  {d.label}
                </label>
              ))}
            </div>
            <textarea value={b.decisionNotes || ''} onChange={e => updateBatch('decisionNotes', e.target.value)} placeholder="Notes / deviation record..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Approved by</Label>
                <select value={b.approvedBy || ''} onChange={e => updateBatch('approvedBy', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">Select...</option>
                  {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Date</Label>
                <input type="date" value={b.approvedAt || ''} onChange={e => updateBatch('approvedAt', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
          </div>
        </Card>

        {/* Validation summary */}
        {batches.filter(bat => bat.decision).length === 3 && (
          <Card title="H — Validation Summary">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {['Batch', 'Visual', 'Sensory', 'Application', 'Process', 'Decision'].map(h => (
                    <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((bat, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2.5 pr-4 font-semibold text-gray-800">Batch {i + 1}</td>
                    {[bat.visual?.overallVisual, bat.sensory?.overallSensory, bat.application?.overallApplication, bat.process?.overallProcess].map((v, j) => (
                      <td key={j} className="py-2.5 pr-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v === 'Pass' ? 'bg-green-50 text-green-700' : v === 'Fail' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>{v || '—'}</span>
                      </td>
                    ))}
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bat.decision === 'approved' || bat.decision === 'approved-with-note' ? 'bg-green-50 text-green-700' : bat.decision === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>
                        {bat.decision === 'approved' ? 'Approved' : bat.decision === 'approved-with-note' ? 'Approved ⚠' : bat.decision === 'rejected' ? 'Rejected' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
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
function PassFail({ label, value, onChange }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        {['Pass', 'Fail'].map(o => (
          <label key={o} className={`px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition ${value === o ? (o === 'Pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
            <input type="radio" className="hidden" onChange={() => onChange(o)} />{o}
          </label>
        ))}
      </div>
    </div>
  )
}
function YesNo({ label, value, onChange, yesIsBad = false }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        {['Yes', 'No'].map(o => {
          const isActive = value === o
          const isGood = yesIsBad ? o === 'No' : o === 'Yes'
          return (
            <label key={o} className={`px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition ${isActive ? (isGood ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              <input type="radio" className="hidden" onChange={() => onChange(o)} />{o}
            </label>
          )
        })}
      </div>
    </div>
  )
}
function Loader() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>
}