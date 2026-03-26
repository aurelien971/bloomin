import { useState } from 'react'

const PRODUCT_TYPE = ['One-time / LTO', 'Recurring / permanent', 'Seasonal (recurring annually)', "Don't know yet"]

// Timeline rules (in days)
const RULES = [
  { from: 'samplesNeededBy', to: 'signoffDate',    label: 'Sample → Client sign-off',         minDays: 28, maxDays: 42,  hint: '4–6 weeks for tasting & sign-off' },
  { from: 'signoffDate',     to: 'distributorDate', label: 'Sign-off → Lands at distributor',  minDays: 56, maxDays: 63,  hint: '~2 months for production & shipping' },
  { from: 'distributorDate', to: 'launchDate',     label: 'Distributor → In-store launch',     minDays: 21, maxDays: 28,  hint: '3–4 weeks for distribution' },
]

function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export default function Step1Overview({ data, onChange }) {
  const set = (field, value) => onChange({ ...data, [field]: value })

  // Compute suggested dates based on samplesNeededBy
  const suggested = {}
  if (data.samplesNeededBy) {
    suggested.signoffDate    = addDays(data.samplesNeededBy, 35)   // 5 weeks midpoint
    suggested.distributorDate = addDays(suggested.signoffDate, 60) // 2 months
    suggested.launchDate     = addDays(suggested.distributorDate, 21) // 3 weeks
  }

  // Timeline visualization dates — use actual if set, else suggested
  const timelineDates = {
    samplesNeededBy:  data.samplesNeededBy  || null,
    signoffDate:      data.signoffDate      || suggested.signoffDate || null,
    distributorDate:  data.distributorDate  || suggested.distributorDate || null,
    launchDate:       data.launchDate       || suggested.launchDate || null,
  }

  const allSet = timelineDates.samplesNeededBy && timelineDates.distributorDate && timelineDates.launchDate

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

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">These are your desired dates — not a commitment from us. We'll align on a realistic timeline once we've reviewed your brief.</p>
      </div>

      {/* Sample date */}
      <Field label="Desired sample date" hint="When would you ideally like to receive and taste the first physical samples?">
        <input type="date" value={data.samplesNeededBy || ''} onChange={e => set('samplesNeededBy', e.target.value)} />
      </Field>

      {/* Timeline visual — shows once sample date is entered */}
      {data.samplesNeededBy && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recommended timeline</p>
            <p className="text-xs text-gray-400">Based on your sample date</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            {RULES.map((rule, i) => {
              const fromDate = timelineDates[rule.from]
              const toDate   = timelineDates[rule.to]
              const actual   = daysBetween(fromDate, toDate)
              const isSet    = !!(data[rule.from] && (rule.to === 'signoffDate' ? data.signoffDate : data[rule.to]))
              const onTrack  = actual !== null && actual >= rule.minDays
              const tight    = actual !== null && actual < rule.minDays && actual > 0

              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold ${
                    !fromDate || !toDate ? 'bg-gray-200 text-gray-400'
                    : onTrack ? 'bg-green-500 text-white'
                    : 'bg-amber-400 text-white'
                  }`}>
                    {!fromDate || !toDate ? '·' : onTrack ? '✓' : '!'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700">{rule.label}</p>
                      {fromDate && toDate && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${onTrack ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {actual}d {onTrack ? '✓' : `(need ${rule.minDays}+)`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{rule.hint}</p>
                    {fromDate && toDate && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {fmtDate(fromDate)} → {fmtDate(toDate)}
                      </p>
                    )}
                    {/* Suggest button if this date isn't set yet */}
                    {fromDate && !data[rule.to] && rule.to !== 'signoffDate' && (
                      <button type="button"
                        onClick={() => set(rule.to, addDays(fromDate, rule.minDays))}
                        className="mt-1.5 text-[11px] text-green-600 font-semibold hover:text-green-800 transition underline underline-offset-2">
                        Suggest: {fmtDate(addDays(fromDate, rule.minDays))} →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Distributor + launch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Desired date to land at distributor" hint="Products typically need to arrive at the distributor 3–4 weeks before in-store launch.">
          <input type="date" value={data.distributorDate || ''} onChange={e => set('distributorDate', e.target.value)} />
          {suggested.distributorDate && !data.distributorDate && (
            <button type="button" onClick={() => set('distributorDate', suggested.distributorDate)}
              className="mt-1.5 text-[11px] text-green-600 font-semibold hover:text-green-800 transition underline underline-offset-2 text-left">
              Suggest: {fmtDate(suggested.distributorDate)} →
            </button>
          )}
          {data.launchDate && data.distributorDate && data.distributorDate >= data.launchDate && (
            <p className="text-xs text-red-500 mt-1">⚠ Must be before the in-store launch date</p>
          )}
        </Field>
        <Field label="Desired in-store launch date" hint="When does this product need to go live in store or on the menu?">
          <input type="date" value={data.launchDate || ''} onChange={e => set('launchDate', e.target.value)} />
          {suggested.launchDate && !data.launchDate && (
            <button type="button" onClick={() => set('launchDate', suggested.launchDate)}
              className="mt-1.5 text-[11px] text-green-600 font-semibold hover:text-green-800 transition underline underline-offset-2 text-left">
              Suggest: {fmtDate(suggested.launchDate)} →
            </button>
          )}
          {data.distributorDate && data.launchDate && data.launchDate <= data.distributorDate && (
            <p className="text-xs text-red-500 mt-1">⚠ Must be after the distributor arrival date</p>
          )}
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