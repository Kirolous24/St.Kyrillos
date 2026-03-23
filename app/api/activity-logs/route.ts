import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const session = await auth()
  if (!session || session.user?.name !== 'Kirolous') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.activityLog.deleteMany({})
  return NextResponse.json({ ok: true })
}
