import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  doc, getDoc, collection, query, where, orderBy,
  getDocs, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

const SYRUP_BRIEF_SECTIONS = [
  { title: 'Overview',     fields: [{ key: 'productName', label: 'Product name' }, { key: 'productType', label: 'Product type' }, { key: 'productPurpose', label: 'Purpose' }, { key: 'inspiration', label: 'Inspiration' }, { key: 'samplesNeededBy', label: 'Sample date' }, { key: 'distributorDate', label: 'Distributor date' }, { key: 'launchDate', label: 'Launch date' }] },
  { title: 'Flavour',      fields: [{ key: 'primaryFlavour', label: 'Primary flavour' }, { key: 'secondaryFlavour', label: 'Secondary notes' }, { key: 'flavourExclusions', label: 'Exclusions' }, { key: 'sweetness', label: 'Sweetness' }, { key: 'aftertaste', label: 'Finish' }] },
  { title: 'Appearance',   fields: [{ key: 'endDrinkType', label: 'End drink' }, { key: 'syrupColour', label: 'Syrup colour' }, { key: 'endDrinkColour', label: 'End drink colour' }, { key: 'clarity', label: 'Clarity' }, { key: 'colourReference', label: 'References' }] },
  { title: 'Usage',        fields: [{ key: 'uses', label: 'Used in' }, { key: 'milkTypes', label: 'Milk types' }, { key: 'servingSizeRatio', label: 'Serving ratio' }, { key: 'doseRate', label: 'Dose rate' }, { key: 'hasFlavouringReq', label: 'Flavouring req?' }, { key: 'flavouringTypes', label: 'Flavouring types' }] },
  { title: 'Ingredients',  fields: [{ key: 'dietary', label: 'Dietary' }, { key: 'sugarBase', label: 'Sugar base' }, { key: 'preservatives', label: 'Preservatives' }, { key: 'ingredientRestrictions', label: 'Restrictions' }, { key: 'allergens', label: 'Allergens' }, { key: 'productClaims', label: 'Product claims' }, { key: 'nutritionalClaims', label: 'Nutritional claims' }, { key: 'healthClaims', label: 'Health claims' }, { key: 'certRequired', label: 'Certifications?' }, { key: 'certDetails', label: 'Cert details' }] },
  { title: 'Packaging',    fields: [{ key: 'standardBottleOk', label: 'Standard 750ml?' }, { key: 'bottleAlternative', label: 'Alternative format' }, { key: 'pumpCompatible', label: 'Pump compatible' }, { key: 'storage', label: 'Storage' }, { key: 'shelfLifeUnopened', label: 'Shelf life (unopened)' }, { key: 'shelfLifeOpen', label: 'Shelf life (open)' }, { key: 'markets', label: 'Markets' }] },
  { title: 'Commercial',   fields: [{ key: 'targetCostMin', label: 'Target cost min' }, { key: 'targetCostMax', label: 'Target cost max' }, { key: 'casesPerMonth', label: 'Cases / month' }, { key: 'sampleName', label: 'Sample recipient' }, { key: 'sampleStreet', label: 'Address' }, { key: 'anythingElse', label: 'Other notes' }] },
]

