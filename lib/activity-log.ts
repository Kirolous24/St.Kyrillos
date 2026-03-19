import { prisma } from './prisma'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatEventDetail(title: string, dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`)
  return `${title} on ${DAY_SHORT[d.getUTCDay()]}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export async function logActivity(
  userName: string,
  action: 'created' | 'updated' | 'deleted' | 'batch_created',
  detail: string,
  count = 1
) {
  try {
    await prisma.activityLog.create({ data: { userName, action, detail, count } })
  } catch {
    // Non-critical — never let logging break the main operation
  }
}
