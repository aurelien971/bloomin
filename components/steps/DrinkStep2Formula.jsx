const PROTEIN_BLEND = ['Whey only', 'Collagen only', 'Whey + Collagen', 'Plant-based', 'TBD — needs R&D input']
const SWEETENER     = ['Sugar', 'Stevia', 'Sucralose', 'Monk fruit', 'No added sugar', 'TBD']
const CARBONATION   = ['Still', 'Lightly sparkling', 'Medium sparkling', 'Highly carbonated', 'TBD']

export default function DrinkStep2Formula({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(x => x !== item) : [...curr, item])
  }

  return (
    <div className="space-y-6">

      <Field label="Flavour direction" hint="What flavour(s) are we targeting? Can be broad at this stage.">
        <input placeholder="e.g. Tropical fruit — mango, passion fruit, guava. Also a watermelon version."
          value={data.flavourDirection || ''} onChange={e => set('flavourDirection', e.target.value)} />
      </Field>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-blue-800">Protein is a functional ingredient — be as specific as possible even if not finalised. This drives ingredient sourcing decisions.</p>
      </div>

      <Field label="Target protein per serving (g)" hint="Approximate is fine — gives R&D a starting point.">
        <div className="flex items-center gap-3">
          <input type="number" min="0" placeholder="e.g. 20"
            value={data.proteinTarget || ''} onChange={e => set('proteinTarget', e.target.value)}
            className="w-32 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-sm text-gray-400">g per serving</span>
          {data.proteinTarget && <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">TBC — pending blend decision</span>}
        </div>
      </Field>

      <Field label="Protein blend" hint="Which protein source(s) are we working with?">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PROTEIN_BLEND.map(o => <Chip key={o} label={o} active={data.proteinBlend === o} onClick={() => set('proteinBlend', o)} />)}
        </div>
      </Field>

      <Field label="Electrolytes?" hint="Adding electrolytes changes the sourcing, cost and label positioning significantly.">
        <div className="flex gap-2">
          {['Yes — key feature', 'Yes — small amount', 'No', 'TBD'].map(o => (
            <Chip key={o} label={o} active={data.electrolytes === o} onClick={() => set('electrolytes', o)} />
          ))}
        </div>
        {data.electrolytes?.startsWith('Yes') && (
          <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Which electrolytes? e.g. sodium, potassium, magnesium"
            value={data.electrolytesDetail || ''} onChange={e => set('electrolytesDetail', e.target.value)} />
        )}
      </Field>

      <Field label="Sweetener approach">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SWEETENER.map(o => <Chip key={o} label={o} active={data.sweetener === o} onClick={() => set('sweetener', o)} />)}
        </div>
      </Field>

      <Field label="Carbonation level">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CARBONATION.map(o => <Chip key={o} label={o} active={data.carbonation === o} onClick={() => set('carbonation', o)} />)}
        </div>
      </Field>

      <Field label="Anything off the table?" hint="Ingredients, additives, or approaches that are definitely not happening.">
        <input placeholder="e.g. No artificial colours, no soy protein, nothing with a chalky texture"
          value={data.formulaRestrictions || ''} onChange={e => set('formulaRestrictions', e.target.value)} />
      </Field>

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