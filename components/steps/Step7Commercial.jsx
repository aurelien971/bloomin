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
  if (isFilled) return null
  return children
}

import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const CONTACT_TYPES = [
  { key: 'npd',        label: 'NPD contact',          hint: 'Your product development or innovation lead' },
  { key: 'supplyChain',label: 'Supply chain contact',  hint: 'Who handles ordering, logistics, distribution' },
  { key: 'technical',  label: 'Technical contact',     hint: 'Your food tech or QA person, if you have one' },
]

export default function Step7Commercial({ data, onChange, brief }) {
  const set = (f, v) => onChange({ ...data, [f]: v })

  const currency = data.priceCurrency || 'GBP'
  const symbol   = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
  const clientId = brief?.clientId

  // Saved contacts for this client
  const [savedContacts, setSavedContacts] = useState([])

  useEffect(() => {
    if (!clientId) return
    getDocs(query(collection(db, 'clientContacts'), where('clientId', '==', clientId)))
      .then(snap => setSavedContacts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
  }, [clientId])

  const setContact = (type, field, value) => {
    const curr = data[`contact_${type}`] || {}
    set(`contact_${type}`, { ...curr, [field]: value })
  }

  const saveContact = async (type) => {
    const c = data[`contact_${type}`] || {}
    if (!c.name || !clientId) return
    // Check not already saved (by name + email)
    const exists = savedContacts.some(s => s.name === c.name && s.email === c.email && s.type === type)
    if (exists) return
    try {
      const ref = await addDoc(collection(db, 'clientContacts'), {
        clientId, clientName: brief?.clientName || '',
        type, name: c.name, email: c.email || '', title: c.title || '',
        createdAt: new Date().toISOString(),
      })
      setSavedContacts(prev => [...prev, { id: ref.id, clientId, type, name: c.name, email: c.email || '', title: c.title || '' }])
    } catch (e) { console.error(e) }
  }

  const applyContact = (type, contact) => {
    set(`contact_${type}`, { name: contact.name, email: contact.email, title: contact.title })
  }

  return (
    <div className="space-y-6">

      <HideIfFilled keys={['targetCostMin', 'targetCostMax']} data={data}>
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
            <span className="text-sm text-gray-400">{symbol} per bottle</span>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Estimated monthly volume</label>
        <p className="text-xs text-gray-400 mb-2">Roughly how many cases per month once launched? This helps us with production planning.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="0" placeholder="e.g. 50"
            value={data.casesPerMonth || ''} onChange={e => set('casesPerMonth', e.target.value)}
            className="w-40 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-sm text-gray-500">cases / month</span>
        </div>
      </div>
      </HideIfFilled>

      {/* Contacts */}
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Your key contacts</label>
          <p className="text-xs text-gray-400">We'll route different conversations to the right people. Fill in what's relevant — some contacts may be the same person.</p>
        </div>

        {CONTACT_TYPES.map(({ key, label, hint }) => {
          const current = data[`contact_${key}`] || {}
          const typeContacts = savedContacts.filter(c => c.type === key)
          const isSaved = typeContacts.some(s => s.name === current.name && s.email === current.email)

          return (
            <div key={key} className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-gray-50/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{hint}</p>
                </div>
                {/* Save contact button */}
                {current.name && !isSaved && (
                  <button type="button" onClick={() => saveContact(key)}
                    className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition flex-shrink-0">
                    💾 Save
                  </button>
                )}
                {isSaved && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg flex-shrink-0">✓ Saved</span>
                )}
              </div>

              {/* Saved contacts dropdown — show if any exist for this type */}
              {typeContacts.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Previously saved:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {typeContacts.map(c => (
                      <button key={c.id} type="button" onClick={() => applyContact(key, c)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                          current.name === c.name && current.email === c.email
                            ? 'bg-black text-white border-black'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}>
                        <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {c.name?.[0]?.toUpperCase()}
                        </span>
                        {c.name}
                        {c.title && <span className="opacity-60">· {c.title}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input placeholder="Full name"
                  value={current.name || ''}
                  onChange={e => setContact(key, 'name', e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="email" placeholder="Email"
                  value={current.email || ''}
                  onChange={e => setContact(key, 'email', e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input placeholder="Job title"
                  value={current.title || ''}
                  onChange={e => setContact(key, 'title', e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )
        })}
      </div>

      <HideIfFilled keys={['anythingElse']} data={data}>
      {/* Anything else */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">Anything else we should know?</label>
        <textarea
          placeholder="Performance requirements, constraints, specific inspirations, anything else..."
          value={data.anythingElse || ''} onChange={e => set('anythingElse', e.target.value)}
          rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>
      </HideIfFilled>

    </div>
  )
}