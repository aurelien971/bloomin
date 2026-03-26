const FORMATS   = ['330ml can', '500ml can', '250ml can', '330ml bottle', '500ml bottle', 'Other']
const OCCASIONS = ['Gym / post-workout', 'On-the-go / daily', 'Office / desk', 'Social / out', 'Morning routine', 'All day']
const CHANNELS  = ['Gym & fitness retail', 'Grocery / supermarket', 'Convenience stores', 'Online DTC', 'Food service / cafes', 'TBD']

export default function DrinkStep4Format({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(x => x !== item) : [...curr, item])
  }

  return (
    <div className="space-y-6">

      <Field label="Format" hint="Primary packaging format.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FORMATS.map(o => <Chip key={o} label={o} active={data.format === o} onClick={() => set('format', o)} />)}
        </div>
        {data.format === 'Other' && (
          <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Describe format..." value={data.formatOther || ''} onChange={e => set('formatOther', e.target.value)} />
        )}
      </Field>

      <Field label="Serving occasion" hint="When and where is someone drinking this? Select all that apply.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OCCASIONS.map(o => (
            <button key={o} type="button" onClick={() => toggle('occasions', o)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left flex items-center gap-2 transition-all ${(data.occasions || []).includes(o) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${(data.occasions || []).includes(o) ? 'bg-white border-white text-green-600' : 'border-gray-300'}`}>
                {(data.occasions || []).includes(o) ? '✓' : ''}
              </span>
              {o}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Target distribution channel" hint="Where do we want to sell this first? Select all that apply.">
        <div className="grid grid-cols-2 gap-2">
          {CHANNELS.map(o => (
            <button key={o} type="button" onClick={() => toggle('channels', o)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left flex items-center gap-2 transition-all ${(data.channels || []).includes(o) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${(data.channels || []).includes(o) ? 'bg-white border-white text-green-600' : 'border-gray-300'}`}>
                {(data.channels || []).includes(o) ? '✓' : ''}
              </span>
              {o}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Shelf life target" hint="RTD drinks typically need 12–18 months ambient.">
        <div className="flex gap-2">
          {['12 months', '18 months', '24 months', 'TBD'].map(o => (
            <Chip key={o} label={o} active={data.shelfLife === o} onClick={() => set('shelfLife', o)} />
          ))}
        </div>
      </Field>

      <Field label="Storage — ambient or chilled?">
        <div className="flex gap-2">
          {['Ambient', 'Chilled', 'Either / TBD'].map(o => (
            <Chip key={o} label={o} active={data.storage === o} onClick={() => set('storage', o)} />
          ))}
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
      <div>{children}</div>
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