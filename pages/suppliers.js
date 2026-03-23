import { useState, useEffect } from 'react'
import FeedbackWidget from '../components/FeedbackWidget'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const CATEGORIES = ['Powders', 'Juices', 'Flavours', 'Packaging', 'Other']

const EMPTY_SUPPLIER = {
  name: '', category: 'Powders', description: '', contact: '', url: '', certifications: '',
}

export default function SuppliersPage() {
  const router = useRouter()

  const [suppliers,    setSuppliers]    = useState([])
  const [requests,     setRequests]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(false)
  const [editing,      setEditing]      = useState(null)   // supplier doc being edited
  const [form,         setForm]         = useState(EMPTY_SUPPLIER)
  const [saving,       setSaving]       = useState(false)
  const [deleteConfirm,setDeleteConfirm]= useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search,       setSearch]       = useState('')

  useEffect(() => { fetch() }, [])

  const fetch = async () => {
    setLoading(true)
    try {
      const [snap, reqSnap] = await Promise.all([
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'supplierRequests')),
      ])
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      setSuppliers(sorted)
      setRequests(reqSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_SUPPLIER, category: activeCategory === 'All' ? 'Powders' : activeCategory })
    setModal(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, category: s.category, description: s.description || '', contact: s.contact || '', url: s.url || '', certifications: s.certifications || '' })
    setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'suppliers', editing.id), { ...form, updatedAt: new Date().toISOString() })
      } else {
        await addDoc(collection(db, 'suppliers'), { ...form, createdAt: new Date().toISOString() })
      }
      setModal(false)
      setEditing(null)
      setForm(EMPTY_SUPPLIER)
      fetch()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteDoc(doc(db, 'suppliers', deleteConfirm.id))
      setDeleteConfirm(null)
      fetch()
    } catch (e) { console.error(e) }
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const filtered = suppliers.filter(s => {
    const matchCat  = activeCategory === 'All' || s.category === activeCategory
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = suppliers.filter(s => s.category === cat).length
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Approved Suppliers — Bloomin NPD</title></Head>

      {/* Header */}
      <div className="bg-black text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/')} className="flex-shrink-0">
              <img src="/logo.png" alt="Bloomin" className="h-6 sm:h-7 object-contain brightness-0 invert" onError={e => e.target.style.display='none'} />
            </button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <button onClick={() => router.push('/')} className="text-white/50 hover:text-white transition text-sm flex-shrink-0">← Back</button>
            <div className="w-px h-5 bg-white/20 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Approved Suppliers</p>
              <p className="text-xs text-white/50 hidden sm:block">Managed by Chris · {suppliers.length} suppliers</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition flex-shrink-0"
          >
            + Add supplier
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row gap-6 sm:gap-8">

        {/* Sidebar — category filter */}
        <div className="sm:w-48 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2 sm:mb-3">Category</p>
          <div className="flex sm:flex-col gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['All', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 sm:flex-shrink w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-between gap-2 ${activeCategory === cat ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <span className="truncate">{cat}</span>
                <span className={`text-xs flex-shrink-0 ${activeCategory === cat ? 'text-white/50' : 'text-gray-400'}`}>
                  {cat === 'All' ? suppliers.length : (counts[cat] || 0)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Pending supplier requests — always visible if any exist */}
          {requests.length > 0 && (
            <div className={`rounded-2xl overflow-hidden border-2 ${requests.filter(r => r.status === 'pending').length > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className={`px-5 py-3.5 flex items-center justify-between ${requests.filter(r => r.status === 'pending').length > 0 ? 'bg-amber-400' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{requests.filter(r => r.status === 'pending').length > 0 ? '⚠️' : '✓'}</span>
                  <p className={`text-sm font-bold ${requests.filter(r => r.status === 'pending').length > 0 ? 'text-white' : 'text-gray-500'}`}>
                    {requests.filter(r => r.status === 'pending').length > 0
                      ? `${requests.filter(r => r.status === 'pending').length} new supplier request${requests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''} — action needed`
                      : 'All supplier requests handled'}
                  </p>
                </div>
              </div>
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <div className="divide-y divide-amber-100">
                  {requests.filter(r => r.status === 'pending').map(req => (
                    <div key={req.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-gray-900">{req.supplierName}</p>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">New</span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Needed for <strong>{req.ingredientName || 'ingredient'}</strong>
                          {' '}· {req.productName} / {req.clientName}
                          {req.requestedBy ? <span className="text-gray-400"> · requested by {req.requestedBy}</span> : ''}
                          {req.createdAt ? <span className="text-gray-400"> · {new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span> : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setForm({ ...EMPTY_SUPPLIER, name: req.supplierName })
                            setEditing(null)
                            setModal(true)
                            updateDoc(doc(db, 'supplierRequests', req.id), { status: 'actioned' }).catch(console.error)
                            setRequests(rs => rs.map(r => r.id === req.id ? { ...r, status: 'actioned' } : r))
                          }}
                          className="px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition whitespace-nowrap"
                        >+ Add to directory</button>
                        <button
                          onClick={() => {
                            updateDoc(doc(db, 'supplierRequests', req.id), { status: 'rejected' }).catch(console.error)
                            setRequests(rs => rs.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))
                          }}
                          className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition"
                        >Dismiss</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
          />

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
              <p className="text-gray-400 text-sm">Loading suppliers...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center">
              <p className="text-3xl mb-3">📦</p>
              <p className="font-semibold text-gray-700">No suppliers yet</p>
              <p className="text-sm text-gray-400 mt-1">Hit "+ Add supplier" to get started</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-bold text-gray-700">{cat}</h2>
                  <span className="text-xs text-gray-400">{items.length} supplier{items.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
                    {[['Supplier', 4], ['Description', 3], ['Contact', 3], ['', 2]].map(([h, span]) => (
                      <p key={h} className={`text-xs font-semibold text-gray-400 uppercase tracking-wide col-span-${span}`}>{h}</p>
                    ))}
                  </div>

                  <div className="divide-y divide-gray-50">
                    {items.map(s => (
                      <div key={s.id} className="px-5 py-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center hover:bg-gray-50/50 transition group">
                        {/* Name + cert + URL */}
                        <div className="sm:col-span-4 mb-2 sm:mb-0">
                          <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {s.certifications && (
                              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{s.certifications}</span>
                            )}
                            {s.url && (
                              <a href={s.url.startsWith('http') ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer"
                                className="text-xs text-gray-400 hover:text-black transition underline truncate max-w-[160px]">
                                {s.url.replace(/^https?:\/\//, '').split('/')[0]}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-3 mb-2 sm:mb-0">
                          <p className="text-sm text-gray-600 line-clamp-2">{s.description || <span className="text-gray-300 italic">—</span>}</p>
                        </div>

                        {/* Contact */}
                        <div className="sm:col-span-3 mb-2 sm:mb-0">
                          {s.contact
                            ? <a href={`mailto:${s.contact}`} className="text-sm text-gray-600 hover:text-black transition truncate block">{s.contact}</a>
                            : <span className="text-sm text-gray-300 italic">—</span>
                          }
                        </div>

                        {/* Actions */}
                        <div className="sm:col-span-2 flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(s)}
                            className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(s)}
                            className="px-3 py-1.5 border border-red-100 text-red-400 text-xs font-medium rounded-lg hover:bg-red-50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit supplier' : 'Add supplier'}</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier name *</label>
                  <input
                    value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Impact Foods"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category *</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Certifications</label>
                  <input
                    value={form.certifications} onChange={e => set('certifications', e.target.value)}
                    placeholder="e.g. BRC, SALSA, Organic"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Superfoods / powders / spices. Will source if they don't stock it."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact email</label>
                <input
                  value={form.contact} onChange={e => set('contact', e.target.value)}
                  placeholder="e.g. aled@impactfoods.co.uk"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Website URL</label>
                <input
                  value={form.url} onChange={e => set('url', e.target.value)}
                  placeholder="e.g. https://www.impactfoods.co.uk"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setModal(false); setEditing(null); setForm(EMPTY_SUPPLIER) }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition disabled:opacity-40"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Add supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-4 text-center">
            <p className="text-2xl">🗑️</p>
            <h2 className="text-lg font-bold text-gray-900">Delete "{deleteConfirm.name}"?</h2>
            <p className="text-sm text-gray-400">This won't affect existing scoping sheets that already reference this supplier.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      <FeedbackWidget page="suppliers" />
    </div>
  )
}