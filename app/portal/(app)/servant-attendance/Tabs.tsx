import { BarChart3, ClipboardCheck, QrCode } from 'lucide-react'
import { Tabs, TabLink } from '@/components/portal/ui'

/**
 * The prototype's one-page Take / Report / QR switcher. The port split these
 * into three surfaces with nothing linking them, so a servant on one had no
 * way to know the others existed.
 */
export function ServantAttendanceTabs({ active, weekStart }: { active: 'take' | 'report' | 'qr'; weekStart?: string }) {
  const week = weekStart ? `?week=${weekStart}` : ''
  const to = weekStart ? `?to=${weekStart}` : ''
  return (
    <Tabs>
      <TabLink href={`/portal/servant-attendance${week}`} active={active === 'take'}>
        <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" aria-hidden /> Take</span>
      </TabLink>
      <TabLink href={`/portal/servant-attendance/report${to}`} active={active === 'report'}>
        <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4" aria-hidden /> Weekly report</span>
      </TabLink>
      <TabLink href="/portal/qr?tab=group&mode=meeting" active={active === 'qr'}>
        <span className="inline-flex items-center gap-1.5"><QrCode className="h-4 w-4" aria-hidden /> QR check-in</span>
      </TabLink>
    </Tabs>
  )
}
