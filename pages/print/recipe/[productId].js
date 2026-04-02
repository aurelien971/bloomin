import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export default function RecipeProductionCard() {
  const router    = useRouter()
  const { productId } = router.query

  const [product,  setProduct]  = useState(null)
  const [brief,    setBrief]    = useState(null)
  const [sheets,   setSheets]   = useState([])
  const [selected, setSelected] = useState(null)  // active sheet id
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { if (productId) init() }, [productId])

  const init = async () => {
    try {
      const pSnap = await getDoc(doc(db, 'products', productId))
      if (!pSnap.exists()) { router.push('/'); return }
      const p = { id: pSnap.id, ...pSnap.data() }
      setProduct(p)

      if (p.briefId) {
        const bSnap = await getDoc(doc(db, 'briefs', p.briefId))
        if (bSnap.exists()) setBrief({ id: bSnap.id, ...bSnap.data() })
      }

      const sSnap = await getDocs(query(
        collection(db, 'labSheets'),
        where('briefId', '==', p.briefId || ''),
        orderBy('versionNumber', 'desc')
      ))
      const all = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setSheets(all)
      const signedOff = all.find(s => s.status === 'signed-off') || all[0]
      if (signedOff) setSelected(signedOff.id)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const sheet = sheets.find(s => s.id === selected)
  const d = sheet?.data || {}
  const fd = brief?.formData || {}

  // Compute batch % breakdown
  const totalQty = (d.ingredients || []).reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0)
  const batchL   = parseFloat(d.requiredLitres) || 0

  const fmtDate = (str) => str ? new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const today   = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-sm text-gray-400">Loading…</p></div>
  if (!product) return null

  return (
    <>
      <Head>
        <title>Recipe & Production Card — {product.productName}</title>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 16mm 14mm; size: A4; }
          }
          body { background: white; }
        `}</style>
      </Head>

      {/* Toolbar — hidden on print */}
      <div className="no-print bg-black text-white px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white text-sm transition">← Back</button>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-sm font-semibold">{product.productName} — Recipe & Production Card</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Version selector */}
          {sheets.length > 1 && (
            <select value={selected || ''} onChange={e => setSelected(e.target.value)}
              className="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none">
              {sheets.map(s => (
                <option key={s.id} value={s.id} className="text-black">
                  V{s.versionNumber} {s.versionName || ''} {s.status === 'signed-off' ? '✓' : ''}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 transition">
            🖨 Export PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto px-8 py-8 bg-white min-h-screen">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-black">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Recipe & Production Card</p>
            <h1 className="text-3xl font-black text-black">{product.productName}</h1>
            <p className="text-sm text-gray-500 mt-1">{product.clientName} · {product.code}</p>
          </div>
          <div className="text-right">
            <img src="/logo.png" alt="Bloomin" className="h-8 object-contain ml-auto mb-2" onError={e => e.target.style.display='none'} />
            <p className="text-xs text-gray-400">
              {sheet ? `Version ${sheet.versionNumber}${sheet.versionName ? ` — ${sheet.versionName}` : ''}` : ''}
            </p>
            <p className="text-xs text-gray-400">{sheet?.status === 'signed-off' ? '✓ Signed off' : 'Draft'}</p>
            <p className="text-xs text-gray-300 mt-1">Printed {today}</p>
          </div>
        </div>

        {!sheet && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🧪</p>
            <p className="text-gray-500 font-medium">No lab sheet found for this product yet.</p>
          </div>
        )}

        {sheet && (<>

          {/* ── SECTION 1: Recipe (BOM) ── */}
          <Section title="Recipe" icon="📋" number="1">
            <div className="flex items-center gap-6 mb-4">
              <KV label="Batch size" value={batchL ? `${batchL} ${d.requiredLitresUnit || 'L'}` : '—'} />
              <KV label="Cook" value={sheet.versionCook || '—'} />
              <KV label="Fill method" value={d.fillMethod || '—'} />
              <KV label="Hot/Cold" value={d.hotOrColdProcess || '—'} />
              {d.estimatedCookTime && <KV label="Est. cook time" value={d.estimatedCookTime} />}
            </div>

            {/* Ingredients table */}
            {(d.ingredients || []).some(r => r.ingredient?.trim()) ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="text-left px-3 py-2 font-semibold text-xs rounded-tl-lg">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-xs">Ingredient</th>
                    <th className="text-left px-3 py-2 font-semibold text-xs">Supplier</th>
                    <th className="text-right px-3 py-2 font-semibold text-xs">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold text-xs">Unit</th>
                    <th className="text-right px-3 py-2 font-semibold text-xs rounded-tr-lg">% of batch</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.ingredients || []).filter(r => r.ingredient?.trim()).map((row, i) => {
                    const qty = parseFloat(row.qty) || 0
                    const pct = totalQty > 0 ? ((qty / totalQty) * 100).toFixed(1) : '—'
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.ingredient}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{row.supplier || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm">{row.qty || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs">{row.unit}</td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs">{pct !== '—' ? `${pct}%` : '—'}</td>
                      </tr>
                    )
                  })}
                  {totalQty > 0 && (
                    <tr className="border-t-2 border-black font-bold bg-gray-100">
                      <td colSpan={3} className="px-3 py-2 text-xs">Total</td>
                      <td className="px-3 py-2 text-right font-mono text-sm">{totalQty.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">{(d.ingredients[0]?.unit) || ''}</td>
                      <td className="px-3 py-2 text-right text-xs">100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 italic">No ingredients recorded.</p>
            )}
          </Section>

          {/* ── SECTION 2: Process ── */}
          <Section title="Process Steps" icon="⚙️" number="2">
            {d.heatingRequired && (
              <div className="flex gap-4 mb-4">
                <KV label="Heating required" value={d.heatingRequired} />
                {d.maxTemp && <KV label="Max temp" value={`${d.maxTemp}°C`} />}
                {d.coolingPoint && <KV label="Cooling point" value={`${d.coolingPoint}°C`} />}
              </div>
            )}
            {(d.steps || []).filter(s => s.trim()).length > 0 ? (
              <ol className="space-y-2">
                {(d.steps || []).filter(s => s.trim()).map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-sm text-gray-800 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400 italic">No process steps recorded.</p>
            )}
            {d.criticalAdditionNotes && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">⚠ Critical addition notes</p>
                <p className="text-sm text-amber-900">{d.criticalAdditionNotes}</p>
              </div>
            )}
            {d.processNotes && (
              <NoteBox label="Other process notes" value={d.processNotes} />
            )}
          </Section>

          {/* ── SECTION 3: Analytical Specs ── */}
          {(d.analytical?.brix?.target || d.analytical?.ph?.target || d.fillWeightPerVolume || d.density) && (
            <Section title="Analytical Specs" icon="📐" number="3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-3 py-2 text-xs font-bold text-gray-600">Parameter</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-600">Min</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-600">Target</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-600">Max</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-gray-600">Conditions</th>
                  </tr>
                </thead>
                <tbody>
                  {d.analytical?.brix?.target && (
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">Brix (°Bx)</td>
                      <td className="px-3 py-2 text-center text-gray-500">{d.analytical.brix.min || '—'}</td>
                      <td className="px-3 py-2 text-center font-bold">{d.analytical.brix.target}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{d.analytical.brix.max || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{d.analytical.brix.conditions || ''}</td>
                    </tr>
                  )}
                  {d.analytical?.ph?.target && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td className="px-3 py-2 font-medium">pH</td>
                      <td className="px-3 py-2 text-center text-gray-500">{d.analytical.ph.min || '—'}</td>
                      <td className="px-3 py-2 text-center font-bold">{d.analytical.ph.target}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{d.analytical.ph.max || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{d.analytical.ph.conditions || ''}</td>
                    </tr>
                  )}
                  {d.fillWeightPerVolume && (
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">Fill weight / volume</td>
                      <td colSpan={3} className="px-3 py-2 text-center font-bold">{d.fillWeightPerVolume}</td>
                      <td className="px-3 py-2 text-xs text-gray-400"></td>
                    </tr>
                  )}
                  {d.density && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td className="px-3 py-2 font-medium">Density</td>
                      <td colSpan={3} className="px-3 py-2 text-center font-bold">{d.density}</td>
                      <td className="px-3 py-2 text-xs text-gray-400"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── SECTION 4: Production Considerations ── */}
          <Section title="Production Considerations" icon="🏭" number="4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">

              {/* Approved facilities */}
              <div className="col-span-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Approved production facilities</p>
                {(d.productionFacilities || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {d.productionFacilities.map(f => (
                      <span key={f} className="px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-sm font-semibold text-green-800">{f}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No facilities confirmed yet.</p>
                )}
              </div>

              {/* Certification suitability */}
              {d.suitableCertifications && Object.keys(d.suitableCertifications).length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Certification suitability</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(d.suitableCertifications).map(([cert, ok]) => (
                      <span key={cert} className={`px-3 py-1 rounded-lg text-sm font-semibold border ${ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {ok ? '✓' : '✗'} {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dose rate */}
              {d.doseRate && <KV label="Dose rate" value={d.doseRate} />}
              {d.estimatedCookTime && <KV label="Estimated cook time" value={d.estimatedCookTime} />}
            </div>

            {d.productionLimitations && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">⚠ Production limitations</p>
                <p className="text-sm text-red-900">{d.productionLimitations}</p>
              </div>
            )}

            {/* Application issues */}
            {d.applicationIssues && (
              <NoteBox label="Application / stability issues" value={d.applicationIssues} />
            )}
          </Section>

          {/* ── SECTION 5: Sensory Profile ── */}
          {(d.primaryFlavour || d.colourNeat || d.sweetness || d.acidity) && (
            <Section title="Sensory Profile" icon="👅" number="5">
              <div className="grid grid-cols-3 gap-4">
                {d.primaryFlavour && <KV label="Primary flavour" value={d.primaryFlavour} />}
                {d.secondaryFlavour && <KV label="Secondary notes" value={d.secondaryFlavour} />}
                {d.aroma && <KV label="Aroma" value={d.aroma} />}
                {d.sweetness && <KV label="Sweetness" value={d.sweetness} />}
                {d.acidity && <KV label="Acidity" value={d.acidity} />}
                {d.texture && <KV label="Texture" value={d.texture} />}
                {d.aftertaste && <KV label="Aftertaste" value={d.aftertaste} />}
                {d.colourNeat && <KV label="Colour (neat)" value={d.colourNeat} />}
                {d.colourInDrink && <KV label="Colour (in drink)" value={d.colourInDrink} />}
              </div>
              {d.offNotes && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Off-notes to watch</p>
                  <p className="text-sm text-amber-900">{d.offNotesDetail || d.offNotes}</p>
                </div>
              )}
              {d.balanceNotes && <NoteBox label="Balance notes" value={d.balanceNotes} />}
            </Section>
          )}

          {/* ── Critical attributes ── */}
          {(d.criticalAttributes || []).length > 0 && (
            <Section title="Critical Attributes" icon="⭐" number="6">
              <div className="space-y-2">
                {d.criticalAttributes.map((attr, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <span className="text-green-600 font-bold mt-0.5">→</span>
                    <p className="text-sm text-gray-800">{attr}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Footer ── */}
          <div className="mt-12 pt-6 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
            <p>Bloomin NPD — Confidential</p>
            <p>{product.productName} · V{sheet.versionNumber}{sheet.versionName ? ` ${sheet.versionName}` : ''} · Printed {today}</p>
          </div>

        </>)}
      </div>
    </>
  )
}

// ── Layout components ──────────────────────────────────────────────────────────
function Section({ title, icon, number, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{number}</div>
        <h2 className="text-base font-bold text-gray-900">{icon} {title}</h2>
        <div className="flex-1 h-px bg-gray-200 ml-2" />
      </div>
      {children}
    </div>
  )
}

function KV({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function NoteBox({ label, value }) {
  return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}