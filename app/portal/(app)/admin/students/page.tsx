import Link from 'next/link'
import { Users, Search, Pencil } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { studentName } from '@/lib/portal/data/students'
import { notFound } from 'next/navigation'
import { PageHeader, EmptyState, Badge, Card, Avatar, inputClass, buttonClass } from '@/components/portal/ui'
import { STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { MoveStudentSelect } from './MoveStudentSelect'

export const metadata = { title: 'All students' }

const STAGE_ORDER = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'] as const

export default async function AdminStudentsPage({ searchParams }: { searchParams: { class?: string; q?: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()

  const classes = await prisma.schoolClass.findMany({ orderBy: [{ sortOrder: 'asc' }], select: { id: true, name: true, stage: true } })
  const classId = searchParams.class && (searchParams.class === 'none' || classes.some((c) => c.id === searchParams.class)) ? searchParams.class : 'all'
  const q = (searchParams.q ?? '').trim()

  const students = await prisma.student.findMany({
    where: {
      ...(classId === 'all' ? {} : classId === 'none' ? { classId: null } : { classId }),
      ...(q ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { account: { loginId: { contains: q } } }] } : {}),
    },
    orderBy: [{ class: { sortOrder: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
    take: 500,
    select: { id: true, firstName: true, lastName: true, grade: true, classId: true, importNotes: true, class: { select: { name: true } }, account: { select: { loginId: true, photo: true, lastLoginAt: true } } },
  })
  const flagged = students.filter((s) => s.importNotes).length

  type Row = (typeof students)[number]
  const byClass = new Map<string, Row[]>()
  for (const s of students) {
    const key = s.classId ?? 'none'
    const list = byClass.get(key)
    if (list) list.push(s)
    else byClass.set(key, [s])
  }

  const groups = classes
    .map((c) => ({ id: c.id, label: c.name, stage: c.stage as string, members: byClass.get(c.id) ?? [] }))
    .filter((g) => g.members.length > 0)
  const unassigned = byClass.get('none') ?? []

  // Simple picker options keep their original shape.
  const pickerOptions = classes.map((c) => ({ id: c.id, name: c.name }))
  const moveOptions = pickerOptions

  return (
    <>
      <PageHeader
        title="All students"
        subtitle={`${students.length} shown${flagged ? ` · ${flagged} need review` : ''}`}
        icon={<Users className="h-5 w-5" />}
      />

      <Card bodyClassName="p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <ClassPicker value={classId} options={[...pickerOptions, { id: 'none', name: 'No class' }]} allowAll />
          <form className="flex flex-1 items-end gap-2">
            <input type="hidden" name="class" value={classId} />
            <label className="block w-full max-w-sm">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Search</span>
              <input name="q" defaultValue={q} className={inputClass} placeholder="Name or ID" />
            </label>
            <button type="submit" className={buttonClass('secondary')}>
              <Search className="h-[13px] w-[13px]" /> Search
            </button>
          </form>
        </div>
      </Card>

      {students.length === 0 ? (
        <div className="mt-3.5">
          <EmptyState title="No students match" hint="Try a different class or search term." />
        </div>
      ) : (
        <div className="mt-3.5 space-y-3.5">
          {STAGE_ORDER.map((stage) => {
            const stageGroups = groups.filter((g) => g.stage === stage)
            if (stageGroups.length === 0) return null
            const totalStudents = stageGroups.reduce((n, g) => n + g.members.length, 0)
            return (
              <section key={stage} className="overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel">
                <header className="px-[18px] pb-3 pt-4">
                  <h2 className="font-serif text-[14.5px] font-bold text-brand-800">{STAGE_LABEL[stage]}</h2>
                  <p className="mt-0.5 text-[10.5px] font-semibold text-brand-gold-dark">
                    {stageGroups.length} class{stageGroups.length === 1 ? '' : 'es'} · {totalStudents} student{totalStudents === 1 ? '' : 's'}
                  </p>
                </header>
                <div className="grid gap-3 border-t border-[#F0EBE3] p-4 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                  {stageGroups.map((g) => (
                    <ClassGroup key={g.id} label={g.label} accent={accentFor(g.id)} members={g.members} moveOptions={moveOptions} />
                  ))}
                </div>
              </section>
            )
          })}

          {unassigned.length > 0 && (
            <section className="overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel">
              <header className="px-[18px] pb-3 pt-4">
                <h2 className="font-serif text-[14.5px] font-bold text-brand-800">Unassigned students</h2>
                <p className="mt-0.5 text-[10.5px] font-semibold text-brand-gold-dark">{unassigned.length} student{unassigned.length === 1 ? '' : 's'}</p>
              </header>
              <div className="border-t border-[#F0EBE3] p-4">
                <ClassGroup label="No class assigned" accent="#7C7A7A" members={unassigned} moveOptions={moveOptions} defaultOpen />
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function ClassGroup({
  label,
  accent,
  members,
  moveOptions,
  defaultOpen,
}: {
  label: string
  accent: string
  members: Array<{
    id: string
    firstName: string
    lastName: string
    grade: string | null
    classId: string | null
    importNotes: string | null
    account: { loginId: string; photo: string | null; lastLoginAt: Date | null }
  }>
  moveOptions: Array<{ id: string; name: string }>
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="overflow-hidden rounded-[10px] border border-[#EFE9DC] bg-[#FDFBF7]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
          <span>
            <span className="block text-[13px] font-bold text-parch-900">{label}</span>
            <span className="mt-0.5 block text-[10.5px] font-semibold text-brand-800">
              {members.length} student{members.length === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[13px] text-parch-500">▾</span>
      </summary>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#F0EBE3] p-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {members.map((s) => (
          <div key={s.id} className="rounded-[12px] border border-[#EFE9DC] bg-parch-50 px-3.5 pb-3 pt-4 text-center">
            <Link href={`/portal/students/${s.id}`} className="block">
              <span className="mx-auto mb-2.5 block w-fit">
                <Avatar name={studentName(s)} photo={s.account.photo} size="lg" />
              </span>
              <span className="block truncate text-[13px] font-bold text-parch-900">{studentName(s)}</span>
              <span className="mb-1 block truncate text-[11px] text-parch-500">
                ID {s.account.loginId}{s.grade ? ` · ${s.grade}` : ''}
              </span>
            </Link>
            {s.importNotes && <span className="mb-2 block"><Badge tone="warn">Review</Badge></span>}
            <div className="flex items-center justify-center gap-1.5 border-t border-[#F5F2ED] pt-2.5">
              <MoveStudentSelect studentId={s.id} value={s.classId ?? ''} options={moveOptions} />
              <Link
                href={`/portal/students/${s.id}/edit`}
                aria-label={`Edit ${studentName(s)}`}
                className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[7px] border border-parch-200 text-parch-700 transition-colors hover:border-brand-gold hover:text-brand-800"
              >
                <Pencil className="h-[13px] w-[13px]" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}
