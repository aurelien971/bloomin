const VOLUMES    = ['250ml', '500ml', '750ml', '1 litre', '1.5 litre', '2 litre', 'Other']
const MATERIALS  = ['Glass', 'PET plastic', 'HDPE plastic', 'Aluminium', 'Other']
const SHELF_LIFE = ['3 months', '6 months', '12 months', '18 months', '24 months', 'Other']
const CERTS      = ['SALSA', 'BRC', 'Organic', 'None needed', 'Not sure']

export default function Step6Practical({ data, onChange, brief }) {
  const set = (f, v) => onChange({ ...data, [f]: v })

  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(d => d !== item) : [...curr, item])
  }

  const clientMarkets = brief?.clientMarkets || []

  return (
    <div className="space-y-6">

      {/* Syrup packaging label */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">This section is about the syrup bottle — not the end drink cup or customer packaging.</p>
      </div>

      <Field label="What volume should the syrup bottle be?">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {VOLUMES.map(o => <Chip key={o} label={o} active={data.bottleVolume === o} onClick={() => set('bottleVolume', o)} />)}
        </div>
        {data.bottleVolume === 'Other' && (
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="e.g. 1.5 litre, 5 litre"
            value={data.bottleVolumeOther || ''}
            onChange={e => set('bottleVolumeOther', e.target.value)}
          />
        )}
      </Field>

      <Field label="What material should the bottle be?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MATERIALS.map(o => <Chip key={o} label={o} active={data.bottleMaterial === o} onClick={() => set('bottleMaterial', o)} />)}
        </div>
        {data.bottleMaterial === 'Other' && (
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Describe the material..."
            value={data.bottleMaterialOther || ''}
            onChange={e => set('bottleMaterialOther', e.target.value)}
          />
        )}
      </Field>

      <Field label="Where will it be stored?">
        <div className="flex gap-2">
          {['Ambient', 'Refrigerated', 'Not sure'].map(o => <Chip key={o} label={o} active={data.storage === o} onClick={() => set('storage', o)} />)}
        </div>
      </Field>

      <Field label="What shelf life are you targeting?">
        <div className="grid grid-cols-3 gap-2">
          {SHELF_LIFE.map(o => <Chip key={o} label={o} active={data.shelfLife === o} onClick={() => set('shelfLife', o)} />)}
        </div>
        {data.shelfLife === 'Other' && (
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="e.g. 9 months..."
            value={data.shelfLifeOther || ''}
            onChange={e => set('shelfLifeOther', e.target.value)}
          />
        )}
      </Field>

      <Field label="Certifications needed?" hint="Select all that apply.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CERTS.map(o => (
            <button key={o} type="button" onClick={() => toggle('certifications', o)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left flex items-center gap-2 transition-all ${(data.certifications||[]).includes(o) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${(data.certifications||[]).includes(o) ? 'bg-white border-white text-green-600' : 'border-gray-300'}`}>
                {(data.certifications||[]).includes(o) ? '✓' : ''}
              </span>
              {o}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Which markets is this going into?" hint="Your account markets are pre-loaded — remove any that don't apply to this product, and add extras below.">
        <MarketSelector data={data} set={set} clientMarkets={clientMarkets} />
      </Field>

    </div>
  )
}

function MarketSelector({ data, set, clientMarkets = [] }) {
  const { useState, useEffect } = require('react')
  const [input, setInput] = useState('')

  // Initialise: if markets not yet set, default to all client markets selected
  useEffect(() => {
    if (!data.markets) set('markets', clientMarkets)
  }, [])

  const markets     = data.markets || clientMarkets
  const isSelected  = (m) => markets.includes(m)

  const toggle = (m) => {
    set('markets', isSelected(m) ? markets.filter(x => x !== m) : [...markets, m])
  }

  const addCustom = () => {
    if (!input.trim()) return
    if (!markets.includes(input.trim())) set('markets', [...markets, input.trim()])
    setInput('')
  }

  // Show all client markets as toggleable, plus any custom ones
  const customMarkets = markets.filter(m => !clientMarkets.includes(m))

  return (
    <div className="space-y-3">
      {clientMarkets.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">From your account — tap to remove if not applicable to this product:</p>
          <div className="flex flex-wrap gap-2">
            {clientMarkets.map(m => (
              <button key={m} type="button" onClick={() => toggle(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  isSelected(m)
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400 line-through'
                }`}>
                {m}
                {isSelected(m)
                  ? <span className="text-green-400 font-bold leading-none text-xs">×</span>
                  : <span className="text-gray-400 text-xs">↩</span>
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {customMarkets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customMarkets.map(m => (
            <span key={m} className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-medium px-3 py-1.5 rounded-full border border-green-200">
              {m}
              <button type="button" onClick={() => set('markets', markets.filter(x => x !== m))} className="text-green-400 hover:text-green-700 font-bold leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Add another market..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
        />
        <button type="button" onClick={addCustom} className="px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">Add</button>
      </div>
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