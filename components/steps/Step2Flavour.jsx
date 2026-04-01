import { useContext } from 'react'
import { FilterEmptyContext } from '../BriefForm'

function HideIfFilled({ keys, data, children }) {
  const filterEmpty = useContext(FilterEmptyContext)
  if (!filterEmpty) return children
  const isFilled = keys.some(k => {
    const v = data[k]
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })
  return isFilled ? null : children
}

const SWEETNESS  = ['Very sweet', 'Sweet', 'Balanced', 'Lightly sweet', 'Barely sweet']
const ACIDITY    = ['None', 'Low', 'Medium', 'High']
const AFTERTASTE = ['Clean finish', 'Lingering sweetness', 'Fruity finish', 'Floral finish', 'Slightly bitter finish', 'No preference']

export default function Step2Flavour({ data, onChange }) {
  const set = (field, value) => onChange({ ...data, [field]: value })

  return (
    <div className="space-y-6">

      <HideIfFilled keys={['primaryFlavour']} data={data}>
        <Field label="What is the main flavour?" hint="Be specific — 'dark cherry' rather than just 'cherry'.">
          <input type="text" placeholder="e.g. Dark cherry with a hint of rose"
            value={data.primaryFlavour || ''} onChange={e => set('primaryFlavour', e.target.value)} />
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['secondaryFlavour']} data={data}>
        <Field label="Any supporting flavour notes?" hint="Secondary flavours that complement the main one.">
          <input type="text" placeholder="e.g. Slight vanilla, light floral, subtle almond"
            value={data.secondaryFlavour || ''} onChange={e => set('secondaryFlavour', e.target.value)} />
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['flavourExclusions']} data={data}>
        <Field label="Any flavours you absolutely do NOT want?">
          <input type="text" placeholder="e.g. Nothing artificial, no smokiness"
            value={data.flavourExclusions || ''} onChange={e => set('flavourExclusions', e.target.value)} />
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['sweetness']} data={data}>
        <Field label="How sweet should it be?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
            {SWEETNESS.map(opt => (
              <ToggleBtn key={opt} label={opt} active={data.sweetness === opt} onClick={() => set('sweetness', opt)} />
            ))}
          </div>
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['acidity']} data={data}>
        <Field label="How acidic should it be?">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {ACIDITY.map(opt => (
              <ToggleBtn key={opt} label={opt} active={data.acidity === opt} onClick={() => set('acidity', opt)} />
            ))}
          </div>
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['aftertaste']} data={data}>
        <Field label="What should the finish / aftertaste feel like?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
            {AFTERTASTE.map(opt => (
              <ToggleBtn key={opt} label={opt} active={data.aftertaste === opt} onClick={() => set('aftertaste', opt)} />
            ))}
          </div>
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['flavourNotes']} data={data}>
        <Field label="Anything else about the taste we should know?">
          <textarea
            placeholder="e.g. It should taste like a real cherry, not a fake sweet one. The rose note should be subtle."
            value={data.flavourNotes || ''} onChange={e => set('flavourNotes', e.target.value)} rows={3} />
        </Field>
      </HideIfFilled>

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

function ToggleBtn({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}