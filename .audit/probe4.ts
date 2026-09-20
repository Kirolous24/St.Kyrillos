import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
main().finally(()=>prisma.$disconnect())
async function main(){
  const rows:any[] = await prisma.$queryRawUnsafe(`
    select c.conrelid::regclass::text as child, a.attname as col, c.confrelid::regclass::text as parent,
      case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as on_delete
    from pg_constraint c join unnest(c.conkey) k(attnum) on true
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
    where c.contype='f' order by on_delete, child`)
  for (const r of rows) console.log(r.on_delete.padEnd(10), (r.child+'.'+r.col).padEnd(42), '->', r.parent)
}
