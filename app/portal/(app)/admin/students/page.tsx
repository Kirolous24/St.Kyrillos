import { Users, Search, UserPlus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { PageHeader, EmptyState, Card, buttonClass, LinkButton } from '@/components/portal/ui'
import { STAGE_LABEL } from '@/lib/portal/format'
import { DebouncedSearch } from '@/components/portal/DebouncedSearch'
import { accentFor } from '@/lib/portal/accents'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { BulkSelection, BulkBar, GroupSelectAll, StudentCard, type BulkStudent } from './BulkTools'
import { StudentForm } from '@/components/portal/StudentForm'

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
      // F0563 — the prototype searched email too ("Search by name or email").
      // A servant handed a parent's address and asked "is this child with us?"
      // had no way to answer from this page.
      //
      // `parentEmails` is a scalar list, and Prisma's only list predicate is
      // `has`, which is an exact match — a partial query would match nothing
      // and read as "no such child". So that arm is added only when the query
      // IS a full address; otherwise it is left out rather than quietly
      // under-matching. Stored lowercased by toData(), hence the fold.
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' as const } },
              { lastName: { contains: q, mode: 'insensitive' as const } },
              { account: { loginId: { contains: q } } },
              { account: { email: { contains: q, mode: 'insensitive' as const } } },
              ...(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q) ? [{ parentEmails: { has: q.toLowerCase() } }] : []),
            ],
          }
        : {}),
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
      {/* F0073 — the roster query stops at 500 rows and the subtitle said only
          "500 shown", which an admin reads as the whole school. Past 500 children
          there would be students who exist in the database and on no page anyone
          can reach, with nothing on screen admitting it. The class picker and the
          search box are the way to the rest, so the line says so.
          F0811 — the prototype put Import, Export and Template in this page's own
          toolbar. The port moved them to Data & Backup and left nothing here
          pointing that way, so an admin standing on the student roster with a
          spreadsheet in hand had no sign the importer existed. One link, rather
          than a second copy of a destructive tool. */}
      <PageHeader
        title="All students"
        subtitle={[
          `${students.length} shown`,
          students.length >= 500 ? 'the first 500 only — pick a class or search to reach the rest' : null,
          flagged ? `${flagged} need review` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        icon={<Users className="h-5 w-5" />}
        actions={
          <LinkButton href="/portal/admin/data" variant="secondary">
            Import / export CSV
          </LinkButton>
        }
      />

      <Card bodyClassName="p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <ClassPicker value={classId} options={[...pickerOptions, { id: 'none', name: 'No class' }]} allowAll />
          <form className="flex flex-1 items-end gap-2">
            <input type="hidden" name="class" value={classId} />
            <label className="block w-full max-w-sm">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Search</span>
              {/* F0823 — refines as you type. The filtering stays on the server
                  on purpose: the roster query stops at 500 rows (F0073), so a
                  client-side filter would search the first 500 and tell an admin
                  the 501st student does not exist. */}
              <DebouncedSearch placeholder="Name, ID or email" aria-label="Search students" />
            </label>
            <button type="submit" className={buttonClass('secondary')}>
              <Search className="h-[13px] w-[13px]" /> Search
            </button>
          </form>
        </div>
      </Card>

      {/* F0062 / F0559 — the prototype's "Add Student to Any Class" form lived
          on this page with its own class dropdown. The port made an admin open
          a class first, so adding a child meant knowing which class before you
          started. Collapsed by default, in the card header rather than the
          body: a control inside a collapsed body cannot be found. */}
      <details className="group mt-3.5 overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden />
            <span className="text-[13px] font-semibold text-parch-900">Add a student to any class</span>
          </span>
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800 group-open:hidden">
            Open
          </span>
          <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 group-open:inline">
            Close
          </span>
        </summary>
        <div className="border-t border-[#F3F0EB] p-[18px]">
          <StudentForm mode="create" classes={pickerOptions} backHref="/portal/admin/students" />
        </div>
      </details>

      {students.length === 0 ? (
        <div className="mt-3.5">
          <EmptyState title="No students match" hint="Try a different class or search term." />
        </div>
      ) : (
        <BulkSelection>
        <div className="mt-3.5 space-y-3.5">
          {STAGE_ORDER.map((stage) => {
            const stageGroups = groups.filter((g) => g.stage === stage)
            if (stageGroups.length === 0) return null
            const totalStudents = stageGroups.reduce((n, g) => n + g.members.length, 0)
            return (
              // F0568 — an admin looking for one child in Preparatory scrolled
              // past every class in Primary and Kindergarten to reach it; the
              // class level collapsed but the stage wrapping it did not, so the
              // page could only ever get taller. Born open, so nothing that is
              // on screen today disappears behind a click — and so the bulk
              // selection controls inside stay findable.
              <details
                key={stage}
                open
                data-stage-group={stage}
                className="group overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-[18px] pb-3 pt-4 [&::-webkit-details-marker]:hidden">
                  <div>
                    <h2 className="font-serif text-[14.5px] font-bold text-brand-800">{STAGE_LABEL[stage]}</h2>
                    <p className="mt-0.5 text-[10.5px] font-semibold text-brand-gold-dark">
                      {stageGroups.length} class{stageGroups.length === 1 ? '' : 'es'} · {totalStudents} student{totalStudents === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span aria-hidden className="shrink-0 text-[13px] text-parch-500 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-[#F0EBE3] p-4 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                  {stageGroups.map((g) => (
                    <ClassGroup key={g.id} label={g.label} accent={accentFor(g.id)} members={g.members} moveOptions={moveOptions} />
                  ))}
                </div>
              </details>
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
          <BulkBar moveOptions={moveOptions} />
        </div>
        </BulkSelection>
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
  members: BulkStudent[]
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
        <span className="flex shrink-0 items-center gap-2">
          <GroupSelectAll ids={members.map((m) => m.id)} label={label} />
          <span aria-hidden className="text-[13px] text-parch-500">▾</span>
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#F0EBE3] p-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {members.map((s) => (
          <StudentCard key={s.id} student={s} moveOptions={moveOptions} />
        ))}
      </div>
    </details>
  )
}
