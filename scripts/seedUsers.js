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

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

const USERS = [
  { name: 'Tom',      role: 'Operations Director', password: 'Bloomin123' },
  { name: 'Jesse',    role: 'CEO',                 password: 'Bloomin123' },
  { name: 'Aurelien', role: 'Product Director',    password: 'Bloomin123' },
  { name: 'Ruth',     role: 'Sales',               password: 'Bloomin123' },
  { name: 'Fiona',    role: 'Account Manager',     password: 'Bloomin123' },
  { name: 'Dima',     role: 'Cook',                password: 'Bloomin123' },
  { name: 'Asif',     role: 'Supply Chain',        password: 'Bloomin123' },
]

async function seed() {
  for (const user of USERS) {
    const ref = await addDoc(collection(db, 'users'), {
      ...user,
      createdAt: new Date().toISOString(),
    })
    console.log(`Created ${user.name} (${user.role}) — id: ${ref.id}`)
  }
  console.log('All users created.')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })