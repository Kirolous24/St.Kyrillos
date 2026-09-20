import { Cake } from 'lucide-react'

/** The top bar's birthdays card (.atb-meeting-card). */
export function BirthdayChip({ name, when }: { name: string; when: string }) {
  return (
    <span className="hidden shrink-0 items-center gap-2.5 rounded-[14px] border border-[#EEE9E1] bg-parch-50 py-[7px] pl-2.5 pr-3.5 lg:flex">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-brand-wash text-brand-gold" aria-hidden>
        <Cake className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-[10.5px] text-parch-500">Birthdays this week</span>
        <span className="block text-[12px] font-bold text-parch-900">
          {name} · {when}
        </span>
      </span>
    </span>
  )
}
