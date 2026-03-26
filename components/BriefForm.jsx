import { useState, useRef } from 'react'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Step1Overview        from './steps/Step1Overview'
import Step2Flavour         from './steps/Step2Flavour'
import Step3Appearance      from './steps/Step3Appearance'
import Step4Usage           from './steps/Step4Usage'
import Step5Ingredients     from './steps/Step5Ingredients'
import Step6Practical       from './steps/Step6Practical'
import Step7Commercial      from './steps/Step7Commercial'
import DrinkStep1Product    from './steps/DrinkStep1Product'
import DrinkStep2Formula    from './steps/DrinkStep2Formula'
import DrinkStep3Appearance from './steps/DrinkStep3Appearance'
import DrinkStep4Format     from './steps/DrinkStep4Format'
import DrinkStep5Markets    from './steps/DrinkStep5Markets'
import DrinkStep6Commercial from './steps/DrinkStep6Commercial'

const SYRUP_STEPS = [
  { label: 'Overview',    emoji: '📋', component: Step1Overview    },
  { label: 'Flavour',     emoji: '🍒', component: Step2Flavour     },
  { label: 'Appearance',  emoji: '🎨', component: Step3Appearance  },
  { label: 'Usage',       emoji: '☕', component: Step4Usage       },
  { label: 'Ingredients', emoji: '🌿', component: Step5Ingredients },
  { label: 'Packaging',   emoji: '📦', component: Step6Practical   },
  { label: 'Commercial',  emoji: '💼', component: Step7Commercial  },
]

const DRINK_STEPS = [
  { label: 'Product',    emoji: '🥤', component: DrinkStep1Product    },
  { label: 'Formula',    emoji: '🧬', component: DrinkStep2Formula    },
  { label: 'Appearance', emoji: '🎨', component: DrinkStep3Appearance },
  { label: 'Format',     emoji: '📦', component: DrinkStep4Format     },
  { label: 'Markets',    emoji: '🌎', component: DrinkStep5Markets    },
  { label: 'Commercial', emoji: '💼', component: DrinkStep6Commercial },
]

// ── Compact JSON schema sent to OpenAI ────────────────────────────────────────
const SYRUP_SCHEMA = {
  productName:            'string — product name if mentioned',
  productPurpose:         'string — why this product, what opportunity',
  inspiration:            'string — any reference products or brands',
  samplesNeededBy:        'string — date in YYYY-MM-DD format',
  launchDate:             'string — date in YYYY-MM-DD format',
  distributorDate:        'string — date lands at distributor YYYY-MM-DD',
  primaryFlavour:         'string — dominant flavour',
  secondaryFlavour:       'string — secondary flavour notes',
  flavourExclusions:      'string — flavours to avoid',
  sweetness:              'one of: Very sweet | Sweet | Balanced | Lightly sweet | Dry',
  aftertaste:             'string — finish / aftertaste description',
  syrupColour:            'string — colour of the syrup in the bottle',
  endDrinkColour:         'string — colour in the finished drink',
  endDrinkType:           'string — type of drink e.g. latte, matcha, cocktail',
  clarity:                'array of: Crystal clear | Slightly hazy | Opaque | Thick & opaque | Grainy / textured',
  uses:                   'array of: Hot milk drinks | Cold milk drinks | Still water | Sparkling water / soda | Cocktails / mocktails | Matcha / powder drinks',
  milkTypes:              'array of milk types mentioned',
  doseRate:               'string — dose rate e.g. 15ml per 250ml',
  dietary:                'array of: Vegan | Vegetarian | Gluten-free | Dairy-free | Kosher | Halal | None',
  sugarBase:              'string — sugar type',
  preservatives:          'string — preservative preferences',
  allergens:              'string — allergen notes',
  ingredientRestrictions: 'string — ingredient restrictions',
  storage:                'string — storage requirements',
  shelfLifeUnopened:      'string — shelf life unopened',
  certifications:         'array of: SALSA | BRC | Organic | Vegan Society | Kosher | Halal | None needed',
  markets:                'array of country/region names',
  targetCostMin:          'number — min cost per unit',
  targetCostMax:          'number — max cost per unit',
  targetRrp:              'number — target retail price',
  casesPerMonth:          'string — volume estimate',
  contactName:            'string — contact person name',
  contactEmail:           'string — contact email',
  anythingElse:           'string — any other notes',
}

