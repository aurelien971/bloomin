export default function DrinkStep6Commercial({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const currency = data.priceCurrency || 'USD'
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'

  return (
    <div className="space-y-6">

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Target cost per unit (to produce)</label>
        <p className="text-xs text-gray-400 mb-3">Give a range — this drives protein blend and ingredient decisions. Protein is expensive.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            {['USD', 'GBP', 'EUR'].map(c => (
              <button key={c} type="button" onClick={() => set('priceCurrency', c)}
                className={`px-3 py-3 text-sm font-semibold transition-all ${currency === c ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {c === 'GBP' ? '£' : c === 'USD' ? '$' : '€'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" placeholder="Min"
              value={data.targetCostMin || ''} onChange={e => set('targetCostMin', e.target.value)}
              className="w-24 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <span className="text-sm text-gray-400">to</span>
            <input type="number" min="0" step="0.01" placeholder="Max"
              value={data.targetCostMax || ''} onChange={e => set('targetCostMax', e.target.value)}
              className="w-24 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <span className="text-sm text-gray-400">per unit</span>
          </div>
        </div>
        {data.targetCostMin && data.targetCostMax && (
          <p className="text-xs text-green-600 mt-1">Range: {sym}{data.targetCostMin} – {sym}{data.targetCostMax} per unit</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Target retail price (RRP)</label>
        <div className="flex items-center gap-3">
          <input type="number" min="0" step="0.01" placeholder="e.g. 3.50"
            value={data.targetRrp || ''} onChange={e => set('targetRrp', e.target.value)}
            className="w-32 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-sm text-gray-400">per unit</span>
          {data.targetCostMax && data.targetRrp && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
              ~{Math.round(((parseFloat(data.targetRrp) - parseFloat(data.targetCostMax)) / parseFloat(data.targetRrp)) * 100)}% gross margin
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Initial volume target</label>
        <p className="text-xs text-gray-400 mb-2">First production run size — helps us select the right co-packer and negotiate MOQs.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="0" placeholder="e.g. 10000"
            value={data.initialVolume || ''} onChange={e => set('initialVolume', e.target.value.replace(/[^0-9]/g, ''))}
            className="w-36 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-sm text-gray-400">units</span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-800">Key contacts for this project</label>
        {[
          { key: 'lead',        label: 'Project lead',       hint: 'Who owns this internally' },
          { key: 'technical',   label: 'Technical / R&D',    hint: 'Formulation and QA' },
          { key: 'commercial',  label: 'Commercial',         hint: 'Pricing, channels, markets' },
        ].map(({ key, label, hint }) => (
          <div key={key} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40 space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{hint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['name', 'email', 'role'].map(field => (
                <input key={field}
                  placeholder={field === 'name' ? 'Full name' : field === 'email' ? 'Email' : 'Job title'}
                  value={(data[`contact_${key}`] || {})[field] || ''}
                  onChange={e => set(`contact_${key}`, { ...(data[`contact_${key}`] || {}), [field]: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Anything else to flag?</label>
        <textarea rows={3} placeholder="Co-packer requirements, IP considerations, competitor launches to be aware of, anything else..."
          value={data.anythingElse || ''} onChange={e => set('anythingElse', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>

    </div>
  )
}