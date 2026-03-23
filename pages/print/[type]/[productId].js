import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

// ── Shared print styles injected into <head> ──────────────────────────────────
const PRINT_STYLE = `
  @media print {
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-break { page-break-before: always; }
    @page { margin: 1.5cm; }
  }
`

export default function PrintPage() {
  const router = useRouter()
  const { type, productId } = router.query

  const [product,   setProduct]   = useState(null)
  const [brief,     setBrief]     = useState(null)
  const [labSheet,  setLabSheet]  = useState(null)
  const [scoping,   setScoping]   = useState(null)
  const [batches,   setBatches]   = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { if (productId && type) init() }, [productId, type])

  const init = async () => {
    setLoading(true)
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { setLoading(false); return }
      const p = { id: pSnap.id, ...pSnap.data() }
      setProduct(p)

      if (p.briefId) {
        const bSnap = await getDoc(doc(db, 'briefs', p.briefId))
        if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })

        const lSnap = await getDocs(query(
          collection(db, 'labSheets'), where('briefId', '==', p.briefId), orderBy('createdAt', 'desc')
        ))
        const sheets = lSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setLabSheet(sheets.find(s => s.status === 'signed-off') || sheets[0] || null)
      }

      const sSnap = await getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', productId)))
      if (!sSnap.empty) setScoping({ id: sSnap.docs[0].id, ...sSnap.docs[0].data() })

      const vSnap = await getDocs(query(
        collection(db, 'validationBatches'), where('productId', '==', productId), orderBy('batchNumber', 'asc')
      ))
      setBatches(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))

    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading document...</p>
    </div>
  )
  if (!product) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Product not found.</p>
    </div>
  )

  const fd = brief?.formData || {}
  const ld = labSheet?.data  || {}
  const s  = product.stages  || {}

  const docTitle = {
    brief:         'Client Brief',
    scoping:       'Ingredient Order Sheet',
    lab:           'Lab Development Sheet',
    samplesending: 'Sample Sending Record',
    clientsignoff: 'Client Sign-off Record',
    validation:    'Test Batch Report',
    labtesting:    'Lab Testing Submission',
    labelling:     'Allergen & Nutritional Declaration',
  }[type] || 'Document'

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>{docTitle} — {product.productName}</title>
        <style>{PRINT_STYLE}</style>
      </Head>

      {/* Print toolbar */}
      <div className="no-print sticky top-0 bg-black text-white px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => window.close()} className="text-white/50 hover:text-white transition text-sm">← Close</button>
          <div className="w-px h-4 bg-white/20" />
          <p className="text-sm font-semibold">{product.productName} — {docTitle}</p>
        </div>
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">

        {/* Header */}
        <div className="border-b-2 border-black pb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{product.clientName}</p>
          <h1 className="text-3xl font-bold text-black">{product.productName}</h1>
          <p className="text-lg text-gray-500 mt-1">{docTitle}</p>
          <p className="text-xs text-gray-400 mt-2">Generated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Bloomin NPD</p>
        </div>

        {/* ── CLIENT BRIEF ─────────────────────────────────────────────────── */}
        {type === 'brief' && brief && (
          <>
            <Section title="Product Overview">
              <Grid items={[
                { label: 'Product',         val: product.productName },
                { label: 'Client',          val: product.clientName },
                { label: 'Type',            val: fd.productType },
                { label: 'Why this product',val: fd.productPurpose },
                { label: 'Inspiration',     val: fd.inspiration },
                { label: 'Sample date',     val: fd.samplesNeededBy },
                { label: 'Distributor date',val: fd.distributorDate },
                { label: 'Launch date',     val: fd.launchDate },
              ]} />
            </Section>
            <Section title="Flavour">
              <Grid items={[
                { label: 'Primary flavour', val: fd.primaryFlavour },
                { label: 'Secondary notes', val: fd.secondaryFlavour },
                { label: 'Avoid',           val: fd.flavoursToAvoid },
                { label: 'Sweetness',       val: fd.sweetness },
                { label: 'Finish',          val: fd.finish },
              ]} />
            </Section>
            <Section title="Appearance">
              <Grid items={[
                { label: 'End drink type',  val: fd.endDrinkType },
                { label: 'Syrup colour',    val: fd.syrupColour },
                { label: 'End drink colour',val: fd.endDrinkColour },
                { label: 'Clarity',         val: fd.clarity },
                { label: 'References',      val: fd.colourReference },
              ]} />
            </Section>
            <Section title="Usage">
              <Grid items={[
                { label: 'Uses',            val: Array.isArray(fd.uses) ? fd.uses.join(', ') : fd.uses },
                { label: 'Milk types',      val: Array.isArray(fd.milkTypes) ? fd.milkTypes.join(', ') : fd.milkTypes },
                { label: 'Serving size / ratio', val: fd.servingSizeRatio },
                { label: 'Flavouring',      val: Array.isArray(fd.flavouringTypes) ? fd.flavouringTypes.join(', ') : fd.flavouringTypes },
              ]} />
            </Section>
            <Section title="Ingredients & Claims">
              <Grid items={[
                { label: 'Dietary',         val: Array.isArray(fd.dietary) ? fd.dietary.join(', ') : fd.dietary },
                { label: 'Sugar base',      val: fd.sugarBase },
                { label: 'Preservatives',   val: fd.preservatives },
                { label: 'Restrictions',    val: fd.ingredientRestrictions },
                { label: 'Allergens',       val: fd.allergens },
                { label: 'Product claims',  val: Array.isArray(fd.productClaims) ? fd.productClaims.join(', ') : fd.productClaims },
                { label: 'Nutritional claims', val: Array.isArray(fd.nutritionalClaims) ? fd.nutritionalClaims.join(', ') : fd.nutritionalClaims },
                { label: 'Health claims',   val: Array.isArray(fd.healthClaims) ? fd.healthClaims.join(', ') : fd.healthClaims },
                { label: 'Certifications',  val: fd.certRequired === 'Yes — required' ? fd.certDetails : 'None required' },
              ]} />
            </Section>
            <Section title="Packaging">
              <Grid items={[
                { label: 'Bottle',          val: fd.standardBottleOk === 'Yes' ? '750ml glass (standard)' : fd.bottleAlternative },
                { label: 'Pump compatible', val: fd.pumpCompatible },
                { label: 'Storage',         val: fd.storage },
                { label: 'Shelf life (unopened)', val: fd.shelfLifeUnopened },
                { label: 'Shelf life (open)', val: fd.shelfLifeOpen },
                { label: 'Markets',         val: Array.isArray(fd.markets) ? fd.markets.join(', ') : fd.markets },
              ]} />
            </Section>
            <Section title="Commercial">
              <Grid items={[
                { label: 'Target cost',     val: fd.targetCostMin ? `${fd.targetCostMin} – ${fd.targetCostMax} per bottle` : null },
                { label: 'Monthly volume',  val: fd.casesPerMonth ? `${fd.casesPerMonth} cases / ${parseInt(fd.casesPerMonth)*6} bottles` : null },
              ]} />
            </Section>
            {[
              { key: 'contact_npd',        label: 'NPD Contact' },
              { key: 'contact_supplyChain',label: 'Supply Chain Contact' },
              { key: 'contact_technical',  label: 'Technical Contact' },
            ].filter(c => fd[c.key]?.name).length > 0 && (
              <Section title="Contacts">
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { key: 'contact_npd', label: 'NPD' },
                    { key: 'contact_supplyChain', label: 'Supply Chain' },
                    { key: 'contact_technical', label: 'Technical' },
                  ].filter(c => fd[c.key]?.name).map(c => (
                    <div key={c.key}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
                      <p className="text-sm font-semibold">{fd[c.key].name}</p>
                      {fd[c.key].title && <p className="text-xs text-gray-500">{fd[c.key].title}</p>}
                      {fd[c.key].email && <p className="text-xs text-gray-500">{fd[c.key].email}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ── SCOPING ──────────────────────────────────────────────────────── */}
        {type === 'scoping' && scoping && (
          <Section title="Ingredients & Order Details">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  {['Ingredient', 'Supplier', 'Qty', 'Unit', 'Order code', 'Expected delivery', 'Delivered', 'Risk'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(scoping.ingredients || []).filter(r => r.name?.trim()).map((r, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${r.delivered ? 'bg-green-50/30' : ''}`}>
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.supplierName || r.supplierRequest ? `⚠ Requested: ${r.supplierRequest}` : '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.quantity || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.unit}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.orderCode || '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.expectedDelivery ? new Date(r.expectedDelivery).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="py-2 pr-4">{r.delivered ? `✓ ${r.deliveredAt}` : '—'}</td>
                    <td className="py-2 text-amber-600 text-xs">{r.riskFactor || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── LAB SHEET ────────────────────────────────────────────────────── */}
        {type === 'lab' && labSheet && (
          <>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 flex gap-6">
              <Kv label="Version"    val={`V${labSheet.versionNumber} — ${labSheet.versionName}`} />
              <Kv label="Cook"       val={labSheet.versionCook} />
              <Kv label="Sample UID" val={labSheet.sampleUid ? `#${labSheet.sampleUid}` : '—'} />
              <Kv label="Status"     val={labSheet.status === 'signed-off' ? '✓ Signed off' : 'Draft'} />
            </div>
            <Section title="Batch Size">
              <p className="text-sm">{ld.requiredLitres}{ld.requiredLitresUnit || 'L'}</p>
            </Section>
            {(ld.ingredients || []).filter(r => r.ingredient?.trim()).length > 0 && (
              <Section title="Recipe — Bill of Materials">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      {['Ingredient', 'Supplier', 'Unit', `Qty (${ld.requiredLitres || '?'}${ld.requiredLitresUnit || 'L'})`, 'Qty / 1000L'].map(h => (
                        <th key={h} className="pb-2 pr-4 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ld.ingredients.filter(r => r.ingredient?.trim()).map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium">{r.ingredient}</td>
                        <td className="py-2 pr-4 text-gray-600">{r.supplier || '—'}</td>
                        <td className="py-2 pr-4 text-gray-600">{r.unit}</td>
                        <td className="py-2 pr-4 text-gray-600">{r.qty || '—'}</td>
                        <td className="py-2 text-gray-600">{r.qty1000L || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
            {ld.steps?.some(s => s?.trim()) && (
              <Section title="Process">
                <ol className="space-y-2">
                  {ld.steps.filter(s => s?.trim()).map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-bold text-gray-400 w-5 flex-shrink-0">{i+1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Kv label="Heating required"    val={ld.heatingRequired} />
                  <Kv label="Critical addition"   val={ld.criticalAdditionNotes} />
                  <Kv label="Cooling point"       val={ld.coolingPoint ? `${ld.coolingPoint}°C` : null} />
                  <Kv label="Min cook time"       val={ld.minCookTime || ld.estimatedCookTime} />
                  <Kv label="Hot fill / cold mix" val={ld.hotOrColdProcess} />
                </div>
              </Section>
            )}
            <Section title="Analytical Specs">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Brix',        min: ld.analytical?.brix?.min,  target: ld.analytical?.brix?.target,  max: ld.analytical?.brix?.max  },
                  { label: 'pH',          min: ld.analytical?.ph?.min,    target: ld.analytical?.ph?.target,    max: ld.analytical?.ph?.max    },
                ].map(r => r.target && (
                  <div key={r.label} className="border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">{r.label}</p>
                    <p className="text-sm">Min: {r.min} · Target: <strong>{r.target}</strong> · Max: {r.max}</p>
                  </div>
                ))}
                <Kv label="Fill weight" val={ld.fillWeightPerVolume} />
                <Kv label="Density"     val={ld.density} />
                <Kv label="Colour (neat)" val={ld.colourNeat} />
              </div>
            </Section>
            {ld.criticalAttributes?.some(a => a?.trim()) && (
              <Section title="Critical Attributes — Must Never Change">
                <ul className="space-y-1">
                  {ld.criticalAttributes.filter(a => a?.trim()).map((a, i) => (
                    <li key={i} className="text-sm flex gap-2"><span className="text-red-500 font-bold">⚠</span>{a}</li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title="Production">
              <Grid items={[
                { label: 'Hot fill / cold mix',   val: ld.hotOrColdProcess },
                { label: 'Facilities',            val: Array.isArray(ld.productionFacilities) ? ld.productionFacilities.join(', ') : ld.productionFacilities },
                { label: 'Limitations',           val: ld.productionLimitations },
                { label: 'Retain sample location',val: ld.sampleLocation },
                { label: 'Retain label',          val: ld.sampleLabel },
              ]} />
              {ld.retainSamplePhotoUrl && (
                <div className="mt-4 flex gap-4">
                  <div><p className="text-xs text-gray-500 mb-1">Retain sample</p><img src={ld.retainSamplePhotoUrl} alt="Retain" className="h-32 rounded-xl border border-gray-200 object-cover" /></div>
                  {ld.drinkPhotoUrl && <div><p className="text-xs text-gray-500 mb-1">Prepared drink</p><img src={ld.drinkPhotoUrl} alt="Drink" className="h-32 rounded-xl border border-gray-200 object-cover" /></div>}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ── SAMPLE SENDING ───────────────────────────────────────────────── */}
        {type === 'samplesending' && s.sampleSending?.sentAt && (
          <>
            <Section title="Shipment Details">
              <Grid items={[
                { label: 'Sent by',    val: s.sampleSending.sentBy },
                { label: 'Date sent',  val: new Date(s.sampleSending.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Recipient',  val: s.sampleSending.recipientName },
                { label: 'Email',      val: s.sampleSending.recipientEmail },
                { label: 'Address',    val: s.sampleSending.recipientAddress },
                { label: 'Notes',      val: s.sampleSending.notes },
              ]} />
            </Section>
            {(s.sampleSending.packages || []).length > 0 && (
              <Section title="Packages">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      {['Box', 'Bottles', 'Courier', 'Tracking number', 'Expected arrival'].map(h => (
                        <th key={h} className="pb-2 pr-4 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.sampleSending.packages.map((pkg, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium">Box {i+1}</td>
                        <td className="py-2 pr-4">{pkg.bottles}</td>
                        <td className="py-2 pr-4">{pkg.courier || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{pkg.trackingNumber || '—'}</td>
                        <td className="py-2">{pkg.expectedArrival ? new Date(pkg.expectedArrival).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </>
        )}

        {/* ── CLIENT SIGN-OFF ──────────────────────────────────────────────── */}
        {type === 'clientsignoff' && s.clientSignOff?.status === 'complete' && (
          <>
            <Section title="Sign-off Details">
              <Grid items={[
                { label: 'Version signed off',  val: `V${s.clientSignOff.signedOffVersion}` },
                { label: 'Signed off by',        val: s.clientSignOff.signedOffBy },
                { label: 'Date',                 val: s.clientSignOff.signedOffDate ? new Date(s.clientSignOff.signedOffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null },
                { label: 'Signed internally by', val: s.clientSignOff.signedOffInternally },
                { label: 'Client feedback',      val: s.clientSignOff.clientFeedback },
              ]} />
            </Section>
            <Section title="Initial Order">
              <Grid items={[
                { label: 'Volume',          val: `${s.clientSignOff.initialOrderVolume} ${s.clientSignOff.initialOrderUnit}` },
                { label: 'Target delivery', val: s.clientSignOff.targetDeliveryDate ? new Date(s.clientSignOff.targetDeliveryDate).toLocaleDateString('en-GB') : null },
                { label: 'Delivery address',val: s.clientSignOff.deliveryAddress },
                { label: 'Internal notes',  val: s.clientSignOff.notes },
              ]} />
            </Section>
          </>
        )}

        {/* ── TEST BATCH ───────────────────────────────────────────────────── */}
        {type === 'validation' && batches.length > 0 && batches.map((b, bi) => (
          <div key={bi} className={bi > 0 ? 'print-break' : ''}>
            <Section title={`Batch ${b.batchNumber} — ${b.facility || ''}${b.date ? ` · ${new Date(b.date).toLocaleDateString('en-GB')}` : ''}${b.assessedBy ? ` · ${b.assessedBy}` : ''}`}>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Visual',      val: b.visual?.overallVisual },
                    { label: 'Sensory',     val: b.sensory?.overallSensory },
                    { label: 'Application', val: b.application?.overallApplication },
                    { label: 'Process',     val: b.process?.overallProcess },
                    { label: 'Decision',    val: b.decision === 'approved' ? 'Approved' : b.decision === 'approved-with-note' ? 'Approved ⚠' : b.decision === 'rejected' ? 'Rejected' : '—' },
                  ].map(item => (
                    <div key={item.label} className={`border rounded-xl px-3 py-2 text-center ${item.val === 'Pass' || item.val === 'Approved' ? 'border-green-200 bg-green-50' : item.val === 'Fail' || item.val === 'Rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                      <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                      <p className={`text-sm font-bold ${item.val === 'Pass' || item.val?.includes('Approved') ? 'text-green-700' : item.val === 'Fail' || item.val === 'Rejected' ? 'text-red-700' : 'text-gray-400'}`}>{item.val || '—'}</p>
                    </div>
                  ))}
                </div>
                {/* Photos */}
                {(b.batchPhotoUrl || b.batchDrinkPhotoUrl) && (
                  <div className="flex gap-4">
                    {b.batchPhotoUrl && <div><p className="text-xs text-gray-500 mb-1">Bottle</p><img src={b.batchPhotoUrl} alt="Batch bottle" className="h-28 rounded-xl border border-gray-200 object-cover" /></div>}
                    {b.batchDrinkPhotoUrl && <div><p className="text-xs text-gray-500 mb-1">Prepared drink</p><img src={b.batchDrinkPhotoUrl} alt="Drink" className="h-28 rounded-xl border border-gray-200 object-cover" /></div>}
                  </div>
                )}
                {b.decisionNotes && <p className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{b.decisionNotes}</p>}
              </div>
            </Section>
          </div>
        ))}

        {/* ── LAB TESTING ──────────────────────────────────────────────────── */}
        {type === 'labtesting' && (
          <Section title="Lab Testing Submission">
            <Grid items={[
              { label: 'Submitted by',    val: s.labTesting?.submittedBy },
              { label: 'Date submitted',  val: s.labTesting?.submittedAt ? new Date(s.labTesting.submittedAt).toLocaleDateString('en-GB') : null },
              { label: 'Lab',             val: s.labTesting?.labName },
              { label: 'Units sent',      val: s.labTesting?.unitsSent },
              { label: 'Tests requested', val: Array.isArray(s.labTesting?.testsRequested) ? s.labTesting.testsRequested.join(', ') : s.labTesting?.testsRequested },
              { label: 'Results expected',val: s.labTesting?.expectedResultsDate ? new Date(s.labTesting.expectedResultsDate).toLocaleDateString('en-GB') : null },
              { label: 'Results',         val: s.labTesting?.resultsSummary },
            ]} />
          </Section>
        )}

        {/* ── LABELLING ────────────────────────────────────────────────────── */}
        {type === 'labelling' && s.labelling?.data && (() => {
          const labelData = s.labelling.data
          const ALLERGENS = [
            'Cereals containing gluten','Crustaceans','Eggs','Fish','Peanuts','Soybeans',
            'Milk','Nuts','Celery','Mustard','Sesame seeds',
            'Sulphur dioxide and sulphites (>10ppm SO₂)','Lupin','Molluscs',
          ]
          const NUTRIENT_ROWS = [
            { key: 'energyKj',   label: 'Energy (kJ)' },
            { key: 'energyKcal', label: 'Energy (kcal)' },
            { key: 'fat',        label: 'Fat (g)',        indent: false },
            { key: 'saturates',  label: 'Of which — Saturates', indent: true },
            { key: 'carbs',      label: 'Carbohydrate (g)' },
            { key: 'sugars',     label: 'Of which — Sugars', indent: true },
            { key: 'fibre',      label: 'Fibre (g)' },
            { key: 'protein',    label: 'Protein (N×6.25) (g)' },
            { key: 'salt',       label: 'Salt (g)' },
          ]
          return (
            <>
              <Section title="Allergen Declaration (Draft)">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">⚠ Draft declaration — must be verified against final recipe and supplier specifications before printing.</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      {['#','Allergen','Contains?','Cross-contamination risk?'].map(h => (
                        <th key={h} className="pb-2 pr-6 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALLERGENS.map((a, i) => {
                      const row = labelData.allergens?.[a] || {}
                      return (
                        <tr key={a} className={`border-b border-gray-100 ${row.contains === 'Yes' ? 'bg-red-50/40' : ''}`}>
                          <td className="py-2 pr-4 text-gray-400 text-xs">{i+1}</td>
                          <td className="py-2 pr-6">{a}</td>
                          <td className="py-2 pr-6 font-semibold">{row.contains || '—'}</td>
                          <td className="py-2">{row.crossContamination || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Section>
              {(Object.values(labelData.calcNutrients || {}).some(r => r?.per100) || Object.values(labelData.targetNutrients || {}).some(r => r?.per100)) && (
                <Section title={`Nutritional Information${Object.values(labelData.calcNutrients || {}).some(r => r?.per100) ? ' (Calculated)' : ' (Target)'}`}>
                  {labelData.servingSize && <p className="text-xs text-gray-500 mb-3">Serving size: {labelData.servingSize}</p>}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-black text-left">
                        {['Nutrient', 'Per 100g/ml', 'Per serving', '% RI'].map(h => (
                          <th key={h} className="pb-2 pr-6 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {NUTRIENT_ROWS.map(({ key, label, indent }) => {
                        const src = Object.values(labelData.calcNutrients || {}).some(r => r?.per100) ? labelData.calcNutrients : labelData.targetNutrients
                        const row = src?.[key] || {}
                        return (
                          <tr key={key} className="border-b border-gray-100">
                            <td className={`py-2 pr-6 ${indent ? 'pl-4 text-gray-500 italic' : 'font-medium'}`}>{label}</td>
                            <td className="py-2 pr-6 text-right">{row.per100 || '—'}</td>
                            <td className="py-2 pr-6 text-right">{row.perServing || '—'}</td>
                            <td className="py-2 text-right">{row.ri ? `${row.ri}%` : '—'}</td>
                          </tr>
                        )
                      })}
                      {(labelData.activeIngredients || []).filter(a => a.name).map((ai, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 pr-6 font-medium">{ai.name}</td>
                          <td className="py-2 pr-6 text-right">{ai.per100 || '—'}</td>
                          <td className="py-2 pr-6 text-right">{ai.perServing || '—'}</td>
                          <td className="py-2 text-right">{ai.ri ? `${ai.ri}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
              {labelData.claims?.some(c => c.claim) && (
                <Section title="Product Claims">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-black text-left">
                        {['Claim','Permitted in market?','Ingredient to substantiate','Required per serve'].map(h => (
                          <th key={h} className="pb-2 pr-6 text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {labelData.claims.filter(c => c.claim).map((c, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 pr-6 font-medium">{c.claim}</td>
                          <td className="py-2 pr-6">{c.permitted || '—'}</td>
                          <td className="py-2 pr-6">{c.ingredient || '—'}</td>
                          <td className="py-2">{c.levelPerServe || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
            </>
          )
        })()}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 text-xs text-gray-400 flex justify-between">
          <span>Bloomin NPD · {product.clientName} · {product.productName}</span>
          <span>{docTitle} · {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-1 border-b border-gray-200">{title}</h2>
      {children}
    </div>
  )
}

function Grid({ items }) {
  const filled = items.filter(i => i.val)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
      {filled.map(item => (
        <div key={item.label} className={typeof item.val === 'string' && item.val.length > 60 ? 'col-span-2 md:col-span-3' : ''}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
          <p className="text-sm text-gray-800 leading-relaxed">{item.val}</p>
        </div>
      ))}
    </div>
  )
}

function Kv({ label, val }) {
  if (!val) return null
  return (
    <div>
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800">{val}</p>
    </div>
  )
}