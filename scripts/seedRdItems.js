// seedRdItems.cjs — run once: node scripts/seedRdItems.cjs
// Uploads all R&D sampling items from the spreadsheet to Firestore
// Each gets a unique 4-letter product code

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore')

const firebaseConfig = {
  apiKey:            "AIzaSyD-YOUR-KEY",           // ← paste your config here
  authDomain:        "bloomin-2d4a2.firebaseapp.com",
  projectId:         "bloomin-2d4a2",
  storageBucket:     "bloomin-2d4a2.firebasestorage.app",
  messagingSenderId: "YOUR-SENDER-ID",
  appId:             "YOUR-APP-ID",
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
function genCode(existing) {
  let code
  do { code = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('') }
  while (existing.has(code))
  existing.add(code)
  return code
}

// ── Client name → Firestore ID mapping ───────────────────────────────────────
// After running this script, check your Firestore "clients" collection and
// fill in the real IDs below if you want the client link to work.
// For now we store clientName only — the dashboard still shows it fine.

// ── R&D items from the spreadsheet ───────────────────────────────────────────

const RD_ITEMS = [
  // Aqua Pro
  { productName: 'Protein Water v2',              clientName: 'Aqua Pro',         status: 'sampling',   dueDate: '',           assignedTo: '',      notes: 'Pineapple signed off. Feedback on passionfruit — needs more passionfruit. Need to make cloudy lemonade, lemonade, orangeade.' },

  // Bank Street
  { productName: 'Madeline Syrup',                clientName: 'Bank Street',      status: 'sampling',   dueDate: '2026-03-01', assignedTo: '',      notes: '' },
  { productName: 'Chai Concentrate',              clientName: 'Bank Street',      status: 'sampling',   dueDate: '2026-03-01', assignedTo: '',      notes: '' },
  { productName: 'UK Strawberry Syrup',           clientName: 'Bank Street',      status: 'complete',   dueDate: '2026-03-01', assignedTo: '',      notes: 'Approved / Complete' },
  { productName: 'Black Sesame Syrup',            clientName: 'Bank Street',      status: 'on-hold',    dueDate: '',           assignedTo: '',      notes: 'Not sure this one will go ahead soon.' },

  // Black Sheep
  { productName: 'Revised Rose Collagen Sample',  clientName: 'Black Sheep Coffee', status: 'on-hold',  dueDate: '',           assignedTo: '',      notes: 'Working out relationship.' },
  { productName: 'Revised Protein Sample (Cambridge C)', clientName: 'Black Sheep Coffee', status: 'on-hold', dueDate: '2026-01-01', assignedTo: 'Ruth', notes: 'Added by Ruth.' },

  // Blank Street
  { productName: 'White Chocolate Brief',         clientName: 'Blank Street Coffee', status: 'sampling', dueDate: '2026-02-28', assignedTo: '',     notes: 'Almost completed — waiting feedback.' },
  { productName: 'Summer Peach',                  clientName: 'Blank Street Coffee', status: 'sampling', dueDate: '2026-02-01', assignedTo: '',     notes: 'Made — they just need to approve.' },
  { productName: 'Maple Chai',                    clientName: 'Blank Street Coffee', status: 'not-started', dueDate: '2026-02-01', assignedTo: '',  notes: 'UK/US — awaiting brief.' },
  { productName: 'Protein Concentrate',           clientName: 'Blank Street Coffee', status: 'on-hold',  dueDate: '2026-01-01', assignedTo: '',     notes: 'Microbiological issues — on hold.' },
  { productName: 'Blueberry',                     clientName: 'Blank Street Coffee', status: 'sampling', dueDate: '2026-03-01', assignedTo: 'Jesse', notes: 'Jesse ordering extracts, soon to be signed off.' },
  { productName: 'Tigernut DayDream',             clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Peach',                         clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Magic Shell',                   clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '',           assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Coconut Syrup',                 clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Coconut Cream',                 clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Peach Syrup',                   clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Lemon Syrup',                   clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Electrolyte Dragonfruit Syrup', clientName: 'Blank Street Coffee', status: 'tasting',  dueDate: '2026-03-01', assignedTo: '',     notes: 'Being tasted.' },
  { productName: 'Matcha',                        clientName: 'Blank Street Coffee', status: 'not-started', dueDate: '2026-03-01', assignedTo: '',  notes: '' },
  { productName: 'Daydream V2',                   clientName: 'Blank Street Coffee', status: 'complete', dueDate: '2026-03-01', assignedTo: '',     notes: 'Approved / Complete.' },

  // GAILS
  { productName: 'Chocolate Syrup',               clientName: "Gail's",           status: 'sampling',   dueDate: '2025-11-15', assignedTo: '',      notes: "Awaiting GAILS to send XOCO product before we can make." },
  { productName: 'Chai Syrup',                    clientName: "Gail's",           status: 'on-hold',    dueDate: '2026-01-01', assignedTo: '',      notes: 'Send with T&G package on 8th.' },
  { productName: 'Muscavado Syrup',               clientName: "Gail's",           status: 'on-hold',    dueDate: '2026-01-01', assignedTo: '',      notes: 'n/a' },

  // Joe & The Juice
  { productName: 'Collagen (Skin Blend)',         clientName: 'Joe and the Juice', status: 'sampling',  dueDate: '2026-02-01', assignedTo: '',      notes: 'Skin Blend V2 — samples being made.' },
  { productName: 'Functional Overview',           clientName: 'Joe and the Juice', status: 'sampling',  dueDate: '2026-02-01', assignedTo: '',      notes: 'V2 formulations.' },
  { productName: 'Matcha Range',                  clientName: 'Joe and the Juice', status: 'sampling',  dueDate: '2026-03-01', assignedTo: '',      notes: 'Approved / Complete.' },
  { productName: 'Black Sesame Syrup',            clientName: 'Joe and the Juice', status: 'complete',  dueDate: '2026-03-01', assignedTo: '',      notes: '' },
  { productName: 'Vanilla',                       clientName: 'Joe and the Juice', status: 'sampling',  dueDate: '2026-03-01', assignedTo: '',      notes: 'Waiting on feedback.' },
  { productName: 'Power Shake Syrup',             clientName: 'Joe and the Juice', status: 'sampling',  dueDate: '2026-03-01', assignedTo: '',      notes: 'Waiting on feedback.' },
]

// ── Seed ─────────────────────────────────────────────────────────────────────

// ── Name aliases — maps spreadsheet names to your Firestore client names ─────
const CLIENT_ALIASES = {
  'bank street':  'blank street coffee',
  'aqua pro':     'foodlab',
  'gails':        "gail's",
  'joe & the juice': 'joe and the juice',
}

function resolveClientName(name) {
  const lower = name.toLowerCase().trim()
  return CLIENT_ALIASES[lower] || lower
}

async function seed() {
  console.log('🌱 Fetching existing clients...')
  const cSnap = await getDocs(collection(db, 'clients'))
  const clientMap = {}
  cSnap.docs.forEach(d => {
    const name = d.data().name?.toLowerCase().trim()
    clientMap[name] = { id: d.id, name: d.data().name }
  })
  console.log(`   Found clients: ${Object.values(clientMap).map(c => c.name).join(', ')}`)

  console.log('\n🌱 Fetching existing codes and R&D items...')
  const existing = new Set()
  const [pSnap, rSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'rdItems')),
  ])
  pSnap.docs.forEach(d => { if (d.data().code) existing.add(d.data().code) })
  rSnap.docs.forEach(d => { if (d.data().code) existing.add(d.data().code) })

  // Build set of already-seeded product names (lowercased) to skip duplicates
  const existingNames = new Set(rSnap.docs.map(d => d.data().productName?.toLowerCase().trim()))
  console.log(`   ${existing.size} existing codes, ${existingNames.size} existing R&D items loaded`)

  console.log(`\n📦 Seeding R&D items...\n`)

  let seeded = 0, skipped = 0

  for (const item of RD_ITEMS) {
    const nameKey = item.productName.toLowerCase().trim()
    if (existingNames.has(nameKey)) {
      console.log(`   ⏭️  SKIP (already exists)  ${item.productName}`)
      skipped++
      continue
    }

    const resolved = resolveClientName(item.clientName)
    const match = clientMap[resolved]
    if (!match) console.log(`   ⚠️  No client found for "${item.clientName}" (tried "${resolved}")`)

    const code = genCode(existing)
    const docData = {
      ...item,
      code,
      clientId:   match?.id   || '',
      clientName: match?.name || item.clientName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await addDoc(collection(db, 'rdItems'), docData)
    console.log(`   #${code}  ${item.productName.padEnd(42)} [${match?.name || item.clientName}] ${match ? '✓' : '⚠️ unmatched'}  ${item.status}`)
    seeded++
  }

  console.log(`\n✅ Done — ${seeded} seeded, ${skipped} skipped (already existed).`)
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
