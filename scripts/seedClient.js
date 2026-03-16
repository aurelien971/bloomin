const { initializeApp } = require('firebase/app')
const { getFirestore, addDoc, collection } = require('firebase/firestore')

const firebaseConfig = {
  apiKey:            "AIzaSyDnDSEMXA2IPyJFbhCn5swo_GpZymHdPnI",
  authDomain:        "bloomin-2d4a2.firebaseapp.com",
  projectId:         "bloomin-2d4a2",
  storageBucket:     "bloomin-2d4a2.firebasestorage.app",
  messagingSenderId: "508429724292",
  appId:             "1:508429724292:web:48c8e888a863bac66f30d1",
}

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)

async function seed() {
  const ref = await addDoc(collection(db, 'clients'), {
    name:           'Joe and the Juice',
    logoUrl:        '',
    markets:        ['UK', 'US'],
    establishments: 350,
    notes:          'Large international juice chain',
    createdAt:      new Date().toISOString(),
  })
  console.log('Client created:', ref.id)
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })