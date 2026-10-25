'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { findCheckInCode } from '@/lib/portal/actions/checkin'
import { buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export function TypedCode() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        startTransition(async () => {
          const r = await findCheckInCode(code)
          if (!r.ok) return setError(r.error)
          router.push(`/portal/checkin/${r.data!.token}`)
        })
      }}
    >
      <label htmlFor="checkin-code" className="sr-only">
        Check-in code
      </label>
      <input
        id="checkin-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className={cn(inputClass, 'text-center font-mono text-[20px] tracking-[3px]')}
        placeholder="A3F9-2C1B"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={12}
      />
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-[#B91C1C]">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || code.trim().length < 8} className={cn(buttonClass('primary'), 'mt-3 min-h-[46px] w-full text-[14px]')}>
        {pending ? 'Checking…' : 'Continue'}
      </button>
    </form>
  )
}
