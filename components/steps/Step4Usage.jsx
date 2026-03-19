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
const MILK_USES  = ['Hot milk drinks', 'Cold milk drinks', 'Matcha / powder drinks']

// Map endDrinkType (Step 3) to the most likely "uses" pre-selection
const END_DRINK_TO_USE = {
  'Matcha latte':        'Matcha / powder drinks',
  'Iced coffee':         'Cold milk drinks',
  'Hot chocolate':       'Hot milk drinks',
  'Milk drink':          'Hot milk drinks',
  'Sparkling water / soda': 'Sparkling water / soda',
  'Cocktail / mocktail': 'Cocktails / mocktails',
  'Smoothie':            'Hot milk drinks',
}

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

  // Infer from Step 3 endDrinkType
  const inferredUse = END_DRINK_TO_USE[data.endDrinkType]

  // Auto-add inferred use on first render if uses is empty
  const handleToggle = (use) => {
    const curr = data.uses || []
    if (curr.length === 0 && inferredUse && use !== inferredUse) {
      // User is picking something different from the inferred — just add it
    }
    toggle(use)
  }

  // Dose rate hint adjusts based on pump compatible (if already answered)
  const pumpHint = data.pumpCompatible === 'Yes'
    ? 'e.g. 2 pumps per drink (1 pump ≈ 10ml) — leave blank if unsure'
    : 'e.g. 20ml per drink — leave blank if unsure. If using a pump, note the number of pumps.'

  return (
    <div className="space-y-6">

      {/* End drink type — pre-filled from Step 3, shown as context */}
      {data.endDrinkType && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">☕</span>
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">End drink — from your last answer</p>
            <p className="text-sm text-green-900 font-medium mt-0.5">
              {data.endDrinkType === 'Other' ? data.endDrinkTypeOther || 'Other' : data.endDrinkType}
            </p>
          </div>
        </div>
      )}

      <Field label="Where will this syrup be used?" hint="Select all that apply.">
        {inferredUse && !(data.uses || []).includes(inferredUse) && (
          <button
            type="button"
            onClick={() => toggle(inferredUse)}
            className="w-full mb-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-dashed border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition text-left flex items-center justify-between gap-2"
          >
            <span>↵ Add "{inferredUse}" based on your end drink</span>
            <span className="text-xs text-green-500">tap to add</span>
          </button>
        )}
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
          hint="Select all that apply — some syrups can split in certain milks, so this matters."
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

      <Field label="Do you have a rough dose rate in mind?" hint={pumpHint}>
        <input
          placeholder="e.g. 2 pumps, or 20ml — leave blank if unsure"
          value={data.doseRate || ''}
          onChange={e => set('doseRate', e.target.value)}
        />
      </Field>

      <Field label="How thick should it feel?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEXTURE.map(o => <Chip key={o} label={o} active={data.texture === o} onClick={() => set('texture', o)} />)}
        </div>
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
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}