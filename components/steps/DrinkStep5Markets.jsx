const CLAIMS_FUNCTIONAL = ['High protein', 'Source of protein', 'Electrolytes', 'Low sugar', 'No added sugar', 'Low calorie', 'Hydration']
const CLAIMS_LABEL      = ['Vegan', 'Gluten-free', 'Non-GMO', 'Natural flavours only', 'No artificial sweeteners']
const CERTS             = ['FDA compliant (USA)', 'ANVISA compliant (Brazil)', 'SALSA', 'BRC', 'Organic', 'None needed yet']

export default function DrinkStep5Markets({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(x => x !== item) : [...curr, item])
  }

  return (
    <div className="space-y-6">

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">Target markets are USA and South America — these have specific protein claim thresholds and labelling requirements. Flag any must-haves now so R&D can design for compliance from day one.</p>
      </div>

      <Field label="Primary markets" hint="Select all you're targeting.">
        <div className="flex flex-wrap gap-2">
          {['USA', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'Chile', 'UK', 'Other'].map(m => (
            <button key={m} type="button" onClick={() => toggle('markets', m)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${(data.markets || []).includes(m) ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Functional claims to make on pack" hint="Only include what you're confident you can substantiate — each needs a minimum level to be legally permitted.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CLAIMS_FUNCTIONAL.map(o => (
            <Chip key={o} label={o} active={(data.functionalClaims || []).includes(o)} onClick={() => toggle('functionalClaims', o)} />
          ))}
        </div>
      </Field>

      <Field label="Label claims" hint="Select all that will appear on the label.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CLAIMS_LABEL.map(o => (
            <Chip key={o} label={o} active={(data.labelClaims || []).includes(o)} onClick={() => toggle('labelClaims', o)} />
          ))}
        </div>
      </Field>

      <Field label="Certifications or compliance requirements" hint="Select anything that's a hard requirement — not just nice to have.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CERTS.map(o => (
            <Chip key={o} label={o} active={(data.certifications || []).includes(o)} onClick={() => toggle('certifications', o)} />
          ))}
        </div>
      </Field>

      <Field label="Allergen considerations" hint="Whey = dairy. Collagen = bovine. Flag anything relevant for your target markets.">
        <input placeholder="e.g. Must be suitable for halal markets — avoid porcine collagen"
          value={data.allergenNotes || ''} onChange={e => set('allergenNotes', e.target.value)} />
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