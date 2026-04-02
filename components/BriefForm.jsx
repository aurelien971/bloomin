import { useState, useRef, createContext, useContext } from 'react'
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
// ── Filter empty context — shared with step components ───────────────────────
export const FilterEmptyContext = createContext(false)
export function useFilterEmpty() { return useContext(FilterEmptyContext) }

const SYRUP_SCHEMA = {
  // Overview
  productName:            'string — product name if mentioned',
  productType:            'one of: One-time / LTO | Recurring / permanent | Seasonal (recurring annually) | Don\'t know yet',
  productPurpose:         'string — why this product, what opportunity',
  inspiration:            'string — any reference products or brands',
  samplesNeededBy:        'string — YYYY-MM-DD; if no year given assume current or next year (never past)',
  launchDate:             'string — YYYY-MM-DD; if no year given assume current or next year (never past)',
  distributorDate:        'string — YYYY-MM-DD; if no year given assume current or next year (never past)',
  // Flavour
  primaryFlavour:         'string — dominant flavour',
  secondaryFlavour:       'string — secondary flavour notes',
  flavourExclusions:      'string — flavours to avoid; also extract from Organoleptic Standards REJECT column taste descriptors (e.g. "Fermented, yeasty, musty, metallic, overly sour/sharp" → "No fermented, yeasty, musty or metallic notes")',
  sweetness:              'one of: Very sweet | Sweet | Balanced | Lightly sweet | Barely sweet',
  acidity:                'one of: None | Low | Medium | High',
  aftertaste:             'string — finish / aftertaste description',
  hasFlavouringReq:       'one of: Yes | No',
  flavouringTypes:        'array of: Natural flavouring | Natural identical | Artificial | No preference',
  colourReference:        'string — colour reference or description',
  // Appearance
  syrupColour:            'string — colour of the syrup in the bottle',
  endDrinkColour:         'string — colour in the finished drink',
  endDrinkType:           'string — type of drink e.g. latte, matcha, cocktail',
  clarity:                'array of: Crystal clear | Slightly hazy | Opaque | Thick & opaque | Grainy / textured',
  // Usage
  uses:                   'array of: Hot milk drinks | Cold milk drinks | Still water | Sparkling water / soda | Cocktails / mocktails | Matcha / powder drinks',
  milkTypes:              'array of milk types mentioned',
  doseRate:               'string — dose rate e.g. 15ml per 250ml',
  servingSizeRatio:       'string — serving size context',
  // Ingredients
  dietary:                'array of: Vegan | Vegetarian | Gluten-free | Nut-free | Dairy-free | None — infer from product description (e.g. "contains no animal products" → Vegan)',
  sugarBase:              'array — ALL matching from: White sugar | Brown sugar | Coconut sugar | Agave / nectar | Date sugar | Maple | Honey | Other — infer ALL from ingredient declarations (e.g. "Agave Syrup, Coconut Sugar" → ["Agave / nectar", "Coconut sugar"])',
  preservatives:          'one of: Accepted | Preferred without | No preservatives | Not sure — infer from ingredient list (Potassium Sorbate / Sodium Benzoate present → "Accepted")',
  allergens:              'string — allergen statement, "None" if declared allergen-free',
  ingredientRestrictions: 'string — any ingredient exclusions or restrictions',
  productClaims:          'array of: Vegan | Non-GMO | Fairtrade | Organic | Rainforest Alliance | None required — infer from dietary (if dietary includes Vegan → include Vegan here too), from "Non-GM materials" → Non-GMO, from organic certification → Organic',
  healthClaims:           'array of: No added sugar | Low sugar | Low calorie | No artificial colours | No artificial flavours | Free from',
  nutritionalClaims:      'array of: High fibre | Source of protein | High protein | Vitamin C | Iron | Calcium',
  certRequired:           'one of: Yes — must have | Nice to have | No — not needed',
  certDetails:            'string — certification body and certificate number if mentioned',
  certifications:         'array of: SALSA | BRC | Organic | Vegan Society | Kosher | Halal | None needed — infer from Manufacturer Certification or cert body fields',
  // Packaging
  standardBottleOk:       'one of: Yes | No — I need something different — if Bottle Size is 750ml AND Bottle Type is Glass → "Yes", if bottle size differs or format differs → "No — I need something different"',
  bottleAlternative:      'string — describe alternative if not standard 750ml glass',
  pumpCompatible:         'one of: Yes | No | No preference — if Pump Size is mentioned → "Yes", if lid type is mentioned without pump → "No"',
  storage:                'one of: Ambient | Refrigerated | Not sure — "cool dry place" / "ambient" / "≤20°C" → Ambient',
  shelfLifeUnopened:      'one of: 3 months | 6 months | 12 months | 18 months | 24 months | Other — prefer TARGET shelf life, ignore trial batch (e.g. "Target: 6 months unopened" → "6 months")',
  shelfLifeOpen:          'one of: 7 days | 2 weeks | 3 weeks | 4 weeks (1 month) | 6 weeks | 2 months | 3 months | Other — prefer TARGET ("Target: 1 month after opening" → "4 weeks (1 month)", "21 day open" → "3 weeks")',
  // Commercial
  markets:                'array of country/region names — "Global" → ["UK", "USA", "EU", "GCC"]',
  targetCostMin:          'number — min cost per bottle in GBP; if only one price known, use it for both min and max',
  targetCostMax:          'number — max cost per bottle in GBP; if only one price known, use the same value as targetCostMin',
  targetRrp:              'number — target retail price per bottle in GBP if available, else primary market price (e.g. UK Price 7.90 GBP → 7.90)',
  priceCurrency:          'one of: GBP | USD | EUR — currency of the primary price',
  casesPerMonth:          'string — estimated monthly volume; sum forecasts if per-market volumes given (e.g. UK 1400L + EU 2700L + USA 1600L over period → estimate monthly cases)',
  servingSizeRatio:       'string — serving size from "Product Serving Size" field (e.g. "30ml per serve")',
  sampleStreet:           'string — delivery street address',
  sampleCity:             'string — delivery city',
  samplePostcode:         'string — delivery postcode',
  sampleCountry:          'string — delivery country',
  contact_npd:            'object — { name: string, email: string, title: string }',
  contact_supplyChain:    'object — { name: string, email: string, title: string }',
  contact_technical:      'object — { name: string, email: string, title: string }',
  anythingElse:           'string — other notes: whitelabel info, label template, lid type, case size, sign-off date etc.',
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
  // Syrup — Overview
  productName: 'Product name', productType: 'Product type (LTO?)', productPurpose: 'Purpose',
  inspiration: 'Inspiration', samplesNeededBy: 'Sample date', launchDate: 'Launch date', distributorDate: 'Distributor date',
  // Flavour
  primaryFlavour: 'Primary flavour', secondaryFlavour: 'Secondary notes', flavourExclusions: 'Flavour exclusions',
  sweetness: 'Sweetness', acidity: 'Acidity', aftertaste: 'Aftertaste',
  hasFlavouringReq: 'Flavouring requirement', flavouringTypes: 'Flavouring types', colourReference: 'Colour reference',
  // Appearance
  syrupColour: 'Syrup colour', endDrinkColour: 'End drink colour', endDrinkType: 'End drink type', clarity: 'Clarity',
  // Usage
  uses: 'Uses', milkTypes: 'Milk types', doseRate: 'Dose rate', servingSizeRatio: 'Serving size',
  // Ingredients
  dietary: 'Dietary', sugarBase: 'Sugar base', preservatives: 'Preservatives',
  allergens: 'Allergens', ingredientRestrictions: 'Restrictions',
  productClaims: 'Product claims',
  healthClaims: 'Health claims', nutritionalClaims: 'Nutritional claims',
  certRequired: 'Cert required?', certDetails: 'Cert details', certifications: 'Certifications',
  // Packaging
  standardBottleOk: 'Standard bottle?', bottleAlternative: 'Alternative format', pumpCompatible: 'Pump compatible',
  storage: 'Storage', shelfLifeUnopened: 'Shelf life (unopened)', shelfLifeOpen: 'Shelf life (open)',
  // Commercial
  markets: 'Markets', targetCostMin: 'Cost min', targetCostMax: 'Cost max', targetRrp: 'Target RRP', priceCurrency: 'Currency',
  casesPerMonth: 'Volume (cases/mo)',
  sampleStreet: 'Delivery street', sampleCity: 'Delivery city', samplePostcode: 'Postcode', sampleCountry: 'Country',
  contact_npd: 'NPD contact', contact_supplyChain: 'Supply chain contact', contact_technical: 'Technical contact',
  anythingElse: 'Other notes',
  // Drink-specific
  flavourDirection: 'Flavour direction', proteinTarget: 'Protein (g)', proteinBlend: 'Protein blend',
  electrolytes: 'Electrolytes', electrolytesDetail: 'Electrolyte detail', sweetener: 'Sweetener',
  carbonation: 'Carbonation', formulaRestrictions: 'Formula restrictions', colourDirection: 'Colour direction',
  visualReference: 'Visual refs', format: 'Format', occasions: 'Occasions', channels: 'Channels',
  shelfLife: 'Shelf life', functionalClaims: 'Functional claims', labelClaims: 'Label claims',
  allergenNotes: 'Allergen notes', initialVolume: 'Initial volume',
}

