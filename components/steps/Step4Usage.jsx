const USES = [
  'Hot milk drinks',
  'Cold milk drinks',
  'Matcha / powder drinks',
  'Sparkling water / soda',
  'Still water',
  'Cocktails / mocktails',
  'Desserts / food',
  'Other',
]

const MILK_TYPES = ['Full fat', 'Semi-skimmed', 'Skimmed', 'Oat', 'Almond', 'Soy', 'Coconut', 'Other']
const TEXTURE    = ['Very thick', 'Thick', 'Medium', 'Light and runny', 'No preference']

const MILK_USES = ['Hot milk drinks', 'Cold milk drinks', 'Matcha / powder drinks']

export default function Step4Usage({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })

  const toggle = (use) => {
    const curr = data.uses || []
    set('uses', curr.includes(use) ? curr.filter(u => u !== use) : [...curr, use])
  }

  const toggleMilk = (type) => {
    const curr = data.milkTypes || []
    set('milkTypes', curr.includes(type) ? curr.filter(t => t !== type) : [...curr, type])
  }

  const usesMilk = (data.uses || []).some(u => MILK_USES.includes(u))

  return (
    <div className="space-y-6">

      <Field label="Where will this syrup be used?" hint="Select all that apply.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {USES.map(u => (
            <button
              key={u} type="button" onClick={() => toggle(u)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left flex items-center gap-2 transition-all ${(data.uses||[]).includes(u) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${(data.uses||[]).includes(u) ? 'bg-white border-white text-green-600' : 'border-gray-300'}`}>
                {(data.uses||[]).includes(u) ? '✓' : ''}
              </span>
              {u}
            </button>
          ))}
        </div>
        {(data.uses||[]).includes('Other') && (
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Tell us more..."
            value={data.usesOther || ''}
            onChange={e => set('usesOther', e.target.value)}
          />
        )}
      </Field>

      {/* Milk type — only shown if a milk use is selected */}
      {usesMilk && (
        <Field
          label="What type of milk will it go into?"
          hint="Select all that apply — some syrups can split in high-fat or certain plant milks, so this is important."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MILK_TYPES.map(t => (
              <button
                key={t} type="button" onClick={() => toggleMilk(t)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-center transition-all ${(data.milkTypes||[]).includes(t) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}
              >
                {t}
              </button>
            ))}
          </div>
          {(data.milkTypes||[]).includes('Other') && (
            <input
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Which other milk type?"
              value={data.milkTypeOther || ''}
              onChange={e => set('milkTypeOther', e.target.value)}
            />
          )}
        </Field>
      )}

      <Field label="How much syrup goes in one drink?" hint="e.g. 20g syrup to 140ml milk, or 1 pump (approx 10ml)">
        <input
          placeholder="e.g. 20g per drink"
          value={data.doseRate || ''}
          onChange={e => set('doseRate', e.target.value)}
        />
      </Field>

      <Field label="How thick should it feel?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEXTURE.map(o => <Chip key={o} label={o} active={data.texture === o} onClick={() => set('texture', o)} />)}
        </div>
      </Field>

      <Field label="Any other performance requirements?">
        <textarea
          placeholder="e.g. Needs to dissolve quickly in hot water, or look dramatic poured over ice"
          value={data.performanceNotes || ''}
          onChange={e => set('performanceNotes', e.target.value)}
          rows={3}
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
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}
