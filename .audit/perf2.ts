import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const x = (s:string)=>prisma.$executeRawUnsafe(s)
const q = (s:string)=>prisma.$queryRawUnsafe<any[]>(s)
async function main(){
  await x(`DROP SCHEMA IF EXISTS audit_tmp CASCADE`)
  await x(`CREATE SCHEMA audit_tmp`)
  for (const t of ['SchoolClass','Student','PointEntry','AttendanceRecord'])
    await x(`CREATE TABLE audit_tmp."${t}" (LIKE public."${t}" INCLUDING ALL)`)
  await x(`INSERT INTO audit_tmp."SchoolClass"(id,name,stage,"sortOrder","visitationThreshold","isActive","createdAt","updatedAt") SELECT 'c'||i,'C'||i,'ELEMENTARY',i,2,true,now(),now() FROM generate_series(1,12) i`)
  await x(`INSERT INTO audit_tmp."Student"(id,"accountId","classId","firstName","lastName","parentEmails","createdAt","updatedAt") SELECT 's'||i,'a'||i,'c'||(1+(i%12)),'F'||i,'L'||i,'{}',now(),now() FROM generate_series(1,270) i`)
  await x(`INSERT INTO audit_tmp."AttendanceRecord"(id,"studentId","classId",date,"sessionKey",status,"markedById","createdAt","updatedAt") SELECT md5(random()::text||i||w||sk),'s'||i,'c'||(1+(i%12)),(date '2023-09-03'+(w*7)),sk,'PRESENT','admin',now(),now() FROM generate_series(1,270) i, generate_series(0,155) w, unnest(ARRAY['sunday','bible','vespers','liturgy','tasbeha','hymns']) sk`)
  await x(`INSERT INTO audit_tmp."PointEntry"(id,"studentId","classId",points,source,"activityLabel","undone","createdAt") SELECT md5(random()::text||i||w||sk||'p'),'s'||i,'c'||(1+(i%12)),2,'ATTENDANCE',sk,false,(timestamp '2023-09-03'+(w*7)*interval '1 day') FROM generate_series(1,270) i, generate_series(0,155) w, unnest(ARRAY['sunday','bible','vespers','liturgy','tasbeha','hymns']) sk`)
  for (const t of ['PointEntry','AttendanceRecord','Student','SchoolClass']) await x(`ANALYZE audit_tmp."${t}"`)
  const ids30 = (await q(`select id from audit_tmp."Student" where "classId"='c1'`)).map(r=>`'${r.id}'`).join(',')
  const allIds = (await q(`select id from audit_tmp."Student"`)).map(r=>`'${r.id}'`).join(',')

  async function t(name:string, sql:string){
    await q(`EXPLAIN (ANALYZE, COSTS OFF) ${sql}`) // warm
    const r = await q(`EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) ${sql}`)
    const txt = r.map(l=>l['QUERY PLAN']).join('\n')
    const scan = txt.split('\n').map(s=>s.trim()).filter(s=>/Seq Scan|Index Only Scan|Index Scan|Bitmap/.test(s))[0] ?? '?'
    const ms = txt.match(/Execution Time: ([\d.]+)/)?.[1]
    console.log(`${ms!.padStart(8)} ms  ${scan.slice(0,72).padEnd(74)} ${name}`)
  }
  console.log('--- as written today (Prisma relation filter) ---')
  await t('classTotals ALL classes  [dashboard+leaderboard]', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId" IN ('c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11','c12')) GROUP BY "studentId"`)
  await t('classTotals ONE class    [student dashboard]', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId"='c1') GROUP BY "studentId"`)
  await t('attendance sunday history for 1 class (explicit IN, as coded)', `SELECT "studentId",date,status FROM audit_tmp."AttendanceRecord" WHERE "studentId" IN (${ids30}) AND "sessionKey"='sunday'`)
  console.log('--- with an explicit studentId IN list instead of the relation filter ---')
  await t('classTotals ONE class (explicit IN)', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (${ids30}) GROUP BY "studentId"`)
  await t('classTotals ALL (explicit IN)', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (${allIds}) GROUP BY "studentId"`)
  console.log('--- after adding INDEX ("studentId", points) ---')
  await x(`CREATE INDEX pe_cover ON audit_tmp."PointEntry"("studentId", points)`); await x(`ANALYZE audit_tmp."PointEntry"`)
  await t('classTotals ONE class (explicit IN + covering idx)', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (${ids30}) GROUP BY "studentId"`)
  await t('classTotals ALL (explicit IN + covering idx)', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (${allIds}) GROUP BY "studentId"`)
  await t('classTotals ALL (relation filter + covering idx)', `SELECT "studentId",SUM(points) FROM audit_tmp."PointEntry" WHERE "studentId" IN (SELECT id FROM audit_tmp."Student" WHERE "classId" IN ('c1','c2','c3')) GROUP BY "studentId"`)
  await x(`DROP SCHEMA audit_tmp CASCADE`); console.log('dropped')
}
main().catch(async e=>{console.error(e); await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS audit_tmp CASCADE`)}).finally(()=>prisma.$disconnect())