const DRINK_SCHEMA = {
  productName:            'string — product name',
  productType:            'one of: One-time / LTO | Recurring / permanent | Seasonal | Don\'t know yet',
  productPurpose:         'string — why this product',
  inspiration:            'string — reference products',
  samplesNeededBy:        'string — YYYY-MM-DD',
  launchDate:             'string — YYYY-MM-DD',
  flavourDirection:       'string — flavour direction',
  proteinTarget:          'number — grams of protein per serving',
  proteinBlend:           'one of: Whey only | Collagen only | Whey + Collagen | Plant-based | TBD — needs R&D input',
  electrolytes:           'one of: Yes — key feature | Yes — small amount | No | TBD',
  electrolytesDetail:     'string — which electrolytes',
  sweetener:              'one of: Sugar | Stevia | Sucralose | Monk fruit | No added sugar | TBD',
  carbonation:            'one of: Still | Lightly sparkling | Medium sparkling | Highly carbonated | TBD',
  formulaRestrictions:    'string — ingredients off the table',
  colourDirection:        'string — colour description',
  clarity:                'one of: Crystal clear | Slightly hazy | Lightly coloured | Vibrant / bold colour | TBD',
  visualReference:        'string — visual references',
  format:                 'one of: 330ml can | 500ml can | 250ml can | 330ml bottle | 500ml bottle | Other',
  occasions:              'array of: Gym / post-workout | On-the-go / daily | Office / desk | Social / out | Morning routine | All day',
  channels:               'array of: Gym & fitness retail | Grocery / supermarket | Convenience stores | Online DTC | Food service / cafes',
  shelfLife:              'one of: 12 months | 18 months | 24 months | TBD',
  storage:                'one of: Ambient | Chilled | Either / TBD',
  markets:                'array of country names',
  functionalClaims:       'array of: High protein | Source of protein | Electrolytes | Low sugar | No added sugar | Low calorie | Hydration',
  labelClaims:            'array of: Vegan | Gluten-free | Non-GMO | Natural flavours only | No artificial sweeteners',
  certifications:         'array of: FDA compliant (USA) | ANVISA compliant (Brazil) | SALSA | BRC | Organic',
  allergenNotes:          'string — allergen notes',
  targetCostMin:          'number',
  targetCostMax:          'number',
  targetRrp:              'number',
  initialVolume:          'string — initial run volume',
  anythingElse:           'string',
}

// ── Human-readable field labels for diff preview ──────────────────────────────
const FIELD_LABELS = {
  productName: 'Product name', productPurpose: 'Purpose', inspiration: 'Inspiration',
  samplesNeededBy: 'Sample date', launchDate: 'Launch date', distributorDate: 'Distributor date',
  primaryFlavour: 'Primary flavour', secondaryFlavour: 'Secondary notes', flavourExclusions: 'Exclusions',
  sweetness: 'Sweetness', aftertaste: 'Aftertaste', syrupColour: 'Syrup colour',
  endDrinkColour: 'End drink colour', endDrinkType: 'End drink type', clarity: 'Clarity',
  uses: 'Uses', milkTypes: 'Milk types', doseRate: 'Dose rate',
  dietary: 'Dietary', sugarBase: 'Sugar base', preservatives: 'Preservatives',
  allergens: 'Allergens', ingredientRestrictions: 'Restrictions', storage: 'Storage',
  shelfLifeUnopened: 'Shelf life', certifications: 'Certifications', markets: 'Markets',
  targetCostMin: 'Cost min', targetCostMax: 'Cost max', targetRrp: 'Target RRP',
  casesPerMonth: 'Volume', contactName: 'Contact', contactEmail: 'Email', anythingElse: 'Other notes',
  // Drink-specific
  flavourDirection: 'Flavour direction', proteinTarget: 'Protein (g)', proteinBlend: 'Protein blend',
  electrolytes: 'Electrolytes', electrolytesDetail: 'Electrolyte detail', sweetener: 'Sweetener',
  carbonation: 'Carbonation', formulaRestrictions: 'Restrictions', colourDirection: 'Colour direction',
  visualReference: 'Visual refs', format: 'Format', occasions: 'Occasions', channels: 'Channels',
  shelfLife: 'Shelf life', functionalClaims: 'Functional claims', labelClaims: 'Label claims',
  allergenNotes: 'Allergen notes', initialVolume: 'Initial volume',
}

