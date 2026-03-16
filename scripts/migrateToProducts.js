const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, addDoc, query, orderBy } = require('firebase/firestore')

const firebaseConfig = {
  apiKey:            "AIzaSyDnDSEMXA2IPyJFbhCn5swo_GpZymHdPnI",
  authDomain:        "bloomin-2d4a2.firebaseapp.com",
  projectId:         "bloomin-2d4a2",
  storageBucket:     "bloomin-2d4a2.firebasestorage.app",
  messagingSenderId: "508429724292",
  appId:             "1:508429724292:web:48c8e888a863bac66f30d1",
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

async function migrate() {
  const snap = await getDocs(query(collection(db, 'briefs'), orderBy('createdAt', 'desc')))
  const briefs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  console.log(`Found ${briefs.length} briefs to migrate...`)

  for (const brief of briefs) {
    const product = {
      clientId:    brief.clientId    || '',
      clientName:  brief.clientName  || '',
      productName: brief.productName || '',
      briefId:     brief.id,
      createdAt:   brief.createdAt   || new Date().toISOString(),
      stages: {
        brief:      { status: brief.submitted ? 'complete' : 'in-progress' },
        lab:        { status: 'not-started', latestVersion: null, signedOffVersion: null },
        handover:   { status: 'not-started' },
        validation: { status: 'not-started' },
        release:    { status: 'not-started' },
      },
    }
    const ref = await addDoc(collection(db, 'products'), product)
    console.log(`  Migrated "${brief.productName}" (${brief.clientName}) → product id: ${ref.id}`)
  }

  console.log('Migration complete.')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
