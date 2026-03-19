const CLARITY    = ['Crystal clear', 'Slightly hazy', 'Opaque', 'Thick & opaque', 'Grainy / textured']
const END_DRINKS = ['Matcha latte', 'Iced coffee', 'Hot chocolate', 'Milk drink', 'Sparkling water / soda', 'Cocktail / mocktail', 'Smoothie', 'Other']

export default function Step3Appearance({ data, onChange }) {
  const set = (f, v) => onChange({ ...data, [f]: v })
  return (
    <div className="space-y-6">

      <Field
        label="What is the end drink?"
        hint="What will this syrup actually be used in? This shapes everything — colour, clarity, texture."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {END_DRINKS.map(o => <Chip key={o} label={o} active={data.endDrinkType === o} onClick={() => set('endDrinkType', o)} />)}
        </div>
        {data.endDrinkType === 'Other' && (
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Describe the end drink..."
            value={data.endDrinkTypeOther || ''}
            onChange={e => set('endDrinkTypeOther', e.target.value)}
          />
        )}
      </Field>

      <div className="border border-gray-100 rounded-2xl p-5 space-y-5 bg-gray-50/50">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Colour — two things to define</p>

        <Field
          label="🫙 Syrup colour — what should it look like in the bottle?"
          hint="Describe the neat syrup itself, before it hits any drink."
        >
          <input
            placeholder="e.g. Deep inky black, golden amber, pale blush pink"
            value={data.syrupColour || ''}
            onChange={e => set('syrupColour', e.target.value)}
          />
          {data.syrupColour && data.syrupColour.startsWith('#') && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: data.syrupColour }} />
              <span className="text-xs text-gray-400">Colour preview</span>
            </div>
          )}
        </Field>

        <Field
          label="🥤 End drink colour — what should the finished drink look like?"
          hint="Once the syrup is added to milk, water, soda — what colour should the customer see in their glass?"
        >
          <input
            placeholder="e.g. A warm grey-brown latte, a vivid pink soda, a pale green matcha"
            value={data.endDrinkColour || ''}
            onChange={e => set('endDrinkColour', e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="How should the syrup look in the bottle?"
        hint="Clarity and texture of the neat syrup."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CLARITY.map(o => <Chip key={o} label={o} active={data.clarity === o} onClick={() => set('clarity', o)} />)}
        </div>
      </Field>

      <Field label="Any colour references?" hint="A photo link, a competitor product, a drink you've seen.">
        <input
          placeholder="e.g. Similar to a pink lemonade, or see this link: ..."
          value={data.colourReference || ''}
          onChange={e => set('colourReference', e.target.value)}
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