// ── Field → Step mapping ──────────────────────────────────────────────────────
const FIELD_STEP = {
  // Syrup steps
  productName: 'Overview', productPurpose: 'Overview', inspiration: 'Overview',
  samplesNeededBy: 'Overview', launchDate: 'Overview', distributorDate: 'Overview',
  primaryFlavour: 'Flavour', secondaryFlavour: 'Flavour', flavourExclusions: 'Flavour',
  sweetness: 'Flavour', aftertaste: 'Flavour',
  syrupColour: 'Appearance', endDrinkColour: 'Appearance', endDrinkType: 'Appearance', clarity: 'Appearance',
  uses: 'Usage', milkTypes: 'Usage', doseRate: 'Usage',
  dietary: 'Ingredients', sugarBase: 'Ingredients', preservatives: 'Ingredients',
  allergens: 'Ingredients', ingredientRestrictions: 'Ingredients',
  storage: 'Packaging', shelfLifeUnopened: 'Packaging', certifications: 'Packaging', markets: 'Packaging',
  targetCostMin: 'Commercial', targetCostMax: 'Commercial', targetRrp: 'Commercial',
  casesPerMonth: 'Commercial', contactName: 'Commercial', contactEmail: 'Commercial', anythingElse: 'Commercial',
  // Drink steps
  productType: 'Product', productPurpose: 'Product',
  flavourDirection: 'Formula', proteinTarget: 'Formula', proteinBlend: 'Formula',
  electrolytes: 'Formula', electrolytesDetail: 'Formula', sweetener: 'Formula',
  carbonation: 'Formula', formulaRestrictions: 'Formula',
  colourDirection: 'Appearance', visualReference: 'Appearance',
  format: 'Format', occasions: 'Format', channels: 'Format', shelfLife: 'Format',
  functionalClaims: 'Markets', labelClaims: 'Markets', allergenNotes: 'Markets',
  initialVolume: 'Commercial',
}

const STEP_COLORS = {
  Overview: 'bg-blue-50 text-blue-600', Flavour: 'bg-pink-50 text-pink-600',
  Appearance: 'bg-purple-50 text-purple-600', Usage: 'bg-amber-50 text-amber-600',
  Ingredients: 'bg-green-50 text-green-600', Packaging: 'bg-orange-50 text-orange-600',
  Commercial: 'bg-gray-100 text-gray-500',
  Product: 'bg-teal-50 text-teal-600', Formula: 'bg-violet-50 text-violet-600',
  Format: 'bg-orange-50 text-orange-600', Markets: 'bg-blue-50 text-blue-600',
}

