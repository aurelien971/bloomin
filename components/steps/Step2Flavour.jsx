const SWEETNESS  = ['Very sweet', 'Sweet', 'Balanced', 'Lightly sweet', 'Barely sweet']
const AFTERTASTE = ['Clean finish', 'Lingering sweetness', 'Fruity finish', 'Floral finish', 'Slightly bitter', 'No preference']

export default function Step2Flavour({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  return (
    <div className="space-y-6">
      <Field label="What is the main flavour?" hint="Be specific — 'dark cherry' rather than just 'cherry'.">
        <input placeholder="e.g. Dark cherry with a hint of rose" value={data.primaryFlavour || ''} onChange={e => set('primaryFlavour', e.target.value)} />
      </Field>
      <Field label="Any supporting flavour notes?">
        <input placeholder="e.g. Slight vanilla, light floral, subtle almond" value={data.secondaryFlavour || ''} onChange={e => set('secondaryFlavour', e.target.value)} />
      </Field>
      <Field label="Any flavours you absolutely do NOT want?">
        <input placeholder="e.g. Nothing artificial, no smokiness" value={data.flavourExclusions || ''} onChange={e => set('flavourExclusions', e.target.value)} />
      </Field>
      <Field label="How sweet should it be?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{SWEETNESS.map(o => <Chip key={o} label={o} active={data.sweetness === o} onClick={() => set('sweetness', o)} />)}</div>
      </Field>
      <Field label="What should the finish feel like?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{AFTERTASTE.map(o => <Chip key={o} label={o} active={data.aftertaste === o} onClick={() => set('aftertaste', o)} />)}</div>
      </Field>
      <Field label="Anything else about the taste?">
        <textarea placeholder="e.g. Should taste like a real cherry, not a fake sweet one. Rose should be subtle." value={data.flavourNotes || ''} onChange={e => set('flavourNotes', e.target.value)} rows={3} />
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
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}