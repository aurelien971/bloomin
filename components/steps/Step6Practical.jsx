const SHELF_LIFE_OPTIONS = ['3 months', '6 months', '12 months', '18 months', '24 months', 'Other']

export default function Step6Practical({ data, onChange, brief }) {
  const set = (f, v) => onChange({ ...data, [f]: v })

  const toggle = (field, item) => {
    const curr = data[field] || []
    set(field, curr.includes(item) ? curr.filter(d => d !== item) : [...curr, item])
  }

  const clientMarkets = brief?.clientMarkets || []

  return (
    <div className="space-y-6">

      {/* Bottle — influence toward standard */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-blue-800">Our standard format is a <strong>750ml glass bottle</strong>, shipped in cases of 6. Let us know below if this doesn't work for you.</p>
      </div>

      <Field label="Is our standard 750ml glass bottle suitable?">
        <div className="flex gap-2">
          {['Yes', 'No — I need something different'].map(o => (
            <Chip key={o} label={o} active={data.standardBottleOk === o} onClick={() => set('standardBottleOk', o)} />
          ))}
        </div>
        {data.standardBottleOk === 'No — I need something different' && (
          <textarea rows={2} className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            placeholder="Describe what you need — size, material, format. Our team will review and come back to you."
            value={data.bottleAlternative || ''} onChange={e => set('bottleAlternative', e.target.value)} />
        )}
        <p className="text-xs text-gray-400 mt-1">Note: alternative formats may affect lead times, MOQs and unit cost.</p>
      </Field>

      <Field label="Does the bottle need to be pump compatible?">
        <div className="flex gap-2">
          {['Yes', 'No', 'Not sure'].map(o => (
            <Chip key={o} label={o} active={data.pumpCompatible === o} onClick={() => set('pumpCompatible', o)} />
          ))}
        </div>
      </Field>

      <Field label="Storage — how will this be stored and distributed?">
        <div className="flex gap-2">
          {['Ambient', 'Refrigerated', 'Not sure'].map(o => (
            <Chip key={o} label={o} active={data.storage === o} onClick={() => set('storage', o)} />
          ))}
        </div>
      </Field>

      {/* Shelf life — split open/unopened */}
      <div className="border border-gray-100 rounded-2xl p-5 space-y-4 bg-gray-50/50">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Shelf life</p>
        <Field label="Unopened shelf life" hint="From production date to best before — how long should it last sealed?">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SHELF_LIFE_OPTIONS.map(o => <Chip key={o} label={o} active={data.shelfLifeUnopened === o} onClick={() => set('shelfLifeUnopened', o)} />)}
          </div>
          {data.shelfLifeUnopened === 'Other' && (
            <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="e.g. 9 months" value={data.shelfLifeUnopenedOther || ''} onChange={e => set('shelfLifeUnopenedOther', e.target.value)} />
          )}
        </Field>
        <Field label="Open shelf life" hint="Once the bottle is opened and in use — fridge or back-bar.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['7 days', '2 weeks', '4 weeks', '3 months', 'Other'].map(o => (
              <Chip key={o} label={o} active={data.shelfLifeOpen === o} onClick={() => set('shelfLifeOpen', o)} />
            ))}
          </div>
          {data.shelfLifeOpen === 'Other' && (
            <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="e.g. 6 weeks refrigerated" value={data.shelfLifeOpenOther || ''} onChange={e => set('shelfLifeOpenOther', e.target.value)} />
          )}
        </Field>
      </div>

      {/* Markets */}
      <Field label="Which markets is this going into?" hint="Your account markets are pre-loaded — tap × to remove any that don't apply to this product, and add extras below.">
        <MarketSelector data={data} set={set} clientMarkets={clientMarkets} />
      </Field>

    </div>
  )
}

function MarketSelector({ data, set, clientMarkets = [] }) {
  const { useState, useEffect } = require('react')
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!data.markets) set('markets', clientMarkets)
  }, [])

  const markets    = data.markets || clientMarkets
  const isSelected = (m) => markets.includes(m)
  const toggle     = (m) => set('markets', isSelected(m) ? markets.filter(x => x !== m) : [...markets, m])
  const addCustom  = () => {
    if (!input.trim()) return
    if (!markets.includes(input.trim())) set('markets', [...markets, input.trim()])
    setInput('')
  }
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
                  isSelected(m) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400 line-through'
                }`}>
                {m}
                {isSelected(m)
                  ? <span className="text-green-400 font-bold text-xs">×</span>
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
              <button type="button" onClick={() => set('markets', markets.filter(x => x !== m))} className="text-green-400 hover:text-green-700 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Add another market..." value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
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