import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  doc, getDoc, collection, query, where, orderBy,
  getDocs, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

const BRIEF_SECTIONS = [
  { title: 'Overview',     fields: [{ key: 'productName', label: 'Product name' }, { key: 'productType', label: 'Product type' }, { key: 'productPurpose', label: 'Purpose' }, { key: 'inspiration', label: 'Inspiration' }, { key: 'launchDate', label: 'Launch date' }] },
  { title: 'Flavour',      fields: [{ key: 'primaryFlavour', label: 'Primary flavour' }, { key: 'secondaryFlavour', label: 'Secondary notes' }, { key: 'flavourExclusions', label: 'Exclusions' }, { key: 'sweetness', label: 'Sweetness' }, { key: 'aftertaste', label: 'Finish' }, { key: 'flavourNotes', label: 'Flavour notes' }] },
  { title: 'Appearance',   fields: [{ key: 'colourImportance', label: 'Colour importance' }, { key: 'colourDescription', label: 'Colour' }, { key: 'colourInDrink', label: 'Colour in drink' }, { key: 'clarity', label: 'Clarity' }, { key: 'colourReference', label: 'Colour reference' }] },
  { title: 'Usage',        fields: [{ key: 'uses', label: 'Used in' }, { key: 'doseRate', label: 'Dose rate' }, { key: 'goesInMilk', label: 'Goes in milk' }, { key: 'milkType', label: 'Milk type' }, { key: 'texture', label: 'Texture' }, { key: 'performanceNotes', label: 'Performance notes' }] },
  { title: 'Ingredients',  fields: [{ key: 'dietary', label: 'Dietary' }, { key: 'sugarBase', label: 'Sugar base' }, { key: 'preservatives', label: 'Preservatives' }, { key: 'ingredientRestrictions', label: 'Restrictions' }, { key: 'allergens', label: 'Allergens' }] },
  { title: 'Practical',    fields: [{ key: 'packaging', label: 'Packaging' }, { key: 'pumpCompatible', label: 'Pump compatible' }, { key: 'storage', label: 'Storage' }, { key: 'shelfLife', label: 'Shelf life' }, { key: 'certifications', label: 'Certifications' }, { key: 'markets', label: 'Markets' }] },
  { title: 'Commercial',   fields: [{ key: 'targetCost', label: 'Target cost' }, { key: 'expectedVolume', label: 'Volume' }, { key: 'samplesBy', label: 'Samples by' }, { key: 'sampleAddress', label: 'Sample address' }, { key: 'contactName', label: 'Contact' }, { key: 'contactEmail', label: 'Email' }, { key: 'contactPhone', label: 'Phone' }, { key: 'anythingElse', label: 'Other notes' }] },
]

const PIPELINE = [
  { key: 'brief',          label: 'Client Brief',           icon: '📋', who: 'Client',      route: null },
  { key: 'scoping',        label: 'Ingredients & Sourcing', icon: '🧺', who: 'Dima',        route: (id) => `/scoping/${id}` },
  { key: 'lab',            label: 'Lab Development',        icon: '🧪', who: 'Dima',        route: (p) => `/lab/${p.briefId}` },
  { key: 'sampleSending',  label: 'Sample Sending',         icon: '📦', who: 'Aurelien',    route: (id) => `/samplesending/${id}` },
  { key: 'clientSignOff',  label: 'Client Sign-off',        icon: '✍️', who: 'Client',      route: (id) => `/clientsignoff/${id}` },
  { key: 'validation',     label: 'Test Batch',             icon: '🏭', who: 'Production',  route: (id) => `/validation/${id}` },
  { key: 'batchDecision',  label: 'Batch Decision',         icon: '✅', who: 'Aurelien',    route: (id) => `/batchdecision/${id}` },
  { key: 'labTesting',     label: 'Lab Testing',            icon: '🔬', who: 'Lab',         route: (id) => `/labtest/${id}` },
  { key: 'labelling',      label: 'Labelling',              icon: '🏷️', who: 'Aurelien',    route: (id) => `/labelling/${id}` },
  { key: 'release',        label: 'Business as Usual',      icon: '✅', who: null,          route: (id) => `/release/${id}` },
]

