import Link from 'next/link'
import { Cake } from 'lucide-react'

/**
 * The top bar's birthdays card (.atb-meeting-card). The prototype's version was
 * clickable and this one was an inert span, and it named only one child even
 * when several shared the week — so a servant had no idea there were others.
 *
 * With no name it still renders, saying so. The prototype did the same: a chip
 * that vanishes is indistinguishable from a chip that is broken, and "no
 * birthdays this week" is itself the answer to the question being asked.
 */
export function BirthdayChip({ name, when, more = 0 }: { name?: string | null; when?: string | null; more?: number }) {
  return (
    // F0254 — the topbar itself appears from 768px (Shell.tsx `md:flex`) but
    // this chip only from 1024px, so across the whole tablet band the bar had
    // room for it and it simply was not there. The OG showed it anywhere the
    // topbar showed, and a tablet propped by the door is exactly where someone
    // wants to know whose birthday it is.
    <Link
      href="/portal/birthdays"
      className="hidden shrink-0 items-center gap-2.5 rounded-[14px] border border-[#EEE9E1] bg-parch-50 py-[7px] pl-2.5 pr-3.5 transition-colors hover:border-brand-gold md:flex"
    >
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-brand-wash text-brand-gold" aria-hidden>
        <Cake className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-[10.5px] text-parch-500">Birthdays this week</span>
        {name ? (
          <span className="block text-[12px] font-bold text-parch-900">
            {name}
            {when ? ` · ${when}` : ''}
            {more > 0 && <span className="ml-1 font-semibold text-parch-500">+{more} more</span>}
          </span>
        ) : (
          <span className="block text-[12px] font-semibold text-parch-500">None this week</span>
        )}
      </span>
    </Link>
  )
}
