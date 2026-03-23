'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dob: string
  gender: string
  maritalStatus: string
  hasChildren: string
}

const INITIAL: FormData = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '', dob: '',
  gender: '', maritalStatus: '', hasChildren: '',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-900/30 focus:border-primary-900 transition-colors"
const selectClass = `${inputClass} bg-white`

export function MembershipForm() {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again or contact us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-gray-900 mb-3">Form Submitted!</h2>
        <p className="text-gray-600 leading-relaxed">
          Thank you for reaching out. Fr. Pachom will contact you soon.
          <br />
          God bless you and your family.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-8 md:p-10 space-y-8">
      {/* Name */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-gray-900 mb-5 pb-2 border-b border-gray-100">Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" required>
            <input className={inputClass} value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
          </Field>
          <Field label="Last Name" required>
            <input className={inputClass} value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
          </Field>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100">Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email" required>
            <input type="email" className={inputClass} value={form.email} onChange={e => update('email', e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input type="tel" className={inputClass} value={form.phone} onChange={e => update('phone', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100">Address</h2>
        <Field label="Street Address">
          <input className={inputClass} value={form.address} onChange={e => update('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2">
            <Field label="City">
              <input className={inputClass} value={form.city} onChange={e => update('city', e.target.value)} />
            </Field>
          </div>
          <Field label="State">
            <select className={selectClass} value={form.state} onChange={e => update('state', e.target.value)}>
              <option value="">—</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Zip">
            <input className={inputClass} value={form.zip} onChange={e => update('zip', e.target.value)} maxLength={10} />
          </Field>
        </div>
      </div>

      {/* More Info */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100">Additional Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date of Birth">
            <input type="date" className={inputClass} value={form.dob} onChange={e => update('dob', e.target.value)} />
          </Field>
          <Field label="Gender">
            <select className={selectClass} value={form.gender} onChange={e => update('gender', e.target.value)}>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </select>
          </Field>
          <Field label="Marital Status">
            <select className={selectClass} value={form.maritalStatus} onChange={e => update('maritalStatus', e.target.value)}>
              <option value="">Select…</option>
              <option>Single</option>
              <option>Married</option>
              <option>Divorced</option>
              <option>Widowed</option>
            </select>
          </Field>
          <Field label="Do you have children?">
            <select className={selectClass} value={form.hasChildren} onChange={e => update('hasChildren', e.target.value)}>
              <option value="">Select…</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </Field>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 bg-primary-900 text-white font-semibold rounded-xl hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting…' : 'Submit Membership Form'}
      </button>
    </form>
  )
}
