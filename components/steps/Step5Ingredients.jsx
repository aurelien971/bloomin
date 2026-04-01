import { useContext } from 'react'
import { FilterEmptyContext } from '../BriefForm'

function HideIfFilled({ keys, data, children }) {
  const filterEmpty = useContext(FilterEmptyContext)
  if (!filterEmpty) return children
  const isFilled = keys.some(k => {
    const v = data[k]
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })
  if (isFilled) return null
  return children
}

const DIETARY = ['Vegan', 'Vegetarian', 'Gluten-free', 'Nut-free', 'Dairy-free', 'None']
const SUGAR_BASE = ['White sugar', 'Brown sugar', 'Coconut sugar', 'Agave / nectar', 'Date sugar', 'Maple', 'Honey', 'Other']
const PRESERVATIVES = ['Accepted', 'Preferred without', 'No preservatives', 'Not sure']
const PRODUCT_CLAIMS = ['Vegan', 'Non-GMO', 'Fairtrade', 'Organic', 'Rainforest Alliance', 'None required']
const NUTRITIONAL_CLAIMS = [
  'Low sugar', 'No added sugar', 'Reduced sugar',
  'Low calorie', 'High fibre', 'High protein',
  'Low fat', 'No artificial sweeteners',
]
const HEALTH_CLAIMS = [
  'Gut health / digestive', 'Brain / focus / cognitive',
  'Sleep / relaxation', 'Energy / vitality',
  'Immune support', 'Adaptogenic / stress',
  'Antioxidant-rich', 'Bone health',
]

export default function Step5Ingredients({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })


  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(d => d !== item) : [...curr, item])
  }

  return (
    <div className="space-y-6">

      <HideIfFilled keys={['dietary']} data={data}>
      <Field label="Dietary requirements" hint="Select all that apply.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIETARY.map(o => (
            <Chip key={o} label={o} active={(data.dietary||[]).includes(o)} onClick={() => toggle('dietary', o)} />
          ))}
        </div>
      </Field>
      </HideIfFilled>

      <HideIfFilled keys={['sugarBase']} data={data}>
      <Field label="Sugar base preference" hint="What type of sweetener should we use? Select all that apply — leave blank if no preference.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SUGAR_BASE.map(o => {
            const curr = Array.isArray(data.sugarBase) ? data.sugarBase : (data.sugarBase ? [data.sugarBase] : [])
            const active = curr.includes(o)
            const toggle = () => set('sugarBase', active ? curr.filter(x => x !== o) : [...curr, o])
            return <Chip key={o} label={o} active={active} onClick={toggle} />
          })}
        </div>
        {(Array.isArray(data.sugarBase) ? data.sugarBase : [data.sugarBase]).includes('Other') && (
          <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Specify your preferred sweetener..." value={data.sugarBaseOther || ''} onChange={e => set('sugarBaseOther', e.target.value)} />
        )}
      </Field>
      </HideIfFilled>

      <HideIfFilled keys={['preservatives']} data={data}>
      <Field label="Preservatives">
        <div className="grid grid-cols-2 gap-2">
          {PRESERVATIVES.map(o => <Chip key={o} label={o} active={data.preservatives === o} onClick={() => set('preservatives', o)} />)}
        </div>
      </Field>
      </HideIfFilled>

      <HideIfFilled keys={['ingredientRestrictions']} data={data}>
      <Field label="Ingredient restrictions" hint="Any ingredients that are completely off the table.">
        <textarea rows={2} placeholder="e.g. No artificial colours or flavours, no refined sugars, no palm oil..."
          value={data.ingredientRestrictions || ''} onChange={e => set('ingredientRestrictions', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </Field>
      </HideIfFilled>

      <Field label="Known allergens to flag" hint="Anything that must be absent from the product or declared on the label.">
        <input placeholder="e.g. Must be nut-free, no sesame" value={data.allergens || ''} onChange={e => set('allergens', e.target.value)} />
      </Field>

      {/* Product claims */}
      <HideIfFilled keys={['productClaims']} data={data}>
      <Field label="Product claims" hint="Commercial claims you plan to make on the label or in marketing. Only select what you're committing to — each needs ingredient-level evidence.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRODUCT_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.productClaims||[]).includes(o)} onClick={() => toggle('productClaims', o)} />
          ))}
        </div>
      </Field>
      </HideIfFilled>

      {/* Required certifications — open text */}
      <HideIfFilled keys={['certRequired']} data={data}>
      <Field label="Are there any required manufacturing certifications?" hint="Only flag something if it would be a deal breaker. Leave blank if not essential.">
        <div className="flex gap-2 mb-2">
          {['Yes — required', 'No', 'Not sure'].map(o => (
            <Chip key={o} label={o} active={data.certRequired === o} onClick={() => set('certRequired', o)} />
          ))}
        </div>
        {data.certRequired === 'Yes — required' && (
          <input placeholder="e.g. SALSA, BRC Grade A, Organic certification..." value={data.certDetails || ''}
            onChange={e => set('certDetails', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        )}
      </Field>
      </HideIfFilled>

      {/* Nutritional claims */}
      <HideIfFilled keys={['nutritionalClaims']} data={data}>
      <Field label="Nutritional claims" hint="Regulated claims about nutrients — e.g. 'low sugar', 'high fibre'. These will be verified at lab testing stage.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NUTRITIONAL_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.nutritionalClaims||[]).includes(o)} onClick={() => toggle('nutritionalClaims', o)} />
          ))}
        </div>
        <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Any other nutritional claim..." value={data.nutritionalClaimsOther || ''} onChange={e => set('nutritionalClaimsOther', e.target.value)} />
      </Field>
      </HideIfFilled>

      {/* Health claims */}
      <HideIfFilled keys={['healthClaims']} data={data}>
      <Field label="Health / functional claims" hint="Any wellness positioning — e.g. 'supports focus', 'adaptogenic'. This directly affects which ingredients we can use.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {HEALTH_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.healthClaims||[]).includes(o)} onClick={() => toggle('healthClaims', o)} />
          ))}
        </div>
        <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Any other functional claim..." value={data.healthClaimsOther || ''} onChange={e => set('healthClaimsOther', e.target.value)} />
      </Field>
      </HideIfFilled>

    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-800">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className="[&_input]:w-full [&_input]:px-4 [&_input]:py-3 [&_input]:rounded-xl [&_input]:border [&_input]:border-gray-200 [&_input]:text-sm [&_input]:focus:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-green-400">
        {children}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}