const STATUS = {
  'complete':    { dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700 border-green-200',  text: 'Complete'    },
  'in-progress': { dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200',  text: 'In progress' },
  'not-started': { dot: 'bg-gray-200',   badge: 'bg-gray-50 text-gray-400 border-gray-200',     text: 'Not started' },
  'failed':      { dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-200',         text: 'Failed'      },
}

function stageStatus(product, key) {
  return product?.stages?.[key]?.status || 'not-started'
}

export default function ProductPage() {
  const router  = useRouter()
  const { id }  = router.query

  const [product,       setProduct]       = useState(null)
  const [brief,         setBrief]         = useState(null)
  const [labSheets,     setLabSheets]     = useState([])
  const [lastVisit,     setLastVisit]     = useState(null)
  const [activeTab,     setActiveTab]     = useState('pipeline')
  const [loading,       setLoading]       = useState(true)
  const [copied,        setCopied]        = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [approvalModal, setApprovalModal] = useState(false)
  const [approveVersion,setApproveVersion]= useState('')

  useEffect(() => { if (id) fetchAll() }, [id])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', id))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }

      if (p.briefId) {
        const [bSnap, lSnap, vSnap] = await Promise.all([
          getDoc(doc(db, 'briefs', p.briefId)),
          getDocs(query(collection(db, 'labSheets'), where('briefId', '==', p.briefId), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'briefs', p.briefId, 'visits'), orderBy('visitedAt', 'desc'))),
        ])
        const b = bSnap.exists() ? { id: bSnap.id, ...bSnap.data() } : null
        setBrief(b)
        setLabSheets(lSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        if (!vSnap.empty) setLastVisit(vSnap.docs[0].data().visitedAt)

        // Auto-heal: if brief is submitted but stages.brief isn't marked complete yet, fix it
        if (b?.submitted && p.stages?.brief?.status !== 'complete') {
          const heal = {
            'stages.brief.status':      'complete',
            'stages.brief.completedAt': b.submittedAt || new Date().toISOString(),
            'stages.brief.completedBy': b.submittedBy || b.formData?.contactName || '',
            'stages.scoping.status':
              (!p.stages?.scoping?.status || p.stages?.scoping?.status === 'not-started')
                ? 'in-progress'
                : p.stages.scoping.status,
          }
          await updateDoc(doc(db, 'products', id), heal)
          p.stages = { ...p.stages, ...Object.fromEntries(
            Object.entries(heal).map(([k, v]) => [k.replace('stages.', ''), v])
          ) }
          // Rebuild stages properly
          p.stages = {
            ...p.stages,
            brief:   { ...p.stages?.brief,   status: 'complete', completedAt: heal['stages.brief.completedAt'], completedBy: heal['stages.brief.completedBy'] },
            scoping: { ...p.stages?.scoping, status: heal['stages.scoping.status'] },
          }
        }
      }

      setProduct(p)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const copyBriefLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/brief/${product.briefId}`)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const createLabSheet = async () => {
    if (!product?.briefId) return
    setCreating(true)
    try {
      await addDoc(collection(db, 'labSheets'), {
        briefId: product.briefId, productName: product.productName,
        clientName: product.clientName, versionNumber: 1,
        versionNote: 'Initial version', status: 'draft',
        createdAt: new Date().toISOString(), data: {},
      })
      await updateDoc(doc(db, 'products', id), { 'stages.lab.status': 'in-progress' })
      router.push(`/lab/${product.briefId}`)
    } catch (e) { console.error(e); setCreating(false) }
  }

  const approveLabVersion = async () => {
    if (!approveVersion) return
    await updateDoc(doc(db, 'products', id), {
      'stages.clientApproval.status':          'complete',
      'stages.clientApproval.approvedVersion': approveVersion,
      'stages.lab.status':                     'complete',
      'stages.validation.status':              'in-progress',
    })
    setApprovalModal(false)
    fetchAll()
  }

  const deleteProduct = async () => {
    try {
      await deleteDoc(doc(db, 'products', id))
      if (product.briefId) await deleteDoc(doc(db, 'briefs', product.briefId))
      router.push('/')
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>
  if (!product) return null

  const fd = brief?.formData || {}
  const approvedVersion = product?.stages?.clientApproval?.approvedVersion
  const signedOff = labSheets.find(s => s.status === 'signed-off')

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>{product.productName} — Bloomin NPD</title></Head>

      {/* Header */}
      <div className="bg-black text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push('/')} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
              <div className="w-px h-5 bg-white/20 flex-shrink-0" />
              <div className="flex items-center gap-3 min-w-0">
                {brief?.clientLogoUrl && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                    <img src={brief.clientLogoUrl} alt={product.clientName} className="w-full h-full object-contain" onError={e => e.target.style.display='none'} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-white text-base sm:text-lg leading-tight truncate">{product.productName}</p>
                  <p className="text-xs text-white/50 mt-0.5 truncate">{product.clientName}{product.owner ? ` · ${product.owner}` : ''}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {product.owner && (
                <span className="px-3 py-1.5 border border-white/20 text-white/60 text-xs rounded-lg hidden sm:block">
                  {product.owner}
                </span>
              )}
              <button onClick={copyBriefLink} className="px-3 sm:px-4 py-2 border border-white/20 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-white/10 transition hidden sm:block">
                {copied ? '✓ Copied' : 'Copy brief link'}
              </button>
              <button onClick={() => setDeleteConfirm(true)} className="px-3 sm:px-4 py-2 border border-red-500/30 text-red-400 text-xs sm:text-sm font-medium rounded-lg hover:bg-red-500/10 transition">Delete</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {[
              { key: 'pipeline',  label: 'Pipeline'      },
              { key: 'brief',     label: 'Client Brief'  },
              { key: 'resources', label: '📄 Resources'  },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${activeTab === t.key ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Pipeline tab ── */}
        {activeTab === 'pipeline' && (
          <div className="space-y-3">
            {PIPELINE.map((stage, i) => {
              const status = stageStatus(product, stage.key)
              const style  = STATUS[status] || STATUS['not-started']
              const stages = product.stages || {}

              // Compute subtitle
              let sub = ''
              if (stage.key === 'brief') {
                if (status === 'complete') {
                  const completedAt = stages.brief?.completedAt
                  const completedBy = stages.brief?.completedBy
                  const dateStr = completedAt
                    ? new Date(completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      + ' at '
                      + new Date(completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : ''
                  sub = `Completed${dateStr ? ` ${dateStr}` : ''}${completedBy ? ` · by ${completedBy}` : ''}`
                } else if (lastVisit) {
                  sub = `Last opened by client: ${lastVisit}`
                }
              }
              if (stage.key === 'scoping') {
                const p = stages.scoping?.phase
                const expectedDate = stages.scoping?.expectedDelivery
                const deliveredAt  = stages.scoping?.deliveredAt
                if (p === 'draft' || (status === 'in-progress' && !p)) sub = 'Dima listing ingredients'
                if (p === 'ordering') {
                  sub = expectedDate
                    ? `Awaiting delivery · expected ${new Date(expectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                    : 'Awaiting delivery'
                }
                if (p === 'delivered' || status === 'complete') {
                  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  sub = deliveredAt
                    ? `All delivered · ${fmt(deliveredAt)}`
                    : expectedDate
                      ? `All delivered · ${fmt(expectedDate)}`
                      : 'All delivered ✓'
                }
              }
              if (stage.key === 'lab') {
                const latest = labSheets[0]
                if (latest) sub = `${labSheets.length} version${labSheets.length !== 1 ? 's' : ''}${signedOff ? ` · V${signedOff.versionNumber} signed off` : ''}`
              }
              if (stage.key === 'sampleSending') {
                const s = stages.sampleSending
                if (s?.sentAt) sub = `Sent ${new Date(s.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${s.sentBy || ''}`
                if (s?.expectedArrival) sub += ` · arrives ${new Date(s.expectedArrival).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
              }
              if (stage.key === 'clientSignOff') {
                const cso = stages.clientSignOff
                if (status === 'in-progress') sub = 'Waiting for client to sign off'
                if (status === 'complete') {
                  const d = cso?.signedOffDate ? new Date(cso.signedOffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
                  sub = [
                    cso?.signedOffVersion ? `V${cso.signedOffVersion}` : '',
                    cso?.signedOffBy || '',
                    d,
                    cso?.initialOrderVolume ? `${cso.initialOrderVolume} ${cso.initialOrderUnit || 'bottles'}` : '',
                  ].filter(Boolean).join(' · ')
                }
              }
              if (stage.key === 'validation') {
                const done = stages.validation?.batchesCompleted || 0
                if (done > 0) sub = `${done}/3 batches complete`
              }
              if (stage.key === 'batchDecision') {
                const bd = stages.batchDecision
                if (status === 'complete') sub = bd?.decision === 'approved' ? `Approved · ${bd?.approvedBy || ''}` : bd?.decision === 'approved-with-note' ? `Approved with note · ${bd?.approvedBy || ''}` : 'Rejected'
                if (status === 'in-progress') sub = 'Ready for internal batch decision'
              }
              if (stage.key === 'labelling') {
                const l = stages.labelling
                if (status === 'complete') sub = `Complete · ${l?.designedBy || ''} label${l?.labelVersion ? ` · v${l.labelVersion}` : ''}`
                if (status === 'in-progress') sub = `Allergens, nutrition, claims & design${stages.labelling?.labelVersion ? ` · v${stages.labelling.labelVersion} saved` : ''}`
              }
              if (stage.key === 'labTesting') {
                const date = stages.labTesting?.expectedResultsDate
                if (date) sub = `Results expected: ${new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
              }

              // Action button
              let action = null
              if (stage.key === 'brief') {
                if (!brief?.submitted) {
                  action = <button onClick={copyBriefLink} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition">{copied ? '✓ Copied' : 'Copy link'}</button>
                } else {
                  action = <button onClick={() => setActiveTab('brief')} className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition">View brief →</button>
                }
              } else if (stage.key === 'lab') {
                if (labSheets.length === 0) {
                  action = <button onClick={createLabSheet} disabled={creating} className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition disabled:opacity-40">{creating ? 'Creating...' : '+ Create lab sheet'}</button>
                } else {
                  action = <button onClick={() => router.push(`/lab/${product.briefId}`)} className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition">Open →</button>
                }
              } else if (stage.route) {
                const href = stage.route(stage.key === 'lab' ? product : id)
                action = <button onClick={() => router.push(href)} className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition">Open →</button>
              }

              return (
                <div key={stage.key} className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-gray-300">{i + 1}</span>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${status === 'complete' ? 'bg-green-50' : status === 'in-progress' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                        {stage.icon}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{stage.label}</p>
                        {stage.who && <span className="text-xs text-gray-400">— {stage.who}</span>}
                      </div>
                      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:ml-auto pl-12 sm:pl-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${style.badge}`}>{style.text}</span>
                    {action}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Brief tab ── */}
        {activeTab === 'brief' && (
          <div>
            {!brief?.submitted ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-4">
                <p className="text-4xl">📬</p>
                <h2 className="text-lg font-bold text-gray-800">Brief not yet submitted</h2>
                <p className="text-sm text-gray-400">The client hasn't completed the brief form yet.</p>
                <button onClick={copyBriefLink} className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition">
                  {copied ? '✓ Copied' : 'Copy brief link'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {BRIEF_SECTIONS.map(section => {
                  const filled = section.fields.filter(f => {
                    const v = fd[f.key]
                    return v && v !== '' && !(Array.isArray(v) && v.length === 0)
                  })
                  if (!filled.length) return null
                  return (
                    <div key={section.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{section.title}</h3>
                      </div>
                      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filled.map(f => (
                          <div key={f.key} className={['sampleAddress','anythingElse','flavourNotes','performanceNotes','productPurpose','inspiration'].includes(f.key) ? 'md:col-span-2' : ''}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</p>
                            <p className="text-sm text-gray-900 leading-relaxed">{Array.isArray(fd[f.key]) ? fd[f.key].join(', ') : fd[f.key]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {/* ── Resources tab ── */}
        {activeTab === 'resources' && (
          <ResourcesTab product={product} brief={brief} labSheets={labSheets} productId={id} router={router} />
        )}
      </div>
      {approvalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Mark client approval</h2>
              <p className="text-sm text-gray-400 mt-1">Which lab sheet version did the client approve?</p>
            </div>
            <div className="space-y-2">
              {labSheets.filter(s => s.status === 'signed-off').map(sheet => (
                <label key={sheet.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${approveVersion === String(sheet.versionNumber) ? 'bg-black text-white border-black' : 'border-gray-200 hover:border-gray-400'}`}>
                  <input type="radio" className="hidden" onChange={() => setApproveVersion(String(sheet.versionNumber))} />
                  <div>
                    <p className="text-sm font-semibold">V{sheet.versionNumber}</p>
                    <p className={`text-xs mt-0.5 ${approveVersion === String(sheet.versionNumber) ? 'text-white/60' : 'text-gray-400'}`}>{sheet.versionNote}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApprovalModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={approveLabVersion} disabled={!approveVersion} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40">Confirm approval</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-4 text-center">
            <p className="text-2xl">🗑️</p>
            <h2 className="text-lg font-bold text-gray-900">Delete "{product.productName}"?</h2>
            <p className="text-sm text-gray-400">This will also delete the client brief. Can't be undone.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={deleteProduct} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Resources Tab ────────────────────────────────────────────────────────────
function ResourcesTab({ product, brief, labSheets, productId, router }) {
  const s   = product?.stages || {}
  const fd  = brief?.formData  || {}
  const signedSheet = labSheets.find(l => l.status === 'signed-off') || labSheets[0]

  const resources = [
    {
      key:        'brief',
      title:      'Client Brief',
      icon:       '📋',
      desc:       'Full brief submitted by the client — product type, flavour, usage, packaging, contacts.',
      available:  !!brief?.submitted,
      status:     brief?.submitted ? 'complete' : 'pending',
      statusLabel:brief?.submitted ? `Submitted by ${brief.submittedBy || 'client'}` : 'Awaiting client submission',
      href:       `/print/brief/${productId}`,
    },
    {
      key:        'scoping',
      title:      'Ingredient Order Sheet',
      icon:       '🧺',
      desc:       'Full ingredient list with quantities, approved suppliers, order codes and delivery dates.',
      available:  s.scoping?.status === 'complete' || s.scoping?.status === 'in-progress',
      status:     s.scoping?.status === 'complete' ? 'complete' : 'in-progress',
      statusLabel:s.scoping?.phase === 'delivered' ? 'All delivered' : s.scoping?.phase === 'ordering' ? 'Ordering in progress' : 'In progress',
      href:       `/print/scoping/${productId}`,
    },
    {
      key:        'lab',
      title:      'Lab Development Sheet',
      icon:       '🧪',
      desc:       `Recipe, process, analytical specs, sensory profile and production notes${signedSheet ? ` — V${signedSheet.versionNumber} ${signedSheet.versionName}` : ''}.`,
      available:  labSheets.length > 0,
      status:     s.lab?.status === 'complete' ? 'complete' : labSheets.length > 0 ? 'in-progress' : 'pending',
      statusLabel:signedSheet ? `V${signedSheet.versionNumber} signed off` : labSheets.length > 0 ? `${labSheets.length} version${labSheets.length !== 1 ? 's' : ''} in progress` : 'Not started',
      href:       `/print/lab/${productId}`,
    },
    {
      key:        'sampleSending',
      title:      'Sample Sending Record',
      icon:       '📦',
      desc:       'Shipment log — who sent, recipient, packages, tracking numbers and expected arrival.',
      available:  s.sampleSending?.status === 'complete',
      status:     s.sampleSending?.status || 'pending',
      statusLabel:s.sampleSending?.sentAt ? `Sent ${new Date(s.sampleSending.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Not sent yet',
      href:       `/print/samplesending/${productId}`,
    },
    {
      key:        'clientSignOff',
      title:      'Client Sign-off Record',
      icon:       '✍️',
      desc:       'Sign-off version, who approved, date, client feedback and initial order details.',
      available:  s.clientSignOff?.status === 'complete',
      status:     s.clientSignOff?.status || 'pending',
      statusLabel:s.clientSignOff?.signedOffBy ? `Signed off by ${s.clientSignOff.signedOffBy}` : 'Awaiting sign-off',
      href:       `/print/clientsignoff/${productId}`,
    },
    {
      key:        'validation',
      title:      'Test Batch Report',
      icon:       '🏭',
      desc:       'Full QA report for each production batch — visual, analytical, sensory and application checks with photos.',
      available:  s.validation?.status === 'complete' || s.validation?.batchesCompleted > 0,
      status:     s.validation?.status || 'pending',
      statusLabel:s.validation?.batchesCompleted > 0 ? `${s.validation.batchesCompleted} batch${s.validation.batchesCompleted !== 1 ? 'es' : ''} checked` : 'Not started',
      href:       `/print/validation/${productId}`,
    },
    {
      key:        'labTesting',
      title:      'Lab Testing Submission',
      icon:       '🔬',
      desc:       'External lab submission record — tests requested, lab details, expected results date.',
      available:  s.labTesting?.status === 'in-progress' || s.labTesting?.status === 'complete',
      status:     s.labTesting?.status || 'pending',
      statusLabel:s.labTesting?.status === 'complete' ? 'Results received' : s.labTesting?.status === 'in-progress' ? 'Awaiting results' : 'Not submitted',
      href:       `/print/labtesting/${productId}`,
    },
    {
      key:        'labelling',
      title:      'Allergen & Nutritional Declaration',
      icon:       '🏷️',
      desc:       'Full allergen table (14 EU allergens), nutritional panel, product claims and substantiation.',
      available:  s.labelling?.status === 'complete' || s.labelling?.status === 'in-progress',
      status:     s.labelling?.status || 'pending',
      statusLabel:s.labelling?.status === 'complete' ? `Label v${s.labelling?.labelVersion || 1} · Complete` : s.labelling?.labelVersion ? `Draft v${s.labelling.labelVersion}` : 'Not started',
      href:       `/print/labelling/${productId}`,
    },
    {
      key:        'release',
      title:      'Full Product Spec Sheet',
      icon:       '📊',
      desc:       'Complete product record — commercial summary, BOM, recipe, allergens, nutritional info, claims and contacts.',
      available:  true,
      status:     s.release?.status === 'complete' ? 'complete' : 'in-progress',
      statusLabel:s.release?.status === 'complete' ? 'Released' : 'In progress',
      href:       `/release/${productId}`,
    },
  ]

  const available = resources.filter(r => r.available)
  const pending   = resources.filter(r => !r.available)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <h2 className="text-sm font-bold text-gray-900">Documents & Exports</h2>
        <p className="text-xs text-gray-400 mt-0.5">All documents generated from this product's data. Open any to view and print as PDF.</p>
      </div>

      {/* Available */}
      <div className="space-y-2">
        {available.map(r => (
          <div key={r.key} className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:border-gray-300 transition">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <span className="text-2xl flex-shrink-0">{r.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'complete' ? 'bg-green-50 text-green-700' :
                    r.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-50 text-gray-400'
                  }`}>{r.statusLabel}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{r.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => window.open(r.href, '_blank')}
                className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-gray-900 transition"
              >
                View & export →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Not yet available */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Not yet available</p>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.key} className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 opacity-60">
                <span className="text-2xl flex-shrink-0 grayscale">{r.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-500">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.statusLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}