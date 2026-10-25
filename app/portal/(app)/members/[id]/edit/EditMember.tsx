'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMember } from '@/lib/portal/actions/fellowship'
import { Card, Callout } from '@/components/portal/ui'
import { MemberForm, type MemberFields } from '@/components/portal/MemberForm'

export function EditMember({ studentId, initial }: { studentId: string; initial: MemberFields }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <Card>
      {error && (
        <div role="alert" className="mb-3">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
      <MemberForm
        initial={initial}
        submitLabel="Save changes"
        pending={pending}
        idPrefix="edit-member"
        onSubmit={(fields) =>
          startTransition(async () => {
            setError('')
            const r = await updateMember(studentId, fields)
            if (!r.ok) return setError(r.error)
            router.push(`/portal/members/${studentId}`)
            router.refresh()
          })
        }
      />
    </Card>
  )
}
