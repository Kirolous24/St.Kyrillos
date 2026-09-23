import { redirect } from 'next/navigation'
import { listVisibleClasses, type ClassSummary } from './classes'
import type { PortalUser } from '../permissions'

/**
 * The prototype gave servants Students / Attendance / Points as permanent
 * sidebar items (OG L4012 and neighbours) because a servant had exactly one
 * `classId`. Here a servant can hold several and an admin sees them all, so
 * these entry routes resolve straight through when there is only one class
 * and otherwise offer a pick list. Either way the sidebar item goes somewhere
 * useful in one click, which is what the port lost.
 */
export async function resolveClassEntry(user: PortalUser, suffix: string): Promise<ClassSummary[]> {
  const classes = await listVisibleClasses(user)
  if (classes.length === 1) redirect(`/portal/classes/${classes[0]!.id}${suffix}`)
  return classes
}
