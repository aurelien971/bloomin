export default function Step7Commercial({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  const currency = data.priceCurrency || 'GBP'

  return (
    <div className="space-y-6">

      <Field label="Do you have a target price per bottle?" hint="Helps us make the right ingredient decisions from day one.">
        <div className="flex gap-2 items-center">
          {/* Currency toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            {['GBP', 'USD', 'EUR'].map(c => (
              <button
                key={c} type="button"
                onClick={() => set('priceCurrency', c)}
                className={`px-3 py-3 text-sm font-semibold transition-all ${currency === c ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                {c === 'GBP' ? '£' : c === 'USD' ? '$' : '€'}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 8.50"
            value={data.targetCostAmount || ''}
            onChange={e => set('targetCostAmount', e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <span className="text-sm text-gray-400 flex-shrink-0">per bottle</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Leave blank if you'd rather discuss.</p>
      </Field>

      <Field
        label="Estimated cases per month"
        hint="1 case = 6 bottles. Enter a number — this helps us plan production capacity from the start."
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            placeholder="e.g. 100"
            value={data.casesPerMonth || ''}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '')
              set('casesPerMonth', val)
            }}
            className="w-40 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <span className="text-sm text-gray-500">cases / month</span>
          {data.casesPerMonth && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
              = {(parseInt(data.casesPerMonth) * 6).toLocaleString()} bottles / month
            </span>
          )}
        </div>
      </Field>

      <Field label="Where should we send the samples?">
        <div className="space-y-2">
          <input placeholder="Full name" value={data.sampleName || ''} onChange={e => set('sampleName', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <input placeholder="Street address" value={data.sampleStreet || ''} onChange={e => set('sampleStreet', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="City" value={data.sampleCity || ''} onChange={e => set('sampleCity', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input placeholder="Postcode / ZIP" value={data.samplePostcode || ''} onChange={e => set('samplePostcode', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <input placeholder="Country" value={data.sampleCountry || ''} onChange={e => set('sampleCountry', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </Field>

      <Field label="Who's the main contact on your side?">
        <div className="space-y-2">
          <input placeholder="Full name" value={data.contactName || ''} onChange={e => set('contactName', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <input type="email" placeholder="Email address" value={data.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <input type="tel" placeholder="Phone number" value={data.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </Field>

      <Field label="Anything else we should know?">
        <textarea
          placeholder="Performance requirements, constraints, specific inspirations, anything else — e.g. needs to dissolve fast in hot water, or look dramatic poured over ice"
          value={data.anythingElse || ''}
          onChange={e => set('anythingElse', e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
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
      <div>{children}</div>
    </div>
  )
}