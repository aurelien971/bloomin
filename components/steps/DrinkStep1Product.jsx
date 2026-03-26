const PRODUCT_TYPE = ['One-time / LTO', 'Recurring / permanent', 'Seasonal', "Don't know yet"]

export default function DrinkStep1Product({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  return (
    <div className="space-y-6">
      <Field label="Working product name" hint="Can be a codename — e.g. Agropo, Project Clear.">
        <input placeholder="e.g. Agropo" value={data.productName || ''} onChange={e => set('productName', e.target.value)} />
      </Field>
      <Field label="Is this a one-off or an ongoing product?">
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_TYPE.map(o => <Chip key={o} label={o} active={data.productType === o} onClick={() => set('productType', o)} />)}
        </div>
      </Field>
      <Field label="Why are we making this?" hint="What gap does it fill? What's the opportunity?">
        <textarea rows={3} placeholder="e.g. High-protein soda for the fitness market — nothing clean exists at this price point"
          value={data.productPurpose || ''} onChange={e => set('productPurpose', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </Field>
      <Field label="Any inspiration or reference products?" hint="Brands, drinks, formats you've seen that are close.">
        <input placeholder="e.g. Catch, Gorilla Mind Energy, Olipop — but with protein"
          value={data.inspiration || ''} onChange={e => set('inspiration', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target sample date">
          <input type="date" value={data.samplesNeededBy || ''} onChange={e => set('samplesNeededBy', e.target.value)} />
        </Field>
        <Field label="Target launch date">
          <input type="date" value={data.launchDate || ''} onChange={e => set('launchDate', e.target.value)} />
        </Field>
      </div>
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