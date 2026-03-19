const DIETARY     = ['Vegan', 'Vegetarian', 'Gluten-free', 'Nut-free', 'Dairy-free', 'Kosher', 'Halal', 'None']
const SUGAR_BASE  = ['White sugar', 'Brown sugar', 'Coconut sugar', 'Agave', 'No added sugar', 'No preference']
const PRESERVATIVES = ['Accepted', 'Preferred without', 'No preservatives', 'Not sure']
const PRODUCT_CLAIMS = ['Vegan', 'Non-GMO', 'Fairtrade', 'Kosher', 'Organic', 'Rainforest Alliance', 'None required']
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

      <Field label="Dietary requirements" hint="Select all that apply — these drive ingredient sourcing and label claims.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIETARY.map(o => (
            <Chip key={o} label={o} active={(data.dietary||[]).includes(o)} onClick={() => toggle('dietary', o)} />
          ))}
        </div>
      </Field>

      <Field label="Sugar base preference">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUGAR_BASE.map(o => <Chip key={o} label={o} active={data.sugarBase === o} onClick={() => set('sugarBase', o)} />)}
        </div>
      </Field>

      <Field label="Preservatives">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
          {PRESERVATIVES.map(o => <Chip key={o} label={o} active={data.preservatives === o} onClick={() => set('preservatives', o)} />)}
        </div>
      </Field>

      <Field label="Ingredient restrictions" hint="Any ingredients that are completely off the table — no refined sugars, no artificial additives, etc.">
        <textarea
          rows={2}
          placeholder="e.g. No artificial colours or flavours, no refined sugars, no palm oil..."
          value={data.ingredientRestrictions || ''}
          onChange={e => set('ingredientRestrictions', e.target.value)}
        />
      </Field>

      <Field label="Known allergens to flag" hint="Anything that must be absent or flagged on the label.">
        <input
          placeholder="e.g. Must be nut-free, no sesame"
          value={data.allergens || ''}
          onChange={e => set('allergens', e.target.value)}
        />
      </Field>

      {/* ── New: Product claims ─────────────────────────────────────── */}
      <Field
        label="Product claims"
        hint="Commercial claims you'll be making on the label or in marketing. Each claim requires ingredient-level evidence — select only what you're committing to."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRODUCT_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.productClaims||[]).includes(o)} onClick={() => toggle('productClaims', o)} />
          ))}
        </div>
      </Field>

      {/* ── New: Nutritional claims ─────────────────────────────────── */}
      <Field
        label="Nutritional claims"
        hint="Any regulated claims about nutrients — e.g. 'low sugar', 'high fibre'. These need to be verified at lab testing stage."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NUTRITIONAL_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.nutritionalClaims||[]).includes(o)} onClick={() => toggle('nutritionalClaims', o)} />
          ))}
        </div>
        {/* Free text for anything not listed */}
        <input
          className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Any other nutritional claim not listed above..."
          value={data.nutritionalClaimsOther || ''}
          onChange={e => set('nutritionalClaimsOther', e.target.value)}
        />
      </Field>

      {/* ── New: Health claims ──────────────────────────────────────── */}
      <Field
        label="Health / functional claims"
        hint="Any functional or wellness positioning — e.g. 'supports focus', 'adaptogenic', 'gut health'. These directly affect which ingredients Dima can and can't use."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {HEALTH_CLAIMS.map(o => (
            <Chip key={o} label={o} active={(data.healthClaims||[]).includes(o)} onClick={() => toggle('healthClaims', o)} />
          ))}
        </div>
        <input
          className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Any other functional positioning or claim..."
          value={data.healthClaimsOther || ''}
          onChange={e => set('healthClaimsOther', e.target.value)}
        />
      </Field>

    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-800">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className="[&_input]:w-full [&_input]:px-4 [&_input]:py-3 [&_input]:rounded-xl [&_input]:border [&_input]:border-gray-200 [&_input]:text-sm [&_input]:focus:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-green-400 [&_textarea]:w-full [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-gray-200 [&_textarea]:text-sm [&_textarea]:focus:outline-none [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-green-400 [&_textarea]:resize-none">
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