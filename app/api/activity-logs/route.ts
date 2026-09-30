import { NextResponse } from 'next/server'
import { siteAdminSession } from '@/lib/site-admin'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const session = await siteAdminSession()
  if (!session || session.user?.name !== 'Kirolous') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.activityLog.deleteMany({})
  return NextResponse.json({ ok: true })
}
