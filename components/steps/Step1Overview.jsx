const PRODUCT_TYPE = ['One-time / LTO', 'Recurring / permanent', 'Seasonal (recurring annually)', "Don't know yet"]

export default function Step1Overview({ data, onChange }) {
  const set = (field, value) => onChange({ ...data, [field]: value })
  return (
    <div className="space-y-6">
      <Field label="Is this a one-off or an ongoing product?">
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_TYPE.map(o => <Chip key={o} label={o} active={data.productType === o} onClick={() => set('productType', o)} />)}
        </div>
      </Field>

      <Field label="Why do you need this product?" hint="A new launch, replacing something, filling a gap on the menu?">
        <textarea placeholder="e.g. We want something new for spring that works in our milk drinks" value={data.productPurpose || ''} onChange={e => set('productPurpose', e.target.value)} rows={3} />
      </Field>

      <Field label="Is there anything that inspired this?" hint="A drink you've tasted, a brand you like, a vibe you're going for.">
        <input placeholder="e.g. Like a matcha latte but more floral and less bitter" value={data.inspiration || ''} onChange={e => set('inspiration', e.target.value)} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="When do you need samples?"
          hint="The date you'd like to receive and taste the first physical samples."
        >
          <input type="date" value={data.samplesNeededBy || ''} onChange={e => set('samplesNeededBy', e.target.value)} />
        </Field>
        <Field
          label="When do you need full production ready?"
          hint="The date this product needs to be live — on shelves, on menu, or shipping to customers."
        >
          <input type="date" value={data.productionDate || ''} onChange={e => set('productionDate', e.target.value)} />
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