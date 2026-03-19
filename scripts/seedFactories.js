// scripts/seedFactories.js
// Run: node scripts/seedFactories.js
// Creates the four Bloomin production facilities in Firestore with their certifications.
// Safe to re-run — skips existing ones by name.
// Edit certifications here as they change over time.

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, query, where, updateDoc, doc } from 'firebase/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...rest] = l.split('='); return [k.trim(), rest.join('=').trim()] })
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

// ── Factory data ──────────────────────────────────────────────────────────────
// Add/update certifications here as things change.
// Keys must be lowercase: salsa, brc, haccp, organic
const FACTORIES = [
  {
    name:    'Red Distillery',
    salsa:   true,
    brc:     false,
    haccp:   true,
    organic: false,
    notes:   'Primary production facility. Hot fill capable.',
  },
  {
    name:    'Calyx',
    salsa:   true,
    brc:     true,
    haccp:   true,
    organic: false,
    notes:   'BRC accredited. Suitable for retail-grade production.',
  },
  {
    name:    'Voxel',
    salsa:   false,
    brc:     false,
    haccp:   true,
    organic: false,
    notes:   'Smaller batches. R&D and limited run production.',
  },
  {
    name:    'Rhode Island',
    salsa:   true,
    brc:     false,
    haccp:   true,
    organic: true,
    notes:   'Organic certified. Cold mix capable.',
  },
]

async function seed() {
  console.log(`\nSeeding ${FACTORIES.length} factories...\n`)
  const col = collection(db, 'factories')
  const existing = await getDocs(col)
  const existingMap = {}
  existing.docs.forEach(d => { existingMap[d.data().name?.toLowerCase()] = d.id })

  for (const factory of FACTORIES) {
    const key = factory.name.toLowerCase()
    if (existingMap[key]) {
      // Update in place to keep certifications current
      await updateDoc(doc(db, 'factories', existingMap[key]), { ...factory, updatedAt: new Date().toISOString() })
      console.log(`  ✏️  Updated: ${factory.name} [SALSA:${factory.salsa} BRC:${factory.brc} HACCP:${factory.haccp} Organic:${factory.organic}]`)
    } else {
      await addDoc(col, { ...factory, createdAt: new Date().toISOString() })
      console.log(`  ✓  Added:   ${factory.name} [SALSA:${factory.salsa} BRC:${factory.brc} HACCP:${factory.haccp} Organic:${factory.organic}]`)
    }
  }

  console.log('\nDone. Factories will now appear in the Lab Development sheet Production tab.')
  console.log('Edit certification booleans in this script as they change, then re-run.\n')
  process.exit(0)
}

seed().catch(err => { console.error(err.message); process.exit(1) })