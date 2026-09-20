import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const x = (s:string)=>prisma.$executeRawUnsafe(s)
const q = (s:string)=>prisma.$queryRawUnsafe<any[]>(s)
async function main(){
  await x(`DROP SCHEMA IF EXISTS audit_tmp CASCADE`)
  await x(`CREATE SCHEMA audit_tmp`)
  for (const t of ['SchoolClass','Student','PointEntry','AttendanceRecord','QuizResult','PortalAuditLog','Exam'])
    await x(`CREATE TABLE audit_tmp."${t}" (LIKE public."${t}" INCLUDING ALL)`)
  await x(`SET search_path TO audit_tmp`)
  // 12 classes
  await x(`INSERT INTO audit_tmp."SchoolClass"(id,name,stage,"sortOrder","visitationThreshold","isActive","createdAt","updatedAt")
    SELECT 'c'||i,'Class '||i,'ELEMENTARY',i,2,true,now(),now() FROM generate_series(1,12) i`)
  // 270 students
  await x(`INSERT INTO audit_tmp."Student"(id,"accountId","classId","firstName","lastName","parentEmails","createdAt","updatedAt")
    SELECT 's'||i,'a'||i,'c'||(1+(i%12)),'F'||i,'L'||i,'{}',now(),now() FROM generate_series(1,270) i`)
  // 3 years x 52 weeks x 6 sessions x 270 students would be 250k attendance; do it
  await x(`INSERT INTO audit_tmp."AttendanceRecord"(id,"studentId","classId",date,"sessionKey",status,"markedById","createdAt","updatedAt")
    SELECT md5(random()::text||i||w||sk), 's'||i, 'c'||(1+(i%12)), (date '2023-09-03' + (w*7)), sk, 'PRESENT', 'admin', now(), now()
    FROM generate_series(1,270) i, generate_series(0,155) w, unnest(ARRAY['sunday','bible','vespers','liturgy','tasbeha','hymns']) sk`)
  await x(`INSERT INTO audit_tmp."PointEntry"(id,"studentId","classId",points,source,"activityLabel","undone","createdAt")
    SELECT md5(random()::text||i||w||sk||'p'), 's'||i, 'c'||(1+(i%12)), 2, 'ATTENDANCE', sk, false, (timestamp '2023-09-03' + (w*7)*interval '1 day')
    FROM generate_series(1,270) i, generate_series(0,155) w, unnest(ARRAY['sunday','bible','vespers','liturgy','tasbeha','hymns']) sk`)
  await x(`ANALYZE audit_tmp."PointEntry"`); await x(`ANALYZE audit_tmp."AttendanceRecord"`); await x(`ANALYZE audit_tmp."Student"`); await x(`ANALYZE audit_tmp."SchoolClass"`)
  console.log('rows', await q(`select (select count(*) from audit_tmp."PointEntry") pe,(select count(*) from audit_tmp."AttendanceRecord") ar, pg_size_pretty(pg_total_relation_size('audit_tmp."PointEntry"')) pesize`))

  const plans: [string,string][] = [
    ['classTotals (leaderboard "all" / dashboard): groupBy studentId sum points where student.classId in (12 classes)',
     `SELECT "studentId", SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId" IN ('c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11','c12')) GROUP BY "studentId"`],
    ['classTotals for ONE class',
     `SELECT "studentId", SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId" = 'c1') GROUP BY "studentId"`],
    ['deleteExams: PointEntry where source=QUIZ and reason in (...)',
     `SELECT id FROM audit_tmp."PointEntry" WHERE source='QUIZ' AND reason IN ('exam:abc','exam:def')`],
    ['saveAttendance follow-up: all sunday history for 30 students (no date bound)',
     `SELECT "studentId",date,status FROM audit_tmp."AttendanceRecord" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId"='c1') AND "sessionKey"='sunday'`],
  ]
  for (const [name,sql] of plans) {
    const r = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON) ${sql}`)
    console.log('\n### '+name)
    console.log(r.map((l)=>l['QUERY PLAN']).join('\n'))
  }
  await x(`DROP SCHEMA audit_tmp CASCADE`)
  console.log('\ndropped audit_tmp')
}
main().catch(async e=>{console.error(e); await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS audit_tmp CASCADE`)}).finally(()=>prisma.$disconnect())
