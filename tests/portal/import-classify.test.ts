import { describe, it, expect } from 'vitest'
import {
  classifyStudentImportRow,
  classifyServantImportRow,
  type ExistingImportAccount,
} from '@/lib/portal/import-classify'

const student: ExistingImportAccount = { id: 'acc-student', role: 'STUDENT', linkedId: 'stu-1' }
const servant: ExistingImportAccount = { id: 'acc-servant', role: 'SERVANT', linkedId: null }
const admin: ExistingImportAccount = { id: 'acc-admin', role: 'ADMIN', linkedId: null }

describe('classifyStudentImportRow', () => {
  it('creates for a blank login ID', () => {
    expect(classifyStudentImportRow('', new Map())).toEqual({ kind: 'create' })
  })

  it('creates for a login ID not yet in use', () => {
    const map = new Map([['1234', student]])
    expect(classifyStudentImportRow('9999', map)).toEqual({ kind: 'create' })
  })

  it('updates a matching student account', () => {
    const map = new Map([['1234', student]])
    expect(classifyStudentImportRow('1234', map)).toEqual({ kind: 'update', account: student })
  })

  it('errors when the ID belongs to a servant account', () => {
    const map = new Map([['5678', servant]])
    expect(classifyStudentImportRow('5678', map)).toEqual({
      kind: 'error',
      message: 'ID 5678 belongs to a servant account',
    })
  })

  it('errors when the account has no linked student row', () => {
    const orphanAccount: ExistingImportAccount = { id: 'acc-orphan', role: 'STUDENT', linkedId: null }
    const map = new Map([['1111', orphanAccount]])
    expect(classifyStudentImportRow('1111', map).kind).toBe('error')
  })
})

describe('classifyServantImportRow', () => {
  it('creates for a blank login ID', () => {
    expect(classifyServantImportRow('', new Map(), 'acc-self', 'SERVANT')).toEqual({ kind: 'create' })
  })

  it('creates for a login ID not yet in use', () => {
    const map = new Map([['1234', servant]])
    expect(classifyServantImportRow('9999', map, 'acc-self', 'SERVANT')).toEqual({ kind: 'create' })
  })

  it('updates a matching servant or admin account', () => {
    const map = new Map([['4321', servant]])
    expect(classifyServantImportRow('4321', map, 'acc-self', 'SERVANT')).toEqual({ kind: 'update', account: servant })
  })

  it('errors when the ID belongs to a student account', () => {
    const map = new Map([['1234', student]])
    expect(classifyServantImportRow('1234', map, 'acc-self', 'SERVANT')).toEqual({
      kind: 'error',
      message: 'ID 1234 belongs to a student',
    })
  })

  it('errors when a row would demote the importing admin away from ADMIN', () => {
    const map = new Map([['9000', admin]])
    expect(classifyServantImportRow('9000', map, 'acc-admin', 'SERVANT')).toEqual({
      kind: 'error',
      message: 'This row would remove your own admin access',
    })
  })

  it('allows the importing admin to keep ADMIN on their own row', () => {
    const map = new Map([['9000', admin]])
    expect(classifyServantImportRow('9000', map, 'acc-admin', 'ADMIN')).toEqual({ kind: 'update', account: admin })
  })

  it('does not apply the self-demotion guard to a different account', () => {
    const map = new Map([['9000', admin]])
    expect(classifyServantImportRow('9000', map, 'acc-someone-else', 'SERVANT')).toEqual({
      kind: 'update',
      account: admin,
    })
  })
})