function displayVal(v) {
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// ── AutoFill Modal ────────────────────────────────────────────────────────────
function AutoFillModal({ brief, onApply, onClose }) {
  const [text,     setText]     = useState('')
  const [file,     setFile]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [result,     setResult]     = useState(null)
  const [accepted,   setAccepted]   = useState({})
  const [dragging,   setDragging]   = useState(false)
  const [mode,       setMode]       = useState('text')
  const [recording,  setRecording]  = useState(false)
  const [transcript, setTranscript] = useState('')
  const dropRef   = useRef(null)
  const fileRef   = useRef(null)
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])

  const isDrink  = brief.productType === 'drink'
  const schema   = isDrink ? DRINK_SCHEMA : SYRUP_SCHEMA
  const apiKey   = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''

  const readFile = (f) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setText(e.target.result)
    reader.readAsText(f)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) readFile(f)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setLoading(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'recording.webm')
          form.append('model', 'whisper-1')
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
          })
          const data = await res.json()
          const t = data.text || ''
          setTranscript(t)
          setText(t)
        } catch (e) { setError('Transcription failed — check your API key') }
        setLoading(false)
      }
      mr.start()
      setRecording(true)
    } catch (e) { setError('Microphone access denied') }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  const callOpenAI = async () => {
    const input = text.trim()
    if (!input) { setError('Paste some text or drop a file first.'); return }
    setLoading(true); setError(''); setResult(null)

    const systemPrompt = `You are a product brief extraction assistant for Bloomin, a functional food & drink company.
Extract information from the provided text (email thread, meeting transcript, or notes) and return ONLY a valid JSON object.
Only include fields where you found clear, relevant information. Do not guess or invent data.
Return null for fields you cannot determine. Do not include null fields in the output.
The product type is: ${isDrink ? 'DRINK (protein soda)' : 'SYRUP (flavoured syrup for coffee shops)'}.

JSON schema to populate:
${JSON.stringify(schema, null, 2)}`

    const userPrompt = `Extract brief information from this text and return a JSON object:

---
${input.slice(0, 12000)}
---

Return ONLY the JSON object, no explanation, no markdown code blocks.`

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.1,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `OpenAI error ${res.status}`)
      }

      const data = await res.json()
      const raw  = data.choices?.[0]?.message?.content?.trim() || ''

      // Strip markdown code fences if present
      const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(clean)

      // Remove null / empty values
      const filtered = {}
      Object.entries(parsed).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return
        if (Array.isArray(v) && v.length === 0) return
        filtered[k] = v
      })

      if (Object.keys(filtered).length === 0) {
        setError("OpenAI couldn't extract any fields from this text. Try a more detailed transcript or email.")
        setLoading(false); return
      }

      // Pre-select all fields
      const init = {}
      Object.keys(filtered).forEach(k => { init[k] = true })
      setAccepted(init)
      setResult(filtered)
    } catch (e) {
      setError(e.message || 'Something went wrong. Check your API key and try again.')
      console.error(e)
    }
    setLoading(false)
  }

  const applySelected = () => {
    const toApply = {}
    Object.entries(result).forEach(([k, v]) => {
      if (accepted[k]) toApply[k] = v
    })
    onApply(toApply)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-lg">✨</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Auto-fill brief</h2>
              <p className="text-xs text-gray-400 mt-0.5">Paste an email, drop a file, or speak — AI extracts the fields</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition text-2xl leading-none">×</button>
        </div>

        {!result ? (
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">

            {/* Mode tabs */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[['text','📝 Notes / paste'],['voice','🎙️ Voice']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-xs font-semibold transition ${mode === m ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'text' && (<>
              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragging ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}>
                <input ref={fileRef} type="file" accept=".txt,.md,.csv,.eml,.text" className="hidden"
                  onChange={e => e.target.files?.[0] && readFile(e.target.files[0])} />
                <span className="text-3xl">{file ? '📄' : '📎'}</span>
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{Math.round(file.size / 1024)}KB — click to replace</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Drop a .txt or .md file here</p>
                    <p className="text-xs text-gray-400 mt-0.5">or click to browse</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">or paste text</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setFile(null) }}
                placeholder={`Paste email thread, Slack messages, meeting notes...\n\ne.g. 'Hi, we're looking for a vanilla syrup for lattes. Should be lightly sweet, vegan friendly, and work well with oat milk. Samples by end of March, launch in June...'`}
                rows={7}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none text-gray-700 placeholder-gray-300"
              />
            </>)}

            {mode === 'voice' && (
              <div className="space-y-4">
                <div className={`rounded-2xl border-2 p-8 flex flex-col items-center gap-4 transition-all ${recording ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={loading}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all shadow-lg ${recording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-black text-white hover:bg-gray-800'}`}>
                    {recording ? '⏹' : '🎙️'}
                  </button>
                  <p className="text-sm font-semibold text-gray-700">
                    {recording ? 'Recording… click to stop' : 'Click to start recording'}
                  </p>
                  <p className="text-xs text-gray-400 text-center max-w-xs">
                    Describe the product — flavour, target market, dietary requirements, packaging preferences, dates. We'll transcribe and extract the fields automatically.
                  </p>
                </div>
                {transcript && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Transcript</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{transcript}</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">GPT-4o · {mode === 'voice' ? 'Whisper transcription' : `~${Math.round((text.length / 4))} tokens`}</p>
              <button onClick={callOpenAI} disabled={loading || !text.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-2xl hover:opacity-90 transition disabled:opacity-40 shadow-md shadow-violet-200">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {recording ? 'Transcribing…' : 'Extracting…'}</>
                ) : (
                  <><span>✨</span> Extract & fill brief</>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ── Review stage ── */
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-8 pt-5 pb-3 flex-shrink-0">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Found {Object.keys(result).length} fields — review and apply</p>
                  <p className="text-xs text-green-600 mt-0.5">Uncheck any fields you don't want to apply. Existing data will be overwritten.</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-2">
              {Object.entries(result).map(([key, val]) => {
                const step = FIELD_STEP[key]
                const stepColor = step ? (STEP_COLORS[step] || 'bg-gray-100 text-gray-500') : null
                return (
                  <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${accepted[key] ? 'border-violet-200 bg-violet-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <input type="checkbox" checked={accepted[key] || false}
                      onChange={e => setAccepted(a => ({ ...a, [key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-violet-500 flex-shrink-0 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{FIELD_LABELS[key] || key}</p>
                        {step && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stepColor}`}>{step}</span>}
                      </div>
                      <p className="text-sm text-gray-900 break-words">{displayVal(val)}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-white">
              <button onClick={() => { setResult(null); setError('') }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                ← Try again
              </button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">{Object.values(accepted).filter(Boolean).length} of {Object.keys(result).length} fields selected</p>
                <button onClick={applySelected} disabled={!Object.values(accepted).some(Boolean)}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-40">
                  Apply to brief ✓
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main BriefForm ────────────────────────────────────────────────────────────
export default function BriefForm({ brief, onStepChange }) {
  const isDrink = brief.productType === 'drink'
  const STEPS   = isDrink ? DRINK_STEPS : SYRUP_STEPS

  const [step,       setStep]       = useState(0)
  const [formData,   setFormData]   = useState(brief.formData || {})
  const [saving,     setSaving]     = useState(false)
  const [submitted,  setSubmitted]  = useState(brief.submitted || false)
  const [autoFill,   setAutoFill]   = useState(false)

  const StepComponent = STEPS[step].component
  const isLast = step === STEPS.length - 1

  const goToStep = (n) => {
    setStep(n)
    if (onStepChange) onStepChange(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stripFiles = (data) => ({
    ...data,
    referencePhotos: (data.referencePhotos || []).map(p => ({ name: p.name })),
  })

  const save = async (data) => {
    try { await updateDoc(doc(db, 'briefs', brief.id), { formData: stripFiles(data) }) }
    catch (e) { console.error('Auto-save failed', e) }
  }

  const handleChange = (data) => { setFormData(data); save(data) }
  const next = () => goToStep(step + 1)
  const back = () => goToStep(step - 1)

  const handleAutoFillApply = async (extracted) => {
    const merged = { ...formData, ...extracted }
    setFormData(merged)
    await save(merged)
    setAutoFill(false)
  }

  const handleSubmit = async () => {
    setSaving(true)
    const submittedAt = new Date().toISOString()
    const submittedBy = formData.contactName || formData.contact_npd?.name || ''
    const cleanData = {
      ...formData,
      referencePhotos: (formData.referencePhotos || []).map(p => ({ name: p.name })),
    }
    try {
      await updateDoc(doc(db, 'briefs', brief.id), { formData: cleanData, submitted: true, submittedAt, submittedBy })
      if (brief.productId) {
        await updateDoc(doc(db, 'products', brief.productId), {
          'stages.brief.status':      'complete',
          'stages.brief.completedAt': submittedAt,
          'stages.brief.completedBy': submittedBy,
          'stages.scoping.status':    'in-progress',
        })
      } else {
        const snap = await getDocs(query(collection(db, 'products'), where('briefId', '==', brief.id)))
        if (!snap.empty) {
          await updateDoc(doc(db, 'products', snap.docs[0].id), {
            'stages.brief.status':      'complete',
            'stages.brief.completedAt': submittedAt,
            'stages.brief.completedBy': submittedBy,
            'stages.scoping.status':    'in-progress',
          })
        }
      }
      setSubmitted(true)
    } catch (e) { alert('Something went wrong. Please try again.'); console.error(e) }
    setSaving(false)
  }

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
        {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-12 mx-auto object-contain" />}
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Brief received!</h1>
        <p className="text-gray-500">Thanks for filling this in. Our team will review everything and be in touch soon.</p>
      </div>
    </div>
  )

  return (
    <>
      {autoFill && (
        <AutoFillModal
          brief={brief}
          onApply={handleAutoFillApply}
          onClose={() => setAutoFill(false)}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-8 object-contain" onError={e => e.target.style.display='none'} />}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Product Brief</p>
                  <p className="text-sm font-bold text-gray-800">{brief.productName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Auto-fill button */}
                <button onClick={() => setAutoFill(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition">
                  ✨ Auto-fill
                </button>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{step + 1} / {STEPS.length}</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div className="flex mt-2 gap-1">
              {STEPS.map((s, i) => (
                <span key={s.label} className={`text-xs flex-1 text-center truncate transition-colors ${i === step ? 'text-green-600 font-semibold' : i < step ? 'text-gray-400' : 'text-gray-200'}`}>
                  {i < step ? '✓' : s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="text-3xl">{STEPS[step].emoji}</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest">Step {step + 1} of {STEPS.length}</p>
                <h2 className="text-xl font-bold text-gray-900">{STEPS[step].label}</h2>
              </div>
            </div>

            <StepComponent data={formData} onChange={handleChange} brief={brief} />

            <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
              {step > 0
                ? <button onClick={back} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">← Back</button>
                : <div />
              }
              {isLast ? (
                <button onClick={handleSubmit} disabled={saving}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-md disabled:opacity-50">
                  {saving ? 'Submitting...' : 'Submit brief ✓'}
                </button>
              ) : (
                <button onClick={next}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-md">
                  Next →
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Your answers save automatically as you go.</p>
        </div>
      </div>
    </>
  )
}