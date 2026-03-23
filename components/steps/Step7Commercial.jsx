const CONTACT_TYPES = [
  { key: 'npd',        label: 'NPD contact',          hint: 'Your product development or innovation lead' },
  { key: 'supplyChain',label: 'Supply chain contact',  hint: 'Who handles ordering, logistics, distribution' },
  { key: 'technical',  label: 'Technical contact',     hint: 'Your food tech or QA person, if you have one' },
]

export default function Step7Commercial({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const currency = data.priceCurrency || 'GBP'
  const symbol   = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'

  const setContact = (type, field, value) => {
    const curr = data[`contact_${type}`] || {}
    set(`contact_${type}`, { ...curr, [field]: value })
  }

  return (
    <div className="space-y-6">

      {/* Price range */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Do you have a target cost per bottle?</label>
        <p className="text-xs text-gray-400 mb-3">
          Give us a range — this helps us choose the right ingredients from day one. We'll present options across the range and let you decide.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            {['GBP', 'USD', 'EUR'].map(c => (
              <button key={c} type="button" onClick={() => set('priceCurrency', c)}
                className={`px-3 py-3 text-sm font-semibold transition-all ${currency === c ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {c === 'GBP' ? '£' : c === 'USD' ? '$' : '€'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" placeholder="Min"
              value={data.targetCostMin || ''} onChange={e => set('targetCostMin', e.target.value)}
              className="w-28 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <span className="text-sm text-gray-400">to</span>
            <input type="number" min="0" step="0.01" placeholder="Max"
              value={data.targetCostMax || ''} onChange={e => set('targetCostMax', e.target.value)}
              className="w-28 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <span className="text-sm text-gray-400 flex-shrink-0">per bottle</span>
          </div>
        </div>
        {data.targetCostMin && data.targetCostMax && (
          <p className="text-xs text-green-600 mt-1">Range: {symbol}{data.targetCostMin} – {symbol}{data.targetCostMax} per bottle</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Leave blank if you'd rather discuss.</p>
      </div>

      {/* Volume */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Estimated cases per month</label>
        <p className="text-xs text-gray-400 mb-2">1 case = 6 bottles. Helps us plan production capacity from the start.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="0" placeholder="e.g. 100"
            value={data.casesPerMonth || ''}
            onChange={e => set('casesPerMonth', e.target.value.replace(/[^0-9]/g, ''))}
            className="w-40 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-sm text-gray-500">cases / month</span>
          {data.casesPerMonth && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
              = {(parseInt(data.casesPerMonth) * 6).toLocaleString()} bottles / month
            </span>
          )}
        </div>
      </div>

      {/* Sample address */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Where should we send the samples?</label>
        <p className="text-xs text-gray-400 mb-2">We'll use this address when your samples are ready — saves chasing later.</p>
        <div className="space-y-2">
          <input placeholder="Full name" value={data.sampleName || ''} onChange={e => set('sampleName', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <input placeholder="Street address" value={data.sampleStreet || ''} onChange={e => set('sampleStreet', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="City" value={data.sampleCity || ''} onChange={e => set('sampleCity', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <input placeholder="Postcode / ZIP" value={data.samplePostcode || ''} onChange={e => set('samplePostcode', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <input placeholder="Country" value={data.sampleCountry || ''} onChange={e => set('sampleCountry', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>

      {/* Three contacts */}
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Your key contacts</label>
          <p className="text-xs text-gray-400">We'll route different conversations to the right people. Fill in what's relevant — some contacts may be the same person.</p>
        </div>
        {CONTACT_TYPES.map(({ key, label, hint }) => (
          <div key={key} className="border border-gray-100 rounded-2xl p-4 space-y-2 bg-gray-50/40">
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{hint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Full name"
                value={(data[`contact_${key}`] || {}).name || ''}
                onChange={e => setContact(key, 'name', e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <input type="email" placeholder="Email"
                value={(data[`contact_${key}`] || {}).email || ''}
                onChange={e => setContact(key, 'email', e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <input placeholder="Job title"
                value={(data[`contact_${key}`] || {}).title || ''}
                onChange={e => setContact(key, 'title', e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Anything else */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Anything else we should know?</label>
        <textarea
          placeholder="Performance requirements, constraints, specific inspirations, anything else..."
          value={data.anythingElse || ''} onChange={e => set('anythingElse', e.target.value)}
          rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>

    </div>
  )
}