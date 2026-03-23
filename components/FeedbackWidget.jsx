import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const ADMIN = 'Aurelien'

export default function FeedbackWidget({ page, pageId = '' }) {
  const [open,    setOpen]    = useState(true)
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(false)
  const [text,    setText]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('npd_user')
      if (stored) setCurrentUser(JSON.parse(stored))
    } catch (e) {}
  }, [])

  const isAdmin = currentUser?.name === ADMIN || currentUser?.role === 'Product Director'

  useEffect(() => {
    if (open && currentUser) load()
  }, [open, page, pageId, currentUser])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Don't show to unauthenticated users
  if (!currentUser) return null

  const load = async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'feedback'),
        where('page', '==', page),
        where('pageId', '==', pageId),
      )
      const snap = await getDocs(q)
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setItems(docs)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const submit = async () => {
    if (!text.trim() || !currentUser) return
    setSaving(true)
    try {
      const newDoc = {
        page, pageId,
        text:      text.trim(),
        author:    currentUser.name,
        createdAt: new Date().toISOString(),
        upvotes:   [],
        status:    'visible',
      }
      const ref = await addDoc(collection(db, 'feedback'), newDoc)
      setItems(prev => [{ id: ref.id, ...newDoc }, ...prev])
      setText('')
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const upvote = async (item) => {
    if (!currentUser) return
    const already = item.upvotes?.includes(currentUser.name)
    const newUpvotes = already
      ? item.upvotes.filter(n => n !== currentUser.name)
      : [...(item.upvotes || []), currentUser.name]
    await updateDoc(doc(db, 'feedback', item.id), { upvotes: newUpvotes })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, upvotes: newUpvotes } : i))
  }

  const hide = async (item) => {
    await updateDoc(doc(db, 'feedback', item.id), { status: 'hidden', hiddenBy: ADMIN })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'hidden' } : i))
  }

  const unhide = async (item) => {
    await updateDoc(doc(db, 'feedback', item.id), { status: 'visible' })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'visible' } : i))
  }

  const visibleItems = items.filter(i => isAdmin || i.status !== 'hidden')
  const pendingCount  = items.filter(i => i.status === 'visible').length

  return (
    <div ref={panelRef} className="fixed bottom-6 right-4 z-[300] flex flex-col items-end gap-2">

      {/* Expanded panel */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[70vh]">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">Feedback</p>
              <p className="text-xs text-gray-400 mt-0.5">{page}{pageId ? ` · ${pageId.slice(0,8)}` : ''}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
          </div>

          {/* Feed */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-8">Loading...</p>
            ) : visibleItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No feedback yet — be the first.</p>
            ) : visibleItems.map(item => {
              const hidden  = item.status === 'hidden'
              const upvoted = item.upvotes?.includes(currentUser?.name)
              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-gray-800">{item.author}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                        {isAdmin && hidden && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">hidden</span>}
                      </div>
                      <p className={`text-sm leading-relaxed ${hidden ? 'text-gray-400 italic' : 'text-gray-700'}`}>{item.text}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => upvote(item)}
                      className={`flex items-center gap-1 text-xs transition ${upvoted ? 'text-black font-semibold' : 'text-gray-400 hover:text-gray-700'}`}>
                      👍 {item.upvotes?.length || 0}
                    </button>
                    {isAdmin && (
                      <button onClick={() => hidden ? unhide(item) : hide(item)}
                        className="text-xs text-gray-300 hover:text-gray-600 transition ml-auto">
                        {hidden ? 'Restore' : 'Hide'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            {currentUser ? (
              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                  placeholder="Leave feedback... (Enter to send)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
                <button onClick={submit} disabled={saving || !text.trim()}
                  className="w-full py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40">
                  {saving ? 'Sending...' : 'Send feedback'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center">Sign in to leave feedback</p>
            )}
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-xs font-semibold rounded-full shadow-lg hover:bg-gray-900 transition">
        <span>💬</span>
        <span>Feedback</span>
        {!open && pendingCount > 0 && (
          <span className="bg-white text-black text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {pendingCount}
          </span>
        )}
      </button>
    </div>
  )
}