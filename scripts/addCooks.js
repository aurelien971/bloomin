// scripts/addCooks.js
// Run: node scripts/addCooks.js
// Adds Harry and Mike as Cook users. Safe to re-run — skips if already exists.

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const app = initializeApp({
  apiKey:            env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.NEXT_PUBLIC_FIREBASE_APP_ID,
})
const db = getFirestore(app)
console.log(`✓ Connected to: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`)

const NEW_USERS = [
  { name: 'Harry', role: 'Cook', password: 'Bloomin123' },
  { name: 'Mike',  role: 'Cook', password: 'Bloomin123' },
  { name: 'Dima',  role: 'Cook', password: 'Bloomin123' },  // ensure Dima is also marked as Cook
]

async function run() {
  const col = collection(db, 'users')
  const existing = await getDocs(col)
  const existingNames = new Set(existing.docs.map(d => d.data().name?.toLowerCase()))

  for (const u of NEW_USERS) {
    if (existingNames.has(u.name.toLowerCase())) {
      // Update role to Cook if Dima exists but doesn't have Cook role
      const snap = existing.docs.find(d => d.data().name?.toLowerCase() === u.name.toLowerCase())
      if (snap && snap.data().role !== 'Cook') {
        const { updateDoc, doc } = await import('firebase/firestore')
        await updateDoc(doc(db, 'users', snap.id), { role: 'Cook' })
        console.log(`  ✏️  Updated role: ${u.name} → Cook`)
      } else {
        console.log(`  ⏭  Already exists: ${u.name}`)
      }
      continue
    }
    await addDoc(col, { ...u, createdAt: new Date().toISOString() })
    console.log(`  ✓  Added: ${u.name} [${u.role}]`)
  }

  console.log('\nDone.\n')
  process.exit(0)
}

run().catch(err => { console.error(err.message); process.exit(1) })