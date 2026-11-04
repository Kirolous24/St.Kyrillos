import { andList } from '@/lib/portal/format'
import { reservationPurpose } from '@/lib/portal/reservations'
import type { ReservationRow } from '@/lib/portal/data/reservations'
import type { TakenSlot } from './ReservationForm'

/** The reservations the form warns about, ready to hand to the browser. A request still waiting holds its time too. */
export function takenSlots(rows: readonly ReservationRow[]): TakenSlot[] {
  return rows.map((r) => {
    const who = r.servants.length > 0 ? andList(r.servants.map((s) => s.name)) : r.createdByName
    const waiting = r.status === 'PENDING' ? ', waiting for approval' : ''
    return {
      id: r.id,
      itemId: r.itemId,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      label: `${who ? `${reservationPurpose(r)} (${who})` : reservationPurpose(r)}${waiting}`,
    }
  })
}
