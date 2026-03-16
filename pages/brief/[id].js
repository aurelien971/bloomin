import { useEffect } from 'react'
import { doc, getDoc, addDoc, collection } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import BriefForm from '../../components/BriefForm'
import Head from 'next/head'

function getBrowser(ua) {
  if (ua.includes('Edg'))     return 'Edge'
  if (ua.includes('Chrome'))  return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari'))  return 'Safari'
  return 'Unknown'
}
 
export default function BriefPage({ brief, error }) {
  useEffect(() => {
    if (!brief?.id) return
    addDoc(collection(db, 'briefs', brief.id, 'visits'), {
      visitedAt: new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      browser:   getBrowser(navigator.userAgent),
      userAgent: navigator.userAgent,
      language:  navigator.language,
    }).catch(console.error)
  }, [])

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
    </>
  )
}

export async function getServerSideProps({ params }) {
  try {
    const snap = await getDoc(doc(db, 'briefs', params.id))
    if (!snap.exists()) return { props: { brief: null, error: true } }
    return { props: { brief: { id: snap.id, ...snap.data() } } }
  } catch (e) {
    return { props: { brief: null, error: true } }
  }
}