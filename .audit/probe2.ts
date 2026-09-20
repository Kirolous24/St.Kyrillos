import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main(){
  console.log(await prisma.$queryRawUnsafe(`select current_database(), current_schema(), version()`))
  console.log(await prisma.$queryRawUnsafe(`select table_schema, table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', table_schema, table_name), false,true,'')))[1]::text::int n from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema') order by n desc nulls last limit 25`))
}
main().finally(()=>prisma.$disconnect())
