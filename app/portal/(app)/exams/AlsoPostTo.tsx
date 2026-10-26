'use client'

import { checkboxClass } from '@/components/portal/ui'

export type PostTarget = { id: string; name: string; postOnly: boolean }

/**
 * Post one exam to several classes at once (2026-10-26), on New exam and on
 * Import. Each class ticked gets its own copy with its own results. A class
 * the servant may only post to (the other half of their 5th & 6th or 7th & 8th
 * pair) says whose the results are, since the poster will not see them.
 */
export function AlsoPostTo({
  classes,
  primaryId,
  value,
  onChange,
}: {
  classes: PostTarget[]
  /** The class the exam is written in, which is never listed here. */
  primaryId: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const others = classes.filter((c) => c.id !== primaryId)
  if (others.length === 0) return null
  const chosen = value.filter((id) => others.some((c) => c.id === id))

  return (
    <fieldset className="mt-1 border-t border-parch-200 pt-3" data-testid="exam-also">
      <legend className="float-left mb-1 w-full text-[12px] font-bold text-parch-700">Also post to</legend>
      <p className="clear-left mb-2 text-[11px] text-parch-500">
        Each class you tick gets its own copy, with its own results.
        {others.length > 3 && (
          <>
            {' '}
            <button type="button" onClick={() => onChange(others.map((c) => c.id))} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
              Tick all
            </button>
            {chosen.length > 0 && (
              <>
                {' · '}
                <button type="button" onClick={() => onChange([])} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
                  Clear
                </button>
              </>
            )}
          </>
        )}
      </p>
      <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {others.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-[40px] items-center gap-2 text-[12.5px] font-semibold text-parch-800">
              <input
                type="checkbox"
                checked={chosen.includes(c.id)}
                onChange={(e) => onChange(e.target.checked ? [...chosen, c.id] : chosen.filter((id) => id !== c.id))}
                className={checkboxClass}
                data-also-class={c.id}
              />
              <span>
                {c.name}
                {c.postOnly && <span className="font-normal text-parch-500"> · its own servants see the results</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
