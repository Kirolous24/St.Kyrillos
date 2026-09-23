import Link from 'next/link'
import type { ClassSummary } from '@/lib/portal/data/classes'
import { PageHeader, Card, EmptyState } from './ui'
import { STAGE_LABEL } from '@/lib/portal/format'

/**
 * Shown by the Students / Attendance / Points entry routes when the signed-in
 * user has more than one class. A single-class user is redirected past this.
 */
export function ClassChoice({
  title, subtitle, classes, suffix, icon,
}: {
  title: string
  subtitle: string
  classes: ClassSummary[]
  /** Appended to /portal/classes/<id> — '', '/attendance' or '/points'. */
  suffix: string
  icon?: React.ReactNode
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      {classes.length === 0 ? (
        <EmptyState title="You are not assigned to a class yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-[#EFE9DC]">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/classes/${c.id}${suffix}`}
                  className="flex items-center justify-between gap-3 px-1 py-3 transition-colors hover:bg-brand-wash"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-parch-900">{c.name}</span>
                    <span className="block truncate text-[11.5px] text-parch-500">{STAGE_LABEL[c.stage]}</span>
                  </span>
                  <span aria-hidden className="text-parch-500">&rsaquo;</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
