'use client'

import { useState } from 'react'
import { User, Mail, MapPin, Info, CheckCircle } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

interface FormData {
  firstName: string; lastName: string; email: string; phone: string
  address: string; city: string; state: string; zip: string; dob: string
  gender: string; maritalStatus: string; hasChildren: string
}

const INITIAL: FormData = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '', dob: '',
  gender: '', maritalStatus: '', hasChildren: '',
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-800 transition-all"
const selectCls = `${inputCls} appearance-none cursor-pointer`

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary-900" />
      </div>
      <h2 className="font-serif text-base font-semibold text-gray-900">{title}</h2>
    </div>
  )
}

export function MembershipForm() {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

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
      setError('Something went wrong. Please try again or email us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-gray-900 mb-3">Form Received!</h2>
        <p className="text-gray-500 leading-relaxed max-w-sm mx-auto">
          Thank you for reaching out. Fr. Pachom will be in touch with you soon.<br />
          <span className="text-primary-900 font-medium">God bless you and your family.</span>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
      {/* Section 1 — Name */}
      <div className="p-7 border-b border-gray-50">
        <SectionHeader icon={User} title="Personal Information" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>First Name</Label>
            <input className={inputCls} value={form.firstName} onChange={set('firstName')} required placeholder="John" />
          </div>
          <div>
            <Label required>Last Name</Label>
            <input className={inputCls} value={form.lastName} onChange={set('lastName')} required placeholder="Doe" />
          </div>
        </div>
      </div>

      {/* Section 2 — Contact */}
      <div className="p-7 border-b border-gray-50">
        <SectionHeader icon={Mail} title="Contact" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required>Email</Label>
            <input type="email" className={inputCls} value={form.email} onChange={set('email')} required placeholder="john@example.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
          </div>
        </div>
      </div>

      {/* Section 3 — Address */}
      <div className="p-7 border-b border-gray-50">
        <SectionHeader icon={MapPin} title="Address" />
        <div className="space-y-4">
          <div>
            <Label>Street Address</Label>
            <input className={inputCls} value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label>City</Label>
              <input className={inputCls} value={form.city} onChange={set('city')} placeholder="Nashville" />
            </div>
            <div>
              <Label>State</Label>
              <select className={selectCls} value={form.state} onChange={set('state')}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Zip</Label>
              <input className={inputCls} value={form.zip} onChange={set('zip')} placeholder="37013" maxLength={10} />
            </div>
          </div>
        </div>
      </div>

      {/* Section 4 — Additional */}
      <div className="p-7">
        <SectionHeader icon={Info} title="Additional Information" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Date of Birth</Label>
            <input type="date" className={inputCls} value={form.dob} onChange={set('dob')} />
          </div>
          <div>
            <Label>Gender</Label>
            <select className={selectCls} value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </select>
          </div>
          <div>
            <Label>Marital Status</Label>
            <select className={selectCls} value={form.maritalStatus} onChange={set('maritalStatus')}>
              <option value="">Select…</option>
              <option>Single</option>
              <option>Married</option>
              <option>Divorced</option>
              <option>Widowed</option>
            </select>
          </div>
          <div>
            <Label>Do you have children?</Label>
            <select className={selectCls} value={form.hasChildren} onChange={set('hasChildren')}>
              <option value="">Select…</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-7 pb-7">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-primary-900 text-white font-semibold text-sm rounded-xl hover:bg-primary-800 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit Membership Form'}
        </button>
        <p className="text-xs text-center text-gray-400 mt-3">
          Your information is kept private and shared only with our priest.
        </p>
      </div>
    </form>
  )
}