const DRINK_BRIEF_SECTIONS = [
  { title: 'Product',    fields: [{ key: 'productName', label: 'Product name' }, { key: 'productType', label: 'Type' }, { key: 'productPurpose', label: 'Why' }, { key: 'inspiration', label: 'Inspiration' }, { key: 'samplesNeededBy', label: 'Sample date' }, { key: 'launchDate', label: 'Launch date' }] },
  { title: 'Formula',    fields: [{ key: 'flavourDirection', label: 'Flavour direction' }, { key: 'proteinTarget', label: 'Protein target (g)' }, { key: 'proteinBlend', label: 'Protein blend' }, { key: 'electrolytes', label: 'Electrolytes' }, { key: 'electrolytesDetail', label: 'Electrolyte detail' }, { key: 'sweetener', label: 'Sweetener' }, { key: 'carbonation', label: 'Carbonation' }, { key: 'formulaRestrictions', label: 'Restrictions' }] },
  { title: 'Appearance', fields: [{ key: 'colourDirection', label: 'Colour direction' }, { key: 'clarity', label: 'Clarity' }, { key: 'visualReference', label: 'Visual references' }, { key: 'packagingAppearanceNotes', label: 'Packaging notes' }] },
  { title: 'Format',     fields: [{ key: 'format', label: 'Format' }, { key: 'occasions', label: 'Occasions' }, { key: 'channels', label: 'Channels' }, { key: 'shelfLife', label: 'Shelf life' }, { key: 'storage', label: 'Storage' }] },
  { title: 'Markets',    fields: [{ key: 'markets', label: 'Markets' }, { key: 'functionalClaims', label: 'Functional claims' }, { key: 'labelClaims', label: 'Label claims' }, { key: 'certifications', label: 'Certifications' }, { key: 'allergenNotes', label: 'Allergen notes' }] },
  { title: 'Commercial', fields: [{ key: 'targetCostMin', label: 'Target cost min' }, { key: 'targetCostMax', label: 'Target cost max' }, { key: 'targetRrp', label: 'Target RRP' }, { key: 'initialVolume', label: 'Initial volume' }, { key: 'anythingElse', label: 'Other notes' }] },
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
  const [calPanel,      setCalPanel]      = useState(false)

  useEffect(() => { if (id) fetchAll() }, [id])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', id))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }

      if (p.briefId) {
        const [bSnap, lSnap, vSnap, sSnap] = await Promise.all([
          getDoc(doc(db, 'briefs', p.briefId)),
          getDocs(query(collection(db, 'labSheets'), where('briefId', '==', p.briefId), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'briefs', p.briefId, 'visits'), orderBy('visitedAt', 'desc'))),
          getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', id))),
        ])
        const b = bSnap.exists() ? { id: bSnap.id, ...bSnap.data() } : null
        setBrief(b)
        setLabSheets(lSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        if (!vSnap.empty) setLastVisit(vSnap.docs[0].data().visitedAt)

        // Pull expected delivery from scopingSheet ingredients and sync to product stages
        if (!sSnap.empty) {
          const scopingData = sSnap.docs[0].data()
          const ingredients = scopingData.ingredients || []

          const latestDate = ingredients
            .filter(r => r.expectedDelivery)
            .sort((a, b) => new Date(b.expectedDelivery) - new Date(a.expectedDelivery))[0]?.expectedDelivery
          if (latestDate && latestDate !== p.stages?.scoping?.expectedDelivery) {
            updateDoc(doc(db, 'products', id), { 'stages.scoping.expectedDelivery': latestDate }).catch(console.error)
            p.stages = { ...p.stages, scoping: { ...p.stages?.scoping, expectedDelivery: latestDate } }
          }

          // Calculate estimated COG from ingredient costs
          const fd = b?.formData || {}
          const bottleVolumeMl = (() => {
            if (p.productType === 'drink') {
              const m = (fd.format || '').match(/(\d+)\s*ml/i)
              return m ? parseInt(m[1]) : 330
            }
            if (fd.standardBottleOk === 'No — I need something different' && fd.bottleAlternative) {
              const m = fd.bottleAlternative.match(/(\d+)\s*ml/i)
              if (m) return parseInt(m[1])
            }
            return 750
          })()
          const costedRows = ingredients.filter(r => r.name?.trim() && r.costPerUnit && r.quantity)
          if (costedRows.length > 0) {
            const totalBatchCost = costedRows.reduce((sum, r) => sum + ((parseFloat(r.costPerUnit) || 0) * (parseFloat(r.quantity) || 0)), 0)
            const batchVolumeMl = ingredients.reduce((sum, r) => {
              const qty = parseFloat(r.quantity) || 0
              return sum + (r.unit === 'L' ? qty * 1000 : qty)
            }, 0)
            const bottlesPerBatch = batchVolumeMl > 0 ? Math.floor(batchVolumeMl / bottleVolumeMl) : 0
            const cogPerBottle = bottlesPerBatch > 0 ? totalBatchCost / bottlesPerBatch : 0
            p._cog = { totalBatchCost, bottlesPerBatch, cogPerBottle, bottleVolumeMl, costedCount: costedRows.length, totalCount: ingredients.filter(r => r.name?.trim()).length }
          }
        }

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
                  <p className="text-xs text-white/50 mt-0.5 truncate">
                    {product.clientName}{product.owner ? ` · ${product.owner}` : ''}
                    {product.code ? <span className="font-mono ml-1 text-white/40">#{product.code}</span> : ''}
                  </p>
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
              <button onClick={() => setCalPanel(true)} title="View dates"
                className="w-8 h-8 flex items-center justify-center border border-white/20 text-white rounded-lg hover:bg-white/10 transition text-sm">
                📅
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
            {/* COG KPI banner */}
            {product._cog && (() => {
              const { cogPerBottle, totalBatchCost, bottlesPerBatch, bottleVolumeMl, costedCount, totalCount } = product._cog
              const targetMax = parseFloat(brief?.formData?.targetCostMax || 0)
              const onTarget  = targetMax > 0 ? cogPerBottle <= targetMax : null
              const partial   = costedCount < totalCount
              return (
                <div className={`rounded-2xl border px-5 py-4 flex flex-wrap items-center gap-6 ${onTarget === false ? 'bg-red-50 border-red-200' : onTarget ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Est. COG / bottle</p>
                    <p className={`text-2xl font-bold mt-0.5 ${onTarget === false ? 'text-red-600' : onTarget ? 'text-green-700' : 'text-gray-900'}`}>
                      £{cogPerBottle.toFixed(2)}
                      <span className="text-sm font-normal text-gray-400 ml-1">{bottleVolumeMl}ml</span>
                    </p>
                    {targetMax > 0 && (
                      <p className={`text-xs mt-0.5 font-medium ${onTarget === false ? 'text-red-500' : 'text-green-600'}`}>
                        {onTarget ? `✓ Under £${targetMax.toFixed(2)} target` : `⚠ Over £${targetMax.toFixed(2)} target`}
                      </p>
                    )}
                  </div>
                  <div className="w-px h-8 bg-gray-200 hidden sm:block" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Batch cost</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">£{totalBatchCost.toFixed(2)}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200 hidden sm:block" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bottles / batch</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{bottlesPerBatch}</p>
                  </div>
                  {partial && (
                    <p className="text-xs text-amber-600 ml-auto">⚠ {costedCount}/{totalCount} ingredients costed — partial estimate</p>
                  )}
                </div>
              )
            })()}

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
                if (p === 'delivered-tracking') {
                  if (expectedDate) {
                    const d = new Date(expectedDate)
                    const diff = Math.ceil((d - Date.now()) / 86400000)
                    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                    const countdown = diff < 0 ? ` · ${Math.abs(diff)}d overdue` : diff === 0 ? ' · today' : ` · in ${diff}d`
                    sub = `Expected delivery: ${dateStr}${countdown}`
                  } else {
                    sub = 'Ingredients ordered · tracking delivery'
                  }
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
                if (status === 'not-started') sub = 'Waiting on development'
                else if (latest) sub = `${labSheets.length} version${labSheets.length !== 1 ? 's' : ''}${signedOff ? ` · V${signedOff.versionNumber} signed off` : ' · in progress'}`
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
                {(product?.productType === 'drink' ? DRINK_BRIEF_SECTIONS : SYRUP_BRIEF_SECTIONS).map(section => {
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

      {/* Calendar dates panel */}
      {calPanel && (() => {
        const fd = brief?.formData || {}
        const s  = product.stages || {}
        const rows = [
          { label: 'Sample needed',          date: fd.samplesNeededBy || fd.samplesBy,           type: 'sample'     },
          { label: 'Launch date',            date: fd.launchDate,                                 type: 'launch'     },
          { label: 'Distributor date',       date: fd.distributorDate,                            type: 'distributor'},
          { label: 'Ingredients due',        date: s.scoping?.expectedDelivery,                   type: 'ingredients'},
          { label: 'Sample sent',            date: s.sampleSending?.sentAt,                       type: 'sampleSent' },
          { label: 'Sample arrives',         date: s.sampleSending?.expectedArrival,              type: 'arrives'    },
          { label: 'Client sign-off',        date: s.clientSignOff?.signedOffDate,                type: 'signoff'    },
          { label: 'First order delivery',   date: s.clientSignOff?.targetDeliveryDate,           type: 'delivery'   },
          { label: 'Production booked',      date: s.batchDecision?.productionDateBooked,         type: 'production' },
          { label: 'Lab results due',        date: s.labTesting?.expectedResultsDate,             type: 'lab'        },
        ].filter(r => r.date)
        const today = new Date()
        const colors = {
          sample: '#3b82f6', launch: '#16a34a', distributor: '#d97706', ingredients: '#059669',
          sampleSent: '#0ea5e9', arrives: '#7c3aed', signoff: '#db2777', delivery: '#0891b2',
          production: '#ea580c', lab: '#dc2626',
        }
        const bgs = {
          sample: '#eff6ff', launch: '#f0fdf4', distributor: '#fffbeb', ingredients: '#ecfdf5',
          sampleSent: '#f0f9ff', arrives: '#f5f3ff', signoff: '#fdf2f8', delivery: '#ecfeff',
          production: '#fff7ed', lab: '#fef2f2',
        }
        return (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCalPanel(false)}>
            <div className="w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Key dates</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{product.productName}</p>
                </div>
                <button onClick={() => setCalPanel(false)} className="text-gray-400 hover:text-black transition text-xl leading-none">×</button>
              </div>

              {rows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
                  <p className="text-3xl">📅</p>
                  <p className="font-semibold text-gray-700">No dates set yet</p>
                  <p className="text-sm text-gray-400">Dates from the brief and pipeline stages will appear here.</p>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-gray-50 py-2">
                  {rows.sort((a, b) => new Date(a.date) - new Date(b.date)).map((r, i) => {
                    const d    = new Date(r.date)
                    const diff = Math.ceil((d - today) / 86400000)
                    const past = diff < 0
                    const soon = diff >= 0 && diff <= 7
                    return (
                      <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                        {/* Date box */}
                        <div className="w-12 flex-shrink-0 text-center rounded-xl py-1.5" style={{ background: bgs[r.type] || '#f9f9f9' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors[r.type] || '#666' }}>
                            {d.toLocaleDateString('en-GB', { month: 'short' })}
                          </p>
                          <p className="text-xl font-bold leading-none mt-0.5" style={{ color: colors[r.type] || '#333' }}>
                            {d.getDate()}
                          </p>
                        </div>
                        {/* Label + countdown */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                          <p className={`text-xs mt-0.5 font-medium ${past ? 'text-gray-400' : soon ? 'text-red-500' : 'text-gray-400'}`}>
                            {past
                              ? `${Math.abs(diff)}d ago`
                              : diff === 0
                              ? 'Today'
                              : `In ${diff} day${diff === 1 ? '' : 's'}`
                            }
                          </p>
                        </div>
                        {/* Status badge */}
                        {past && <span className="text-[10px] text-gray-300 flex-shrink-0">past</span>}
                        {!past && diff === 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">Today</span>}
                        {!past && soon && diff > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">Soon</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <button onClick={() => { setCalPanel(false); router.push('/calendar') }}
                  className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition">
                  Open full calendar →
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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