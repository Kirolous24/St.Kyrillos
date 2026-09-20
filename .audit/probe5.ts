import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
class RB extends Error {}
async function scenario(name: string, fn: (tx:any)=>Promise<void>) {
  try { await prisma.$transaction(async (tx)=>{ await fn(tx); throw new RB() }, {timeout:60000}) }
  catch(e){ if(!(e instanceof RB)) console.log(name,'THREW', (e as any).code, String((e as any).message).split('\n')[0]) }
}
async function main(){
  await scenario('A', async (tx)=>{
    await tx.schoolClass.createMany({data:[{id:'zz-old',name:'Old',stage:'ELEMENTARY'},{id:'zz-new',name:'New',stage:'ELEMENTARY'}]})
    const srv = await tx.account.create({data:{loginId:'9992',pinHash:'x',role:'SERVANT',displayName:'Srv',servant:{create:{}}},include:{servant:true}})
    const stu = await tx.account.create({data:{loginId:'9993',pinHash:'x',role:'STUDENT',displayName:'Stu',student:{create:{firstName:'S',lastName:'T',classId:'zz-old'}}},include:{student:true}})
    const rec = await tx.attendanceRecord.create({data:{studentId:stu.student!.id,classId:'zz-old',date:new Date('2026-09-13'),sessionKey:'sunday',status:'PRESENT',markedById:srv.id}})
    await tx.pointEntry.create({data:{studentId:stu.student!.id,classId:'zz-old',points:2,source:'ATTENDANCE',activityLabel:'Sunday School',attendanceRecordId:rec.id}})
    await tx.exam.create({data:{id:'zz-exam',classId:'zz-old',title:'T'}})
    console.log('--- scenario A: delete a servant who has taken attendance (admin.deleteServant)')
    try { await tx.account.delete({where:{id:srv.id}}); console.log('  deleted OK') }
    catch(e:any){ console.log('  FAILED', e.code, (String(e.meta?.field_name||e.message)).split('\n')[0]) }
  })
  await scenario('B', async (tx)=>{
    await tx.schoolClass.createMany({data:[{id:'zz-old',name:'Old',stage:'ELEMENTARY'},{id:'zz-new',name:'New',stage:'ELEMENTARY'}]})
    const srv = await tx.account.create({data:{loginId:'9992',pinHash:'x',role:'SERVANT',displayName:'Srv',servant:{create:{}}},include:{servant:true}})
    const stu = await tx.account.create({data:{loginId:'9993',pinHash:'x',role:'STUDENT',displayName:'Stu',student:{create:{firstName:'S',lastName:'T',classId:'zz-old'}}},include:{student:true}})
    const rec = await tx.attendanceRecord.create({data:{studentId:stu.student!.id,classId:'zz-old',date:new Date('2026-09-13'),sessionKey:'sunday',status:'PRESENT',markedById:srv.id}})
    await tx.pointEntry.create({data:{studentId:stu.student!.id,classId:'zz-old',points:2,source:'ATTENDANCE',activityLabel:'Sunday School',attendanceRecordId:rec.id}})
    await tx.pointEntry.create({data:{studentId:stu.student!.id,classId:'zz-old',points:5,source:'MANUAL',activityLabel:'Manual'}})
    await tx.exam.create({data:{id:'zz-exam',classId:'zz-old',title:'T'}})
    await tx.quizResult.create({data:{examId:'zz-exam',studentId:stu.student!.id,classId:'zz-old',score:1,total:2,correctCount:1,questionCount:2,percentage:50}})
    console.log('--- scenario B: move student to a new class, then admin.deleteClass("zz-old")')
    await tx.student.update({where:{id:stu.student!.id},data:{classId:'zz-new'}})
    const c = await tx.schoolClass.findUnique({where:{id:'zz-old'},select:{_count:{select:{students:true}}}})
    console.log('  students still in old class:', c!._count.students, '(deleteClass guard passes)')
    await tx.schoolClass.delete({where:{id:'zz-old'}})
    console.log('  after delete -> attendance rows:', await tx.attendanceRecord.count(),
      '| point entries:', await tx.pointEntry.count(),
      '| exams:', await tx.exam.count(),
      '| quizResults:', await tx.quizResult.count())
  })
}
main().finally(()=>prisma.$disconnect())
