import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function ReleasePage() {
  const router = useRouter()
  const { productId } = router.query

  const [product,    setProduct]    = useState(null)
  const [brief,      setBrief]      = useState(null)
  const [labSheet,   setLabSheet]   = useState(null)
  const [labelling,  setLabelling]  = useState(null)
  const [scoping,    setScoping]    = useState(null)
  const [loading,    setLoading]    = useState(true)

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
        if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })

        // Signed-off lab sheet
        const lSnap = await getDocs(query(
          collection(db, 'labSheets'),
          where('briefId', '==', p.briefId),
          orderBy('createdAt', 'desc')
        ))
        const sheets = lSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const signed = sheets.find(s => s.status === 'signed-off') || sheets[0] || null
        setLabSheet(signed)
      }

      // Scoping sheet
      const sSnap = await getDocs(query(collection(db, 'scopingSheets'), where('productId', '==', productId)))
      if (!sSnap.empty) setScoping({ id: sSnap.docs[0].id, ...sSnap.docs[0].data() })

      // Labelling data from stages
      setLabelling(p.stages?.labelling?.data || null)

    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const print = () => window.print()

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>

  const fd  = brief?.formData || {}
  const ld  = labSheet?.data  || {}
  const s   = product?.stages || {}

  // Commercial calculations
  const costMin    = fd.targetCostMin   ? parseFloat(fd.targetCostMin)   : null
  const costMax    = fd.targetCostMax   ? parseFloat(fd.targetCostMax)   : null
  const rrp        = fd.targetRrp       ? parseFloat(fd.targetRrp)       : null
  const currency   = fd.priceCurrency || 'GBP'
  const sym        = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
  const marginMin  = (rrp && costMax)   ? (((rrp - costMax) / rrp) * 100).toFixed(1) : null
  const marginMax  = (rrp && costMin)   ? (((rrp - costMin) / rrp) * 100).toFixed(1) : null

  const ingredients = scoping?.ingredients?.filter(i => i.name?.trim()) || []

  return (
    <div className="min-h-screen bg-gray-50 pb-12 print:bg-white print:pb-0">
      <Head><title>Release Summary — {product?.productName}</title></Head>

      {/* Header */}
      <div className="bg-black text-white sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-6 sm:h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <button onClick={() => router.push(`/product/${productId}`)} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{product?.productName}</p>
              <p className="text-xs text-white/50">{product?.clientName} · Release Summary</p>
            </div>
          </div>
          <button onClick={print} className="px-4 py-2 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition flex-shrink-0">
            🖨 Export / Print
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Title */}
        <div className="bg-black text-white rounded-2xl px-6 py-5">
          <p className="text-xs text-white/50 uppercase tracking-widest font-semibold">{product?.clientName}</p>
          <h1 className="text-2xl font-bold text-white mt-1">{product?.productName}</h1>
          <p className="text-sm text-white/50 mt-1">
            Released · {product?.owner ? `Owner: ${product.owner}` : ''} ·
            {labSheet ? ` Lab version: V${labSheet.versionNumber} — ${labSheet.versionName}` : ''}
            {labSheet?.sampleUid ? ` · #${labSheet.sampleUid}` : ''}
          </p>
        </div>

        {/* Commercial summary */}
        <Section title="Commercial">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {costMin && costMax && <Stat label="Target cost" value={`${sym}${costMin} – ${sym}${costMax}`} />}
            {rrp && <Stat label="Target RRP" value={`${sym}${rrp}`} />}
            {marginMin && marginMax && <Stat label="Gross margin" value={`${marginMin}% – ${marginMax}%`} highlight />}
            {fd.casesPerMonth && <Stat label="Est. monthly vol." value={`${fd.casesPerMonth} cases / ${parseInt(fd.casesPerMonth) * 6} bottles`} />}
          </div>
          {s.clientSignOff?.initialOrderVolume && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">First order</p>
              <p className="text-sm text-green-900">{s.clientSignOff.initialOrderVolume} {s.clientSignOff.initialOrderUnit} · signed off by {s.clientSignOff.signedOffBy} · {s.clientSignOff.signedOffDate ? new Date(s.clientSignOff.signedOffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
            </div>
          )}
        </Section>

        {/* Product specs */}
        <Section title="Product Specification">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Primary flavour',    val: fd.primaryFlavour },
              { label: 'Sweetness',          val: fd.sweetness },
              { label: 'Clarity',            val: fd.clarity },
              { label: 'Syrup colour',       val: ld.colourNeat || fd.syrupColour },
              { label: 'End drink colour',   val: ld.colourInDrink || fd.endDrinkColour },
              { label: 'Brix target',        val: ld.analytical?.brix?.target ? `${ld.analytical.brix.min}–${ld.analytical.brix.max} (target ${ld.analytical.brix.target})` : null },
              { label: 'pH target',          val: ld.analytical?.ph?.target   ? `${ld.analytical.ph.min}–${ld.analytical.ph.max} (target ${ld.analytical.ph.target})` : null },
              { label: 'Fill weight',        val: ld.fillWeightPerVolume },
              { label: 'Density',            val: ld.density },
              { label: 'Hot/cold process',   val: ld.hotOrColdProcess },
              { label: 'Shelf life (unopened)', val: fd.shelfLifeUnopened || fd.shelfLife },
              { label: 'Shelf life (open)',  val: fd.shelfLifeOpen },
              { label: 'Storage',            val: fd.storage },
              { label: 'Bottle',             val: fd.standardBottleOk === 'Yes' ? '750ml glass' : fd.bottleAlternative },
              { label: 'Markets',            val: Array.isArray(fd.markets) ? fd.markets.join(', ') : fd.markets },
            ].filter(f => f.val).map(f => <Stat key={f.label} label={f.label} value={f.val} />)}
          </div>
        </Section>

        {/* Recipe / BOM */}
        {(ingredients.length > 0 || ld.ingredients?.length > 0) && (
          <Section title="Bill of Materials">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Ingredient', 'Supplier', 'Qty for batch', 'Unit', 'Qty / 1000L', 'Risk flag'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ld.ingredients?.filter(r => r.ingredient?.trim()) || ingredients).map((row, i) => {
                    const scopeRow = ingredients.find(s => s.name?.toLowerCase() === (row.ingredient || row.name)?.toLowerCase())
                    return (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">{row.ingredient || row.name}</td>
                        <td className="py-2 pr-4 text-gray-500">{row.supplier || scopeRow?.supplierName || '—'}</td>
                        <td className="py-2 pr-4 text-gray-500">{row.qty || scopeRow?.quantity || '—'}</td>
                        <td className="py-2 pr-4 text-gray-500">{row.unit || scopeRow?.unit || '—'}</td>
                        <td className="py-2 pr-4 text-gray-500">{row.qty1000L || '—'}</td>
                        <td className="py-2">
                          {scopeRow?.riskFactor
                            ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{scopeRow.riskFactor}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Cooking process */}
        {ld.steps?.some(s => s?.trim()) && (
          <Section title="Cooking Process">
            <div className="space-y-2">
              {ld.steps.filter(s => s?.trim()).map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-gray-700">{step}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {[
                { label: 'Heating required',    val: ld.heatingRequired },
                { label: 'Critical addition',   val: ld.criticalAdditionNotes },
                { label: 'Cooling point',       val: ld.coolingPoint ? `${ld.coolingPoint}°C` : null },
                { label: 'Min cook time',       val: ld.minCookTime || ld.estimatedCookTime },
              ].filter(f => f.val).map(f => <Stat key={f.label} label={f.label} value={f.val} />)}
            </div>
          </Section>
        )}

        {/* Allergens */}
        {labelling?.allergens && Object.keys(labelling.allergens).length > 0 && (
          <Section title="Allergen Declaration">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Allergen', 'Contains', 'Cross-contamination risk'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-6 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(labelling.allergens).map(([allergen, row]) => (
                    <tr key={allergen} className={`border-t border-gray-50 ${row.contains === 'Yes' ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2 pr-6 text-gray-700">{allergen}</td>
                      <td className="py-2 pr-6">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.contains === 'Yes' ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                          {row.contains || '—'}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.crossContamination === 'Risk' ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400'}`}>
                          {row.crossContamination || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Nutritional */}
        {labelling?.calcNutrients && Object.values(labelling.calcNutrients).some(r => r.per100) && (
          <Section title="Nutritional Information (Calculated)">
            <NutritionalTable nutrients={labelling.calcNutrients} activeIngredients={labelling.activeIngredients} servingSize={labelling.servingSize} />
          </Section>
        )}
        {labelling?.targetNutrients && Object.values(labelling.targetNutrients).some(r => r.per100) && !Object.values(labelling?.calcNutrients || {}).some(r => r.per100) && (
          <Section title="Nutritional Information (Target — pending lab confirmation)">
            <NutritionalTable nutrients={labelling.targetNutrients} activeIngredients={labelling.activeIngredients} servingSize={labelling.servingSize} />
          </Section>
        )}

        {/* Claims */}
        {labelling?.claims?.some(c => c.claim) && (
          <Section title="Product Claims">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Claim', 'Permitted', 'Substantiated by', 'Required per serve'].map(h => (
                      <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-6 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labelling.claims.filter(c => c.claim).map((c, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-2 pr-6 font-medium text-gray-800">{c.claim}</td>
                      <td className="py-2 pr-6">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.permitted === 'Yes' ? 'bg-green-50 text-green-700' : c.permitted === 'No' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {c.permitted || '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-6 text-gray-500">{c.ingredient || '—'}</td>
                      <td className="py-2 text-gray-500">{c.levelPerServe || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Critical sensory attributes */}
        {ld.criticalAttributes?.some(a => a?.trim()) && (
          <Section title="Critical Sensory Attributes">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-1">
              {ld.criticalAttributes.filter(a => a?.trim()).map((a, i) => (
                <p key={i} className="text-sm text-red-800">⚠ {a}</p>
              ))}
            </div>
          </Section>
        )}

        {/* Retain sample */}
        {ld.retainSampleKept === 'Yes' && (
          <Section title="Lab Retain Sample">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Location', val: ld.sampleLocation },
                { label: 'Label',    val: ld.sampleLabel },
              ].filter(f => f.val).map(f => <Stat key={f.label} label={f.label} value={f.val} />)}
              {ld.retainSamplePhotoUrl && <img src={ld.retainSamplePhotoUrl} alt="Retain sample" className="h-36 object-cover rounded-xl border border-gray-200" />}
              {ld.drinkPhotoUrl && <img src={ld.drinkPhotoUrl} alt="Drink reference" className="h-36 object-cover rounded-xl border border-gray-200" />}
            </div>
          </Section>
        )}

        {/* Production */}
        <Section title="Production">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Facility',          val: s.batchDecision?.productionFacility },
              { label: 'Production date',   val: s.batchDecision?.productionDateBooked ? new Date(s.batchDecision.productionDateBooked).toLocaleDateString('en-GB') : null },
              { label: 'Assigned cook',     val: s.batchDecision?.assignedCook },
              { label: 'Batch decision by', val: s.batchDecision?.approvedBy },
              { label: 'Certifications',    val: fd.certRequired === 'Yes — required' ? fd.certDetails : null },
              { label: 'Production method', val: ld.hotOrColdProcess },
              { label: 'Limitations',       val: ld.productionLimitations },
            ].filter(f => f.val).map(f => <Stat key={f.label} label={f.label} value={f.val} />)}
          </div>
        </Section>

        {/* Contacts */}
        {(fd.contact_npd || fd.contact_supplyChain || fd.contact_technical) && (
          <Section title="Client Contacts">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { type: 'NPD',           data: fd.contact_npd },
                { type: 'Supply Chain',  data: fd.contact_supplyChain },
                { type: 'Technical',     data: fd.contact_technical },
              ].filter(c => c.data?.name).map(c => (
                <div key={c.type} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{c.type}</p>
                  <p className="text-sm font-semibold text-gray-900">{c.data.name}</p>
                  {c.data.title && <p className="text-xs text-gray-400">{c.data.title}</p>}
                  {c.data.email && <a href={`mailto:${c.data.email}`} className="text-xs text-blue-600 hover:underline">{c.data.email}</a>}
                </div>
              ))}
            </div>
          </Section>
        )}

      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'text-green-700 font-bold' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

const NUTRIENT_ROWS = [
  { key: 'energyKj',   label: 'Energy (kJ)',             indent: false },
  { key: 'energyKcal', label: 'Energy (kcal)',            indent: false },
  { key: 'fat',        label: 'Fat (g)',                  indent: false },
  { key: 'saturates',  label: 'Of which — Saturates',     indent: true  },
  { key: 'carbs',      label: 'Carbohydrate (g)',          indent: false },
  { key: 'sugars',     label: 'Of which — Sugars',        indent: true  },
  { key: 'fibre',      label: 'Fibre (g)',                indent: false },
  { key: 'protein',    label: 'Protein (N×6.25) (g)',     indent: false },
  { key: 'salt',       label: 'Salt (g)',                 indent: false },
]

function NutritionalTable({ nutrients, activeIngredients, servingSize }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-6 text-left w-48">Nutrient</th>
            {[`Per 100g/ml`, servingSize ? `Per serving (${servingSize})` : 'Per serving', '% RI'].map(h => (
              <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-6 text-right">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NUTRIENT_ROWS.map(({ key, label, indent }) => {
            const row = nutrients?.[key] || {}
            return (
              <tr key={key} className="border-t border-gray-50">
                <td className={`py-2 pr-6 ${indent ? 'pl-4 text-gray-500 italic' : 'font-medium text-gray-700'}`}>{label}</td>
                <td className="py-2 pr-6 text-right text-gray-600">{row.per100 || '—'}</td>
                <td className="py-2 pr-6 text-right text-gray-600">{row.perServing || '—'}</td>
                <td className="py-2 text-right text-gray-600">{row.ri ? `${row.ri}%` : '—'}</td>
              </tr>
            )
          })}
          {(activeIngredients || []).filter(a => a.name).map((ai, i) => (
            <tr key={`active-${i}`} className="border-t border-gray-50">
              <td className="py-2 pr-6 font-medium text-gray-700">{ai.name}</td>
              <td className="py-2 pr-6 text-right text-gray-600">{ai.per100 || '—'}</td>
              <td className="py-2 pr-6 text-right text-gray-600">{ai.perServing || '—'}</td>
              <td className="py-2 text-right text-gray-600">{ai.ri ? `${ai.ri}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}