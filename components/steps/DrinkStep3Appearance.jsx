const CLARITY = ['Crystal clear', 'Slightly hazy', 'Lightly coloured', 'Vibrant / bold colour', 'TBD']

export default function DrinkStep3Appearance({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  return (
    <div className="space-y-6">

      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-500">Agropo is currently positioned as a <strong>clear soda</strong>. Answer these with that in mind — flag if the direction has changed.</p>
      </div>

      <Field label="Colour direction" hint="Clear sodas can still have a very subtle tint. What are we aiming for?">
        <input placeholder="e.g. Crystal clear — no colour, or very subtle pale yellow for the mango variant"
          value={data.colourDirection || ''} onChange={e => set('colourDirection', e.target.value)} />
      </Field>

      <Field label="Clarity target">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CLARITY.map(o => <Chip key={o} label={o} active={data.clarity === o} onClick={() => set('clarity', o)} />)}
        </div>
      </Field>

      <Field label="Any visual references?" hint="Competitor cans, drinks you've seen, brands whose look you like.">
        <input placeholder="e.g. Liquid Death clarity, Catch branding aesthetic"
          value={data.visualReference || ''} onChange={e => set('visualReference', e.target.value)} />
        <div className="mt-2 space-y-2">
          {(data.referencePhotos || []).map((photo, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <span className="text-sm">📎</span>
              <span className="text-sm text-green-800 truncate flex-1">{photo.name}</span>
              <button type="button" onClick={() => set('referencePhotos', (data.referencePhotos || []).filter((_, idx) => idx !== i))}
                className="text-green-400 hover:text-red-500 font-bold text-lg leading-none">×</button>
            </div>
          ))}
          <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 cursor-pointer hover:border-gray-400 transition">
            <span>📎</span>
            <span>{(data.referencePhotos || []).length > 0 ? 'Add another reference' : 'Upload reference photo (optional)'}</span>
            <input type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { set('referencePhotos', [...(data.referencePhotos || []), { name: file.name, file }]); e.target.value = '' }
              }} />
          </label>
        </div>
      </Field>

      <Field label="Packaging appearance notes" hint="Any brand language, colour palette, or label style direction?">
        <textarea rows={2} placeholder="e.g. Clean, minimal, athletic. White or black can. Bold flavour name front and centre."
          value={data.packagingAppearanceNotes || ''} onChange={e => set('packagingAppearanceNotes', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
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
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}