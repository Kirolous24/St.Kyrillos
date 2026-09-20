import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main(){
  console.log(await prisma.$queryRawUnsafe(`
    select 'account' t, count(*)::int n from "Account"
    union all select 'student', count(*)::int from "Student"
    union all select 'servant', count(*)::int from "Servant"
    union all select 'class', count(*)::int from "SchoolClass"
    union all select 'pointEntry', count(*)::int from "PointEntry"
    union all select 'attendance', count(*)::int from "AttendanceRecord"
    union all select 'quizResult', count(*)::int from "QuizResult"
    union all select 'audit', count(*)::int from "PortalAuditLog"
    union all select 'exam', count(*)::int from "Exam"
    union all select 'agendaWeek', count(*)::int from "AgendaWeek"
    union all select 'feedPost', count(*)::int from "FeedPost"
    union all select 'followUp', count(*)::int from "FollowUpCase"
  `))
  console.log('selfmarked', await prisma.$queryRawUnsafe(`
    select count(*)::int n from "AttendanceRecord" ar join "Account" a on a.id=ar."markedById" where a.role='STUDENT'`))
}
main().finally(()=>prisma.$disconnect())
