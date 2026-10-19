import { Tabs, TabLink } from '@/components/portal/ui'

/**
 * The Reports tabs, one copy for every page under /portal/reports. The weekly
 * report joined them on 2026-10-19. "Church reports" shows only to someone with
 * a church-wide or stage scope (F0142), or the tab would open the Attendance
 * tab while looking like somewhere they could go.
 */
export function ReportsTabs({ active, church }: { active: 'attendance' | 'weekly' | 'church' | 'cards'; church: boolean }) {
  return (
    <Tabs>
      <TabLink href="/portal/reports" active={active === 'attendance'}>
        Attendance
      </TabLink>
      <TabLink href="/portal/reports/weekly" active={active === 'weekly'}>
        Weekly report
      </TabLink>
      {church && (
        <TabLink href="/portal/reports?tab=church" active={active === 'church'}>
          Church reports
        </TabLink>
      )}
      <TabLink href="/portal/reports/cards" active={active === 'cards'}>
        Report cards
      </TabLink>
    </Tabs>
  )
}
