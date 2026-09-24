import { redirect } from 'next/navigation'
import { listVisibleClasses, type ClassSummary } from './classes'
import { can, type Action, type PortalUser } from '../permissions'

/**
 * The prototype gave servants Students / Attendance / Points as permanent
 * sidebar items (OG L4012 and neighbours) because a servant had exactly one
 * `classId`. Here a servant can hold several and an admin sees them all, so
 * these entry routes resolve straight through when there is only one class
 * and otherwise offer a pick list. Either way the sidebar item goes somewhere
 * useful in one click, which is what the port lost.
 *
 * `action` is what the destination will demand, and the list is filtered by it.
 * It used to offer everything the viewer could *read*, so a stage coordinator
 * picked a class from their stage and met a 404 — the pick list and the page it
 * led to disagreed about who may act. Fr. Pachom, who may read every class and
 * write to none, met the same dead end from the same list.
 */
export async function resolveClassEntry(
  user: PortalUser,
  suffix: string,
  action: Action = 'class.read',
): Promise<ClassSummary[]> {
  const classes = (await listVisibleClasses(user)).filter((c) =>
    can(user, action, { classId: c.id, classStage: c.stage }),
  )
  if (classes.length === 1) redirect(`/portal/classes/${classes[0]!.id}${suffix}`)
  return classes
}
