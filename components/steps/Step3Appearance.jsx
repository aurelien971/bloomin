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

const CLARITY    = ['Crystal clear', 'Slightly hazy', 'Opaque', 'Thick & opaque', 'Grainy / textured']
const END_DRINKS = ['Matcha latte', 'Iced coffee', 'Hot chocolate', 'Milk drink', 'Sparkling water / soda', 'Cocktail / mocktail', 'Smoothie', 'Other']

export default function Step3Appearance({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })

  return (
    <div className="space-y-6">

      <HideIfFilled keys={['endDrinkType', 'endDrinkTypeOther']} data={data}>
        <Field label="What is the end drink?" hint="What will this syrup actually be used in? This shapes everything — colour, clarity, texture.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {END_DRINKS.map(o => <Chip key={o} label={o} active={data.endDrinkType === o} onClick={() => set('endDrinkType', o)} />)}
          </div>
          {data.endDrinkType === 'Other' && (
            <input className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Describe the end drink..." value={data.endDrinkTypeOther || ''} onChange={e => set('endDrinkTypeOther', e.target.value)} />
          )}
        </Field>
      </HideIfFilled>

      <div className="border border-gray-100 rounded-2xl p-5 space-y-5 bg-gray-50/50">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Colour — two things to define</p>

        <HideIfFilled keys={['syrupColour']} data={data}>
          <Field label="🫙 Syrup colour — what should it look like in the bottle?" hint="Describe the neat syrup itself, before it hits any drink.">
            <input placeholder="e.g. Deep inky black, golden amber, pale blush pink" value={data.syrupColour || ''} onChange={e => set('syrupColour', e.target.value)} />
          </Field>
        </HideIfFilled>

        <HideIfFilled keys={['endDrinkColour']} data={data}>
          <Field label="🥤 End drink colour — what should the finished drink look like?" hint="Once the syrup is added to milk, water, soda — what colour should the customer see in their glass?">
            <input placeholder="e.g. A warm grey-brown latte, a vivid pink soda, a pale green matcha" value={data.endDrinkColour || ''} onChange={e => set('endDrinkColour', e.target.value)} />
          </Field>
        </HideIfFilled>
      </div>

      <HideIfFilled keys={['clarity']} data={data}>
        <Field label="How should the syrup look in the bottle?" hint="Select all that apply.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CLARITY.map(o => {
              const curr = Array.isArray(data.clarity) ? data.clarity : (data.clarity ? [data.clarity] : [])
              const active = curr.includes(o)
              const toggle = () => set('clarity', active ? curr.filter(x => x !== o) : [...curr, o])
              return <Chip key={o} label={o} active={active} onClick={toggle} />
            })}
          </div>
        </Field>
      </HideIfFilled>

      <HideIfFilled keys={['colourReference', 'referencePhotos']} data={data}>
        <Field label="Any colour or appearance references?" hint="Upload photos of competitor products, drinks you love, or anything that captures the vibe.">
          <input placeholder="Link to an image or describe a reference product..." value={data.colourReference || ''} onChange={e => set('colourReference', e.target.value)} />
          <div className="mt-2 space-y-2">
            {(data.referencePhotos || []).map((photo, i) => (
              <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-sm">📎</span>
                <span className="text-sm text-green-800 truncate flex-1">{photo.name}</span>
                <button type="button" onClick={() => set('referencePhotos', (data.referencePhotos || []).filter((_, idx) => idx !== i))}
                  className="text-green-400 hover:text-red-500 font-bold text-lg leading-none flex-shrink-0">×</button>
              </div>
            ))}
            <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 cursor-pointer hover:border-gray-400 transition">
              <span>📎</span>
              <span>{(data.referencePhotos || []).length > 0 ? 'Add another reference photo' : 'Upload reference photos (optional)'}</span>
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) { set('referencePhotos', [...(data.referencePhotos || []), { name: file.name, file }]); e.target.value = '' }
                }} />
            </label>
          </div>
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

function Chip({ label, active, onClick, wide }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${wide ? 'w-full' : ''} ${active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}>
      {label}
    </button>
  )
}