import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STUDENT_FORM_FIELDS, studentFormState } from '@/lib/portal/student-form'

/**
 * 2026-09-28 — the edit form left the child's own email and phone out of its
 * starting state. The boxes opened empty, and every save wiped both.
 */
const actions = readFileSync(path.resolve(__dirname, '../../lib/portal/actions/students.ts'), 'utf8')

describe('the student form', () => {
  it("opens with the child's own email and phone", () => {
    const state = studentFormState({ firstName: 'Mina', email: 'mina@example.com', phone: '(615) 555-0100' })
    expect(state.email).toBe('mina@example.com')
    expect(state.phone).toBe('(615) 555-0100')
    expect(state.lastName).toBe('')
  })

  it('starts every field the server saves, so none can be sent as missing', () => {
    const block = actions.slice(actions.indexOf('const StudentFormSchema = z.object({'), actions.indexOf('export type StudentFormInput'))
    const schemaKeys = Array.from(block.matchAll(/^\s{2}(\w+):/gm), (m) => m[1])
    expect(schemaKeys.length).toBeGreaterThan(10)
    expect([...STUDENT_FORM_FIELDS].sort()).toEqual([...schemaKeys].sort())
    expect(Object.keys(studentFormState()).sort()).toEqual([...schemaKeys].sort())
  })

  it('the form component starts from that state', () => {
    const form = readFileSync(path.resolve(__dirname, '../../components/portal/StudentForm.tsx'), 'utf8')
    expect(form).toMatch(/useState<StudentFormInput>\(\(\) => studentFormState\(initial\)\)/)
  })

  it('an update writes only the fields it was sent', () => {
    const body = actions.slice(actions.indexOf('export async function updateStudent('), actions.indexOf('export async function resetStudentPin('))
    expect(body).toMatch(/onlySent\(toData\(input\), raw\)/)
    expect(body).toMatch(/onlySent\(toAccountData\(input\), raw\)/)
  })
})
