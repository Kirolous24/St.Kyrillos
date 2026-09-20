'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { createManualCase } from '@/lib/portal/actions/followups'
import { Card, Callout, Field, inputClass, selectClass, textareaClass, buttonClass } from '@/components/portal/ui'

export function NewCaseForm({ students }: { students: Array<{ id: string; label: string }> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')

  return (
    <Card title="Open a case" icon={<UserPlus className="h-4 w-4" />} className="lg:sticky lg:top-4 lg:self-start">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          startTransition(async () => {
            const r = await createManualCase({ studentId, title, details })
            if (!r.ok) return setError(r.error)
            router.push(`/portal/follow-ups/${r.data!.caseId}`)
            router.refresh()
          })
        }}
      >
        <Field label="Student" htmlFor="case-student">
          <select id="case-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectClass} required>
            <option value="">Choose…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="What is going on?" htmlFor="case-title">
          <input id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required maxLength={120} placeholder="e.g. Family going through a hard time" />
        </Field>
        <Field label="Details" htmlFor="case-details" hint="Optional — anything the next servant should know.">
          <textarea id="case-details" value={details} onChange={(e) => setDetails(e.target.value)} className={textareaClass} maxLength={1000} rows={3} />
        </Field>
        {error && (
          <div role="alert" className="mb-3.5">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
        <button type="submit" disabled={pending || !studentId} className={buttonClass('primary')}>
          {pending ? 'Opening…' : 'Open case'}
        </button>
      </form>
    </Card>
  )
}
