// scripts/seedSuppliers.js
// Run: node scripts/seedSuppliers.js
// Uses the same client Firebase SDK as the app — no service account needed.
// Reads credentials from .env.local automatically.

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Read .env.local ───────────────────────────────────────────────────────────
const envPath = join(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const firebaseConfig = {
  apiKey:            env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

console.log(`✓ Connected to Firebase project: ${firebaseConfig.projectId}`)

// ── Supplier data ─────────────────────────────────────────────────────────────
const SUPPLIERS = [

  // Powders
  { category: 'Powders', name: 'Impact Foods',          description: "Superfoods, powders, spices, obscure ingredients. Will source if they don't stock it.", contact: 'aled@impactfoods.co.uk',                   url: 'https://www.impactfoods.co.uk',      certifications: '' },
  { category: 'Powders', name: 'Kilo',                  description: 'Base powders — Malic acid, Citric acid, Potassium Sorbate.',                            contact: 'ella.Barnett@kiloltd.co.uk',               url: '',                                   certifications: '' },
  { category: 'Powders', name: 'Shepcote',              description: 'Sugars.',                                                                                contact: '',                                         url: '',                                   certifications: '' },
  { category: 'Powders', name: 'Neutracuticals',        description: 'Powders, vitamins, functional ingredients, collagen.',                                   contact: 'tim.merron@nutraceuticalsgroup.com',       url: 'https://www.nutraceuticalsgroup.com', certifications: '' },
  { category: 'Powders', name: 'Laybio',                description: '',                                                                                        contact: 'emma@laybionatural.com',                   url: '',                                   certifications: '' },
  { category: 'Powders', name: 'Cambridge Commodities', description: '',                                                                                        contact: 'Royvin.Robinson@cambridgecommodities.com', url: '',                                   certifications: '' },
  { category: 'Powders', name: 'Kent Foods',            description: 'Sugar, Glycerine.',                                                                      contact: '',                                         url: '',                                   certifications: '' },

  // Juices
  { category: 'Juices', name: 'Gerald Mcdonald', description: 'Juices.',  contact: '', url: '', certifications: '' },
  { category: 'Juices', name: 'Uren',             description: 'Juices.',  contact: '', url: '', certifications: '' },
  { category: 'Juices', name: 'Ethimix',          description: 'Alcohol.', contact: '', url: '', certifications: '' },
  { category: 'Juices', name: 'Red Distillery',   description: 'Alcohol.', contact: '', url: '', certifications: '' },

  // Flavours
  { category: 'Flavours', name: 'Kerry',     description: '', contact: '', url: '', certifications: '' },
  { category: 'Flavours', name: 'Firmenich', description: '', contact: '', url: '', certifications: '' },
  { category: 'Flavours', name: 'Omega',     description: '', contact: '', url: '', certifications: '' },
  { category: 'Flavours', name: 'ITS',       description: '', contact: '', url: '', certifications: '' },
  { category: 'Flavours', name: 'Treatt',    description: '', contact: '', url: '', certifications: '' },
  { category: 'Flavours', name: 'Givauden',  description: '', contact: '', url: '', certifications: '' },

  // Packaging
  { category: 'Packaging', name: 'Bostocap',          description: '750ml glass bottle caps.',      contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Watershed',          description: 'Labels.',                       contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Expert Packaging',   description: '6/4-pack syrup bottle boxes.',  contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Chadwicks',          description: 'LIC Lids.',                     contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Smurfit Westrock',   description: 'Cardboard packaging.',          contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Viscose Closure',    description: '750ml glass bottle caps.',      contact: '', url: '', certifications: '' },
  { category: 'Packaging', name: 'Croxons',            description: 'Glass bottles.',                contact: '', url: '', certifications: '' },
]

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\nSeeding ${SUPPLIERS.length} suppliers...\n`)

  const col = collection(db, 'suppliers')
  const existing = await getDocs(col)
  const existingNames = new Set(existing.docs.map(d => d.data().name?.toLowerCase()))

  let added = 0, skipped = 0

  for (const supplier of SUPPLIERS) {
    if (existingNames.has(supplier.name.toLowerCase())) {
      console.log(`  ⏭  Skip (exists): ${supplier.name}`)
      skipped++
      continue
    }
    await addDoc(col, { ...supplier, createdAt: new Date().toISOString() })
    console.log(`  ✓  Added: ${supplier.name} [${supplier.category}]`)
    added++
  }

  console.log(`\nDone — ${added} added, ${skipped} skipped.\n`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})