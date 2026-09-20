import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
class Rollback extends Error {}
async function main(){
  try {
    await prisma.$transaction(async (tx) => {
      await tx.schoolClass.create({ data: { id: 'zz-audit', name: 'zz', stage: 'ELEMENTARY' } })
      const acct = await tx.account.create({ data: { loginId: '9991', pinHash: 'x', role: 'STUDENT', displayName: 'ZZ', student: { create: { firstName: 'Z', lastName: 'Z', classId: 'zz-audit' } } }, include: { student: true } })
      await tx.attendanceRecord.create({ data: { studentId: acct.student!.id, classId: 'zz-audit', date: new Date('2026-09-13'), sessionKey: 'sunday', status: 'PRESENT', markedById: acct.id } })
      console.log('setup ok — now deleting the student account (mirrors endOfYearReset)')
      try {
        await tx.account.deleteMany({ where: { OR: [{ role: 'STUDENT' }, { student: { isNot: null } }] } })
        console.log('DELETE SUCCEEDED — hypothesis wrong')
      } catch (e: any) {
        console.log('DELETE FAILED:', e.code, String(e.message).split('\n').slice(0,6).join(' | '))
      }
      throw new Rollback()
    })
  } catch (e) { if (!(e instanceof Rollback)) throw e; console.log('rolled back') }
}
main().finally(()=>prisma.$disconnect())