// ── Field → Step mapping ──────────────────────────────────────────────────────
const FIELD_STEP = {
  // Syrup — Overview
  productName: 'Overview', productType: 'Overview', productPurpose: 'Overview',
  inspiration: 'Overview', samplesNeededBy: 'Overview', launchDate: 'Overview', distributorDate: 'Overview',
  // Flavour
  primaryFlavour: 'Flavour', secondaryFlavour: 'Flavour', flavourExclusions: 'Flavour',
  sweetness: 'Flavour', acidity: 'Flavour', aftertaste: 'Flavour',
  hasFlavouringReq: 'Flavour', flavouringTypes: 'Flavour', colourReference: 'Flavour',
  // Appearance
  syrupColour: 'Appearance', endDrinkColour: 'Appearance', endDrinkType: 'Appearance', clarity: 'Appearance',
  // Usage
  uses: 'Usage', milkTypes: 'Usage', doseRate: 'Usage', servingSizeRatio: 'Usage',
  // Ingredients
  dietary: 'Ingredients', sugarBase: 'Ingredients', preservatives: 'Ingredients',
  allergens: 'Ingredients', ingredientRestrictions: 'Ingredients',
  healthClaims: 'Ingredients', nutritionalClaims: 'Ingredients',
  certRequired: 'Ingredients', certDetails: 'Ingredients', certifications: 'Ingredients',
  // Packaging
  standardBottleOk: 'Packaging', bottleAlternative: 'Packaging', pumpCompatible: 'Packaging',
  storage: 'Packaging', shelfLifeUnopened: 'Packaging', shelfLifeOpen: 'Packaging',
  // Commercial
  markets: 'Packaging',
  targetCostMin: 'Commercial', targetCostMax: 'Commercial', targetRrp: 'Commercial', priceCurrency: 'Commercial',
  casesPerMonth: 'Commercial', servingSizeRatio: 'Usage',
  sampleStreet: 'Commercial', sampleCity: 'Commercial', samplePostcode: 'Commercial', sampleCountry: 'Commercial',
  contact_npd: 'Commercial', contact_supplyChain: 'Commercial', contact_technical: 'Commercial',
  anythingElse: 'Commercial',
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
function AutoFillModal({ brief, onApply, onClose, reviewMode, lastExtraction }) {
  const [files,      setFiles]      = useState([])
  const [pastedImages, setPastedImages] = useState([])
  const [text,       setText]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [result,     setResult]     = useState(() => {
    if (reviewMode && lastExtraction) return { merged: lastExtraction.fields, isReview: true }
    return null
  })
  const [accepted,   setAccepted]   = useState(() => {
    if (reviewMode && lastExtraction) {
      const init = {}
      Object.keys(lastExtraction.fields).forEach(k => { init[k] = true })
      return init
    }
    return {}
  })
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
  const apiKey   = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
  const openAiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''

  const extractPdfText = (data) => new Promise((resolve, reject) => {
    const PDFJS_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    const run = () => {
      const lib = window['pdfjs-dist/build/pdf']
      if (!lib) { reject(new Error('PDF.js unavailable')); return }
      lib.GlobalWorkerOptions.workerSrc = WORKER_URL
      lib.getDocument({ data }).promise.then(async (pdf) => {
        let out = ''
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p)
          const content = await page.getTextContent()
          out += content.items.map(i => i.str).join(' ') + '\n'
        }
        resolve(out.trim())
      }).catch(reject)
    }
    if (window['pdfjs-dist/build/pdf']) { run() }
    else {
      const s = document.createElement('script')
      s.src = PDFJS_URL; s.onload = run
      s.onerror = () => reject(new Error('Could not load PDF.js'))
      document.head.appendChild(s)
    }
  })

  const readFileText = async (f) => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (ext === 'pdf') {
      const ab = await f.arrayBuffer()
      return await extractPdfText(new Uint8Array(ab))
    }
    return await new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => res(e.target.result)
      r.onerror = rej
      r.readAsText(f)
    })
  }

  const addFiles = async (fileList) => {
    for (const f of Array.from(fileList)) {
      const id = f.name + '-' + Date.now()
      setFiles(prev => [...prev, { id, name: f.name, text: '', status: 'reading' }])
      try {
        const t = await readFileText(f)
        if (!t.trim()) throw new Error('No text extracted')
        setFiles(prev => prev.map(x => x.id === id ? { ...x, text: t, status: 'ready' } : x))
      } catch (e) {
        setFiles(prev => prev.map(x => x.id === id ? { ...x, status: 'error', error: e.message } : x))
      }
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read()
      let found = false
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          found = true
          const blob = await item.getType(imageType)
          const reader = new FileReader()
          reader.onload = (e) => {
            const b64 = e.target.result.split(',')[1]
            const id  = 'paste-' + Date.now()
            const label = `Screenshot ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            setPastedImages(prev => [...prev, { id, b64, mime: imageType, label }])
          }
          reader.readAsDataURL(blob)
        }
      }
      if (!found) setError('No image found in clipboard — try copying a screenshot first.')
    } catch (e) {
      setError('Could not access clipboard. Try taking a screenshot and dropping it as a file instead.')
    }
  }

  const removePastedImage = (id) => setPastedImages(prev => prev.filter(p => p.id !== id))

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

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
            headers: { Authorization: `Bearer ${openAiKey}` },
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

  const extractFields = async (inputText, image = null) => {
    const systemPrompt = `You are a product brief extraction assistant for Bloomin, a functional food & drink company.
Extract information from the provided input (brief, email, spec sheet, PDF, or image) and return ONLY a valid JSON object.
Only include fields where you found clear or reasonably inferable information. Do not invent data.
Return null for fields you cannot determine. Do not include null fields in the output.
The product type is: ${isDrink ? 'DRINK (protein soda)' : 'SYRUP (flavoured syrup for coffee shops)'}.

Important inference rules — apply ALL of these:

DATES: Today is ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}. When a date is mentioned without a year, always assume the current year (${new Date().getFullYear()}) unless the month has already passed — in that case assume next year (${new Date().getFullYear() + 1}). For example, if today is April 2026 and the doc says "launch January" → assume January ${new Date().getFullYear() + 1}. If it says "launch June" → assume June ${new Date().getFullYear()}. Never output a date in the past unless it is explicitly stated as historical. Always output dates as YYYY-MM-DD.

FLAVOUR EXCLUSIONS: Extract from both explicit exclusion fields AND from organoleptic standards — the REJECT column taste descriptors describe what must NOT be present. Summarise these as flavour exclusions.

SUGAR BASE: Extract ALL sugars from ingredient list as an array. "Agave Syrup" → "Agave / nectar", "Coconut Sugar" → "Coconut sugar", "Honey" → "Honey" etc.

DIETARY & PRODUCT CLAIMS: If dietary includes Vegan, also add "Vegan" to productClaims. "Non-GM materials" / "Non-GMO" → productClaims includes "Non-GMO". Organic certification → productClaims includes "Organic".

PRESERVATIVES: Potassium Sorbate, Sodium Benzoate, Citric Acid used as preservative → "Accepted". "No preservatives" stated → "No preservatives".

BOTTLE: If Bottle Size = 750ml AND Bottle Type = Glass (or "Glass Bottle") → standardBottleOk = "Yes". If different size or format → "No — I need something different". Any pump size mentioned → pumpCompatible = "Yes".

STORAGE: "cool dry place", "ambient", "store at ≤20°C", "room temperature" → storage = "Ambient". "refrigerate" / "chilled" → "Refrigerated".

SHELF LIFE: ALWAYS prefer TARGET shelf life over trial batch. "Target: 6 months unopened" → shelfLifeUnopened = "6 months". "Target: 1 month after opening" or "1 month open" → shelfLifeOpen = "4 weeks". "21 days open" → shelfLifeOpen = "4 weeks". ONLY valid shelfLifeOpen values: 7 days | 2 weeks | 4 weeks | 3 months | Other.

PRICING: UK Price → targetRrp in GBP. If multiple market prices, use UK Price for targetRrp. Extract priceCurrency from the price currency mentioned.

MARKETS: "Global" → ["UK", "USA", "EU", "GCC"]. Extract individual countries/regions if listed. "Franchisees" means broader international.

VOLUME: If per-market forecasts given in litres over a period, convert to approximate monthly cases (1 case = 6 × 750ml = 4.5L). Sum all markets. E.g. UK 1400L + EU 2700L + USA 1600L over ~2.5 months = 5700L / 2.5 months ÷ 4.5L per case ≈ 507 cases/month.

SERVING SIZE: "Product Serving Size 30ml" → servingSizeRatio = "30ml per serve".

PRODUCT TYPE: "LTO", "Limited Time", "Seasonal" → productType = "One-time / LTO". "Summer LTO" → productType = "One-time / LTO".

CERTIFICATIONS: Extract from "Manufacturer's Certification", "Certification Body" fields. "SALSA" → certifications includes "SALSA".

ANYTHING ELSE: Put whitelabel info, label template details, lid type, case size, sign-off dates into anythingElse.

Product title/name from Legal Title, Product Title, or Product Name fields.

JSON schema to populate:
${JSON.stringify(schema, null, 2)}`

    let userContent
    if (image) {
      userContent = [
        { type: 'text', text: 'Extract brief information from this image and return a JSON object. Return ONLY the JSON, no explanation, no markdown.' },
        { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.b64}` } },
      ]
    } else {
      userContent = `Extract brief information from this input and return a JSON object:\n\n---\n${inputText.slice(0, 14000)}\n---\n\nReturn ONLY the JSON object, no explanation, no markdown.`
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Anthropic ${res.status}`) }
    const data = await res.json()
    const raw  = data.content?.[0]?.text?.trim() || ''
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)
    const filtered = {}
    Object.entries(parsed).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return
      if (Array.isArray(v) && v.length === 0) return
      filtered[k] = v
    })
    return filtered
  }

  const callOpenAI = async () => {
    const readyFiles = files.filter(f => f.status === 'ready')
    const pasteText  = text.trim()
    const sources    = [
      ...readyFiles.map(f => ({ label: f.name, type: 'text', text: f.text })),
      ...pastedImages.map(p => ({ label: p.label, type: 'image', b64: p.b64, mime: p.mime })),
      ...(pasteText ? [{ label: 'Pasted text', type: 'text', text: pasteText }] : []),
    ]
    if (sources.length === 0) { setError('Add at least one file, paste a screenshot, or type some text first.'); return }
    setLoading(true); setError(''); setResult(null)

    try {
      let merged = {}
      for (const source of sources) {
        try {
          let extracted
          if (source.type === 'image') {
            extracted = await extractFields(null, { b64: source.b64, mime: source.mime })
          } else {
            extracted = await extractFields(source.text)
          }
          Object.entries(extracted).forEach(([k, v]) => {
            if (merged[k] === undefined || merged[k] === null || merged[k] === '') merged[k] = v
          })
        } catch (e) { console.warn('Extraction failed for', source.label, e.message) }
      }

      if (Object.keys(merged).length === 0) {
        setError("Couldn't extract any fields. Try more detailed content.")
        setLoading(false); return
      }

      const init = {}
      Object.keys(merged).forEach(k => { init[k] = true })
      setAccepted(init)
      setResult({ merged })
    } catch (e) {
      setError(e.message || 'Something went wrong. Check your API key.')
      console.error(e)
    }
    setLoading(false)
  }

  const applySelected = () => {
    const source = result.merged || result  // handle both review and fresh extraction
    const toApply = {}
    Object.entries(source).forEach(([k, v]) => {
      if (k === 'isReview') return  // skip meta field
      if (accepted[k]) toApply[k] = v
    })
    const sourceLabels = [...files.filter(f => f.status === 'ready').map(f => f.name), ...pastedImages.map(p => p.label), ...(text.trim() ? ['Pasted text'] : [])]
    onApply(toApply, sourceLabels)
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
              {/* Drop zone + paste button row */}
              <div className="flex gap-2">
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex-1 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragging ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}>
                  <input ref={fileRef} type="file" accept=".txt,.md,.csv,.eml,.text,.pdf" multiple className="hidden"
                    onChange={e => e.target.files?.length && addFiles(e.target.files)} />
                  <span className="text-2xl">📎</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Drop files here</p>
                    <p className="text-xs text-gray-400 mt-0.5">.txt · .md · .pdf · .csv</p>
                  </div>
                </div>
                {/* Paste screenshot button */}
                <button onClick={pasteImage}
                  className="flex flex-col items-center justify-center gap-2 px-5 py-5 border-2 border-dashed border-gray-200 rounded-2xl hover:border-violet-400 hover:bg-violet-50 transition group flex-shrink-0 w-36">
                  <span className="text-2xl">📋</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600 group-hover:text-violet-700">Paste image</p>
                    <p className="text-xs text-gray-400 mt-0.5">⌘V / Ctrl+V</p>
                  </div>
                </button>
              </div>

              {/* File + image queue */}
              {(files.length > 0 || pastedImages.length > 0) && (
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                      f.status === 'ready'   ? 'border-green-200 bg-green-50' :
                      f.status === 'error'   ? 'border-red-200 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      <span className="text-base flex-shrink-0">
                        {f.status === 'reading' ? '⏳' : f.status === 'error' ? '⚠️' : f.name.endsWith('.pdf') ? '📄' : '📝'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{f.name}</p>
                        <p className={`text-xs mt-0.5 ${f.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                          {f.status === 'reading' ? 'Extracting text…' :
                           f.status === 'error'   ? (f.error || 'Failed to read') :
                           `${f.text.split(' ').length} words extracted`}
                        </p>
                      </div>
                      <button onClick={() => removeFile(f.id)}
                        className="text-gray-300 hover:text-red-500 transition text-lg leading-none flex-shrink-0">×</button>
                    </div>
                  ))}
                  {pastedImages.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-violet-200 bg-violet-50">
                      <span className="text-base flex-shrink-0">🖼️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.label}</p>
                        <p className="text-xs text-violet-500 mt-0.5">Image ready · sent to GPT-4o vision</p>
                      </div>
                      <button onClick={() => removePastedImage(p.id)}
                        className="text-gray-300 hover:text-red-500 transition text-lg leading-none flex-shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">and / or paste text</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Paste email thread, Slack messages, meeting notes...\n\ne.g. 'Hi, we're looking for a vanilla syrup for lattes. Should be lightly sweet, vegan friendly, and work well with oat milk. Samples by end of March, launch in June...'`}
                rows={5}
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
              <p className="text-xs text-gray-400">
                {mode === 'voice' ? 'GPT-4o · Whisper transcription' : (() => {
                  const readyFiles = files.filter(f => f.status === 'ready').length
                  const hasPaste   = text.trim().length > 0
                  const total      = readyFiles + pastedImages.length + (hasPaste ? 1 : 0)
                  if (total === 0) return 'GPT-4o · add files, paste a screenshot, or type'
                  return `GPT-4o · ${total} source${total !== 1 ? 's' : ''} ready — fields will be merged`
                })()}
              </p>
              <button onClick={callOpenAI} disabled={loading || (files.filter(f => f.status === 'ready').length === 0 && pastedImages.length === 0 && !text.trim())}
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
              <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${result.isReview ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                <span className="text-lg">{result.isReview ? '🕐' : '🎉'}</span>
                <div>
                  <p className={`text-sm font-semibold ${result.isReview ? 'text-blue-800' : 'text-green-800'}`}>
                    {result.isReview ? 'Last extraction — re-apply or adjust' : `Found ${Object.keys(result.merged || result).filter(k => k !== 'isReview').length} fields — review and apply`}
                  </p>
                  <p className={`text-xs mt-0.5 ${result.isReview ? 'text-blue-600' : 'text-green-600'}`}>
                    {result.isReview
                      ? `Applied at ${lastExtraction?.appliedAt}${lastExtraction?.sources?.length ? ' · Sources: ' + lastExtraction.sources.join(', ') : ''}`
                      : `Uncheck anything you don't want applied.`
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-2">
              {Object.entries(result.merged || result).filter(([k]) => k !== 'isReview').map(([key, val]) => {
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
              <button onClick={() => { setResult(null); setError(''); setPastedImages([]); setFiles([]); setText('') }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                {result.isReview ? '+ New extraction' : '← Try again'}
              </button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">{Object.values(accepted).filter(Boolean).length} of {Object.keys(result.merged || result).filter(k => k !== 'isReview').length} fields selected</p>
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
  const [autoFill,      setAutoFill]      = useState(false)
  const [showEmptyOnly, setShowEmptyOnly] = useState(false)

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

  const [lastExtraction, setLastExtraction] = useState(brief.lastExtraction || null) // persisted to Firestore

  const handleAutoFillApply = async (extracted, sources) => {
    // Single price → set as both min and max
    if (extracted.targetRrp && !extracted.targetCostMin && !extracted.targetCostMax) {
      extracted.targetCostMin = extracted.targetRrp
      extracted.targetCostMax = extracted.targetRrp
    }
    if (extracted.targetCostMin && !extracted.targetCostMax) extracted.targetCostMax = extracted.targetCostMin
    if (extracted.targetCostMax && !extracted.targetCostMin) extracted.targetCostMin = extracted.targetCostMax

    // contacts need deep merge not overwrite
    const contactKeys = ['contact_npd', 'contact_supplyChain', 'contact_technical']
    const mergeContacts = {}
    contactKeys.forEach(k => {
      if (extracted[k]) mergeContacts[k] = { ...(formData[k] || {}), ...extracted[k] }
    })

    // Normalise standardBottleOk — AI sometimes returns 'Yes' instead of full label
    if (extracted.standardBottleOk === 'Yes') extracted.standardBottleOk = 'Yes — standard 750ml glass bottle'
    if (extracted.standardBottleOk === 'No') extracted.standardBottleOk = 'No — I need something different'
    // Normalise pumpCompatible
    if (extracted.pumpCompatible === 'Yes' || extracted.pumpCompatible === 'yes') extracted.pumpCompatible = 'Yes'
    // Single price → set as both min and max (already done above but also handle targetRrp only)
    if (extracted.targetCostMin && !extracted.targetCostMax) extracted.targetCostMax = extracted.targetCostMin
    if (extracted.targetCostMax && !extracted.targetCostMin) extracted.targetCostMin = extracted.targetCostMax
    if (extracted.targetRrp && !extracted.targetCostMin && !extracted.targetCostMax) {
      extracted.targetCostMin = extracted.targetRrp
      extracted.targetCostMax = extracted.targetRrp
    }

    const merged = { ...formData, ...extracted, ...mergeContacts }
    setFormData(merged)
    const extraction = { fields: extracted, sources, appliedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
    setLastExtraction(extraction)
    await save(merged)
    try { await updateDoc(doc(db, 'briefs', brief.id), { lastExtraction: extraction }) } catch(e) {}
    setAutoFill(false)
  }

  const [editingSubmitted, setEditingSubmitted] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    const submittedAt = new Date().toISOString()
    const submittedBy = formData.contactName || formData.contact_npd?.name || ''
    const cleanData = {
      ...formData,
      referencePhotos: (formData.referencePhotos || []).map(p => ({ name: p.name })),
    }
    try {
      await updateDoc(doc(db, 'briefs', brief.id), { formData: cleanData, submitted: true, submittedAt: editingSubmitted ? (brief.submittedAt || submittedAt) : submittedAt, submittedBy })
      if (!editingSubmitted) {
        // Only update pipeline stages on first submission
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
      }
      setSubmitted(true)
      setEditingSubmitted(false)
    } catch (e) { alert('Something went wrong. Please try again.'); console.error(e) }
    setSaving(false)
  }

  if (submitted && !editingSubmitted) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
        {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-12 mx-auto object-contain" />}
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Brief submitted</h1>
        <p className="text-gray-500">Thanks for filling this in. Our team will review everything and be in touch soon.</p>
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3">Need to change something?</p>
          <button
            onClick={() => setEditingSubmitted(true)}
            className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            ✏️ Edit brief
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {(autoFill === true || autoFill === 'review') && (
        <AutoFillModal
          brief={brief}
          onApply={(extracted, sources) => handleAutoFillApply(extracted, sources)}
          onClose={() => setAutoFill(false)}
          reviewMode={autoFill === 'review'}
          lastExtraction={lastExtraction}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
            {/* Re-edit banner */}
            {editingSubmitted && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-amber-800">✏️ Editing a submitted brief — changes save immediately</p>
                <button onClick={() => setEditingSubmitted(false)}
                  className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900 transition flex-shrink-0">
                  Done editing
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-8 object-contain" onError={e => e.target.style.display='none'} />}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Product Brief</p>
                  <p className="text-sm font-bold text-gray-800">{brief.productName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Empty-only toggle */}
                {Object.keys(formData).length > 0 && (
                  <button onClick={() => setShowEmptyOnly(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${showEmptyOnly ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
                    {showEmptyOnly ? '✓ Empty only' : '⚡ Show empty only'}
                  </button>
                )}
                {/* Auto-fill button */}
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setAutoFill(lastExtraction ? 'review' : true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition">
                    ✨ Auto-fill{lastExtraction ? ' ·  last at ' + lastExtraction.appliedAt : ''}
                  </button>
                  {lastExtraction && (
                    <button onClick={() => setAutoFill(true)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
                      title="New extraction">
                      + New
                    </button>
                  )}
                </div>
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

            {showEmptyOnly && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <p className="text-xs font-semibold text-amber-800">Showing empty fields only — fields already filled are hidden</p>
                <button onClick={() => setShowEmptyOnly(false)} className="ml-auto text-xs text-amber-600 underline underline-offset-2 hover:text-amber-900 transition">Show all</button>
              </div>
            )}

            <FilterEmptyContext.Provider value={showEmptyOnly}>
              <StepComponent data={formData} onChange={handleChange} brief={brief} filterEmpty={showEmptyOnly} />
            </FilterEmptyContext.Provider>

            <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
              {step > 0
                ? <button onClick={back} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">← Back</button>
                : <div />
              }
              {isLast ? (
                <button onClick={handleSubmit} disabled={saving}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-md disabled:opacity-50">
                  {saving ? 'Saving...' : editingSubmitted ? 'Save changes ✓' : 'Submit brief ✓'}
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