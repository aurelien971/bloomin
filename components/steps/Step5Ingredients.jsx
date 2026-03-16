const DIETARY = ['Vegan', 'Vegetarian', 'Halal', 'Kosher', 'Gluten free', 'Dairy free', 'Nut free']
const SUGAR   = ['Cane sugar', 'Agave', 'No added sugar', 'No preference']
const PRESERVATIVES = ['Yes, fine', 'No — please avoid', 'Prefer not to but open to it']

export default function Step5Ingredients({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(d => d !== item) : [...curr, item])
  }
  return (
    <div className="space-y-6">
      <Field label="Any dietary requirements?" hint="Select all that apply.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIETARY.map(o => (
            <button key={o} type="button" onClick={() => toggle('dietary', o)} className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left flex items-center gap-2 transition-all ${(data.dietary||[]).includes(o) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${(data.dietary||[]).includes(o) ? 'bg-white border-white text-green-600' : 'border-gray-300'}`}>{(data.dietary||[]).includes(o) ? '✓' : ''}</span>
              {o}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Sugar base preference?">
        <div className="grid grid-cols-2 gap-2">{SUGAR.map(o => <Chip key={o} label={o} active={data.sugarBase === o} onClick={() => set('sugarBase', o)} />)}</div>
      </Field>
      <Field label="Are preservatives OK?">
        <div className="space-y-2">{PRESERVATIVES.map(o => <Chip key={o} label={o} active={data.preservatives === o} onClick={() => set('preservatives', o)} wide />)}</div>
      </Field>
      <Field label="Any ingredients that are completely off the table?">
        <textarea placeholder="e.g. No artificial colours, no nuts" value={data.ingredientRestrictions || ''} onChange={e => set('ingredientRestrictions', e.target.value)} rows={2} />
      </Field>
      <Field label="Any allergens we need to be careful about?">
        <input placeholder="e.g. Must be nut free, no sesame" value={data.allergens || ''} onChange={e => set('allergens', e.target.value)} />
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

function Chip({ label, active, onClick, wide }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${wide ? 'w-full' : ''} ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}