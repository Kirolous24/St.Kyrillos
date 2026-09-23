'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { User, Users, KeyRound } from 'lucide-react'
import { createStudent, updateStudent, moveStudent, type StudentFormInput } from '@/lib/portal/actions/students'
import { Field, inputClass, selectClass, textareaClass, buttonClass, Card, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

interface Props {
  mode: 'create' | 'edit'
  classId?: string
  studentId?: string
  initial?: Partial<StudentFormInput>
  backHref: string
  /**
   * Admins only. The prototype showed a Class field as the second row of the
   * Edit Student form (es-class-fld, hidden for servants); the port pulled it
   * out onto a separate list page, so an admin fixing a child's details and
   * their class had to do it in two places.
   */
  classes?: Array<{ id: string; name: string }>
}

/** The prototype's .grid2 — two equal columns, collapsing to one on a phone. */
const GRID2 = 'grid grid-cols-1 gap-x-4 sm:grid-cols-2'

export function StudentForm({ mode, classId, studentId, initial, backHref, classes }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ loginId: string; pin: string; studentId: string } | null>(null)
  const [moveTo, setMoveTo] = useState(classId ?? '')
  const [form, setForm] = useState<StudentFormInput>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    gender: (initial?.gender as StudentFormInput['gender']) ?? '',
    dob: initial?.dob ?? '',
    grade: initial?.grade ?? '',
    address: initial?.address ?? '',
    fatherName: initial?.fatherName ?? '',
    fatherPhone: initial?.fatherPhone ?? '',
    motherName: initial?.motherName ?? '',
    motherPhone: initial?.motherPhone ?? '',
    parentEmails: initial?.parentEmails ?? '',
    notes: initial?.notes ?? '',
  })

  // In edit mode the field moves an existing student; in create mode it is
  // the class the new student is added to. The prototype's "Add Student to Any
  // Class" form (F0062/F0559) is exactly this field on a blank form, which is
  // why the two share one control rather than growing a second.
  const canPickClass = !!classes && classes.length > 0
  const canMove = mode === 'edit' && canPickClass

  const set = (k: keyof StudentFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      if (mode === 'create') {
        const target = canPickClass ? moveTo : classId
        if (!target) return setError('Choose a class for this student.')
        const result = await createStudent(target, form)
        if (!result.ok) return setError(result.error)
        setCreated(result.data!)
      } else {
        const result = await updateStudent(studentId!, form)
        if (!result.ok) return setError(result.error)
        // The class change rides along with the rest of the edit, so one save
        // does what the prototype's one save did.
        if (canMove && moveTo !== (classId ?? '')) {
          const moved = await moveStudent(studentId!, moveTo || null)
          if (!moved.ok) return setError(moved.error)
        }
        router.push(backHref)
        router.refresh()
      }
    })
  }

  if (created) {
    return (
      <Card title="Student added" icon={<KeyRound className="h-[15px] w-[15px]" />}>
        <p className="text-[12.5px] text-parch-700">Write these down for the family. The PIN is shown only once.</p>
        <dl className="mt-3.5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">ID</dt>
            <dd className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{created.loginId}</dd>
          </div>
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">PIN</dt>
            <dd className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{created.pin}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={cn(buttonClass('primary'), 'min-h-[40px]')} onClick={() => { router.push(`/portal/students/${created.studentId}`); router.refresh() }}>Open profile</button>
          <button type="button" className={cn(buttonClass('secondary'), 'min-h-[40px]')} onClick={() => { router.push(backHref); router.refresh() }}>Back to class</button>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Card title="Student" icon={<User className="h-[15px] w-[15px]" />}>
        <div className={GRID2}>
          <Field label="First name" htmlFor="firstName"><input id="firstName" value={form.firstName} onChange={set('firstName')} className={inputClass} required maxLength={60} /></Field>
          <Field label="Last name" htmlFor="lastName"><input id="lastName" value={form.lastName} onChange={set('lastName')} className={inputClass} maxLength={60} /></Field>
          {(canMove || (mode === 'create' && canPickClass)) && (
            <div className="sm:col-span-2">
              <Field
                label="Class"
                htmlFor="student-class"
                hint={mode === 'create' ? 'Which class this student joins.' : 'Changing this moves the student when you save.'}
              >
                <select id="student-class" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={selectClass}>
                  {/* A new student with no class would not appear on any
                      roster, so creating one is a choice, not a default. */}
                  <option value="">{mode === 'create' ? 'Choose a class…' : 'No class'}</option>
                  {classes!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          )}
          <Field label="Birthday" htmlFor="dob"><input id="dob" type="date" value={form.dob} onChange={set('dob')} className={inputClass} /></Field>
          <Field label="Gender" htmlFor="gender">
            <select id="gender" value={form.gender ?? ''} onChange={set('gender')} className={selectClass}>
              <option value="">—</option><option value="male">Boy</option><option value="female">Girl</option>
            </select>
          </Field>
          <Field label="Grade" htmlFor="grade"><input id="grade" value={form.grade ?? ''} onChange={set('grade')} className={inputClass} maxLength={20} placeholder="e.g. 3rd" /></Field>
          <Field label="Address" htmlFor="address"><input id="address" value={form.address ?? ''} onChange={set('address')} className={inputClass} maxLength={200} /></Field>
          {/* The child's own contact details. The port only ever captured the
              parents', so an older student with their own phone had nowhere for it. */}
          <Field label="Student's email" htmlFor="email" hint="Optional — theirs, not a parent's."><input id="email" type="email" value={form.email ?? ''} onChange={set('email')} className={inputClass} maxLength={200} /></Field>
          <Field label="Student's phone" htmlFor="phone" hint="Optional."><input id="phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} className={inputClass} maxLength={30} /></Field>
        </div>
        {mode === 'create' && (
          <Callout tone="warn">
            The student&rsquo;s <strong>login ID and PIN</strong> are generated automatically when you save — you&rsquo;ll see them right after, so you can share them.
          </Callout>
        )}
      </Card>

      <Card title="Parents" icon={<Users className="h-[15px] w-[15px]" />}>
        <div className={GRID2}>
          <Field label="Father's name" htmlFor="fatherName"><input id="fatherName" value={form.fatherName ?? ''} onChange={set('fatherName')} className={inputClass} maxLength={80} /></Field>
          <Field label="Father's phone" htmlFor="fatherPhone"><input id="fatherPhone" type="tel" value={form.fatherPhone ?? ''} onChange={set('fatherPhone')} className={inputClass} maxLength={30} /></Field>
          <Field label="Mother's name" htmlFor="motherName"><input id="motherName" value={form.motherName ?? ''} onChange={set('motherName')} className={inputClass} maxLength={80} /></Field>
          <Field label="Mother's phone" htmlFor="motherPhone"><input id="motherPhone" type="tel" value={form.motherPhone ?? ''} onChange={set('motherPhone')} className={inputClass} maxLength={30} /></Field>
          <div className="sm:col-span-2">
            <Field label="Parent emails" htmlFor="parentEmails" hint="Separate several with commas."><input id="parentEmails" value={form.parentEmails ?? ''} onChange={set('parentEmails')} className={inputClass} maxLength={300} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="notes"><textarea id="notes" value={form.notes ?? ''} onChange={set('notes')} className={textareaClass} maxLength={1000} placeholder="e.g. attends another church, allergy info…" /></Field>
          </div>
        </div>
      </Card>

      {error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px]')}>{pending ? 'Saving…' : mode === 'create' ? 'Add student' : 'Save changes'}</button>
        <button type="button" className={cn(buttonClass('secondary'), 'min-h-[40px]')} onClick={() => router.push(backHref)}>Cancel</button>
      </div>
    </form>
  )
}
