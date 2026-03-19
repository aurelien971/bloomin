import { useState } from 'react'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Step1Overview    from './steps/Step1Overview'
import Step2Flavour     from './steps/Step2Flavour'
import Step3Appearance  from './steps/Step3Appearance'
import Step4Usage       from './steps/Step4Usage'
import Step5Ingredients from './steps/Step5Ingredients'
import Step6Practical   from './steps/Step6Practical'
import Step7Commercial  from './steps/Step7Commercial'

const STEPS = [
  { label: 'Overview',    emoji: '📋', component: Step1Overview    },
  { label: 'Flavour',     emoji: '🍒', component: Step2Flavour     },
  { label: 'Appearance',  emoji: '🎨', component: Step3Appearance  },
  { label: 'Usage',       emoji: '☕', component: Step4Usage       },
  { label: 'Ingredients', emoji: '🌿', component: Step5Ingredients },
  { label: 'Packaging',   emoji: '📦', component: Step6Practical   },
  { label: 'Commercial',  emoji: '💼', component: Step7Commercial  },
]

export default function BriefForm({ brief }) {
  const [step,      setStep]      = useState(0)
  const [formData,  setFormData]  = useState(brief.formData || {})
  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(brief.submitted || false)

  const StepComponent = STEPS[step].component
  const isLast = step === STEPS.length - 1

  const save = async (data) => {
    try { await updateDoc(doc(db, 'briefs', brief.id), { formData: data }) }
    catch (e) { console.error('Auto-save failed', e) }
  }

  const handleChange = (data) => { setFormData(data); save(data) }
  const next = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setStep(s => s + 1) }
  const back = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setStep(s => s - 1) }

  const handleSubmit = async () => {
    setSaving(true)
    const submittedAt = new Date().toISOString()
    const submittedBy = formData.contactName || ''
    try {
      await updateDoc(doc(db, 'briefs', brief.id), {
        formData,
        submitted:   true,
        submittedAt,
        submittedBy,
      })

      if (brief.productId) {
        await updateDoc(doc(db, 'products', brief.productId), {
          'stages.brief.status':      'complete',
          'stages.brief.completedAt': submittedAt,
          'stages.brief.completedBy': submittedBy,
          'stages.scoping.status':    'in-progress',
        })
      } else {
        const snap = await getDocs(query(collection(db, 'products'), where('briefId', '==', brief.id)))
        if (!snap.empty) {
          await updateDoc(doc(db, 'products', snap.docs[0].id), {
            'stages.brief.status':      'complete',
            'stages.brief.completedAt': submittedAt,
            'stages.brief.completedBy': submittedBy,
            'stages.scoping.status':    'in-progress',
          })
        }
      }

      setSubmitted(true)
    } catch (e) { alert('Something went wrong. Please try again.'); console.error(e) }
    setSaving(false)
  }

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
        {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-12 mx-auto object-contain" />}
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Brief received!</h1>
        <p className="text-gray-500">Thanks for filling this in. Our team will review everything and be in touch soon.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {brief.clientLogoUrl && <img src={brief.clientLogoUrl} alt="" className="h-8 object-contain" onError={e => e.target.style.display='none'} />}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Product Brief</p>
                <p className="text-sm font-bold text-gray-800">{brief.productName}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{step + 1} / {STEPS.length}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="flex mt-2 gap-1">
            {STEPS.map((s, i) => (
              <span key={s.label} className={`text-xs flex-1 text-center truncate transition-colors ${i === step ? 'text-green-600 font-semibold' : i < step ? 'text-gray-400' : 'text-gray-200'}`}>
                {i < step ? '✓' : s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="text-3xl">{STEPS[step].emoji}</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Step {step + 1} of {STEPS.length}</p>
              <h2 className="text-xl font-bold text-gray-900">{STEPS[step].label}</h2>
            </div>
          </div>

          <StepComponent data={formData} onChange={handleChange} brief={brief} />

          <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
            {step > 0
              ? <button onClick={back} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">← Back</button>
              : <div />
            }
            {isLast ? (
              <button onClick={handleSubmit} disabled={saving} className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-md disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit brief ✓'}
              </button>
            ) : (
              <button onClick={next} className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition shadow-md">Next →</button>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Your answers save automatically as you go.</p>
      </div>
    </div>
  )
}
