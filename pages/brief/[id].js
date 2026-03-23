import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc, addDoc, collection } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import BriefForm from '../../components/BriefForm'
import FeedbackWidget from '../../components/FeedbackWidget'
import Head from 'next/head'

function getBrowser(ua) {
  if (ua.includes('Edg'))     return 'Edge'
  if (ua.includes('Chrome'))  return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari'))  return 'Safari'
  return 'Unknown'
}

export default function BriefPage() {
  const router  = useRouter()
  const { id }  = router.query

  const [brief,   setBrief]   = useState(null)
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'briefs', id))
      .then(snap => {
        if (!snap.exists()) { setError(true); setLoading(false); return }
        const b = { id: snap.id, ...snap.data() }
        setBrief(b)
        setLoading(false)
        // Log visit
        addDoc(collection(db, 'briefs', id, 'visits'), {
          visitedAt: new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Europe/London',
          }),
          browser:   getBrowser(navigator.userAgent),
          userAgent: navigator.userAgent,
          language:  navigator.language,
        }).catch(console.error)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Loading your brief...</p>
      </div>
    </div>
  )

  if (error || !brief) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-2">
        <p className="text-4xl">🔍</p>
        <h1 className="text-xl font-bold text-gray-800">Brief not found</h1>
        <p className="text-gray-400 text-sm">This link may have expired or doesn't exist.</p>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>Product Brief — {brief.clientName}</title></Head>
      <BriefForm brief={brief} />
      <FeedbackWidget page="brief" pageId={brief.id} />
    </>
  )
}