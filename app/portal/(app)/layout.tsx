import type { Metadata } from 'next'
import { Shell } from '@/components/portal/Shell'
import { requirePortalUser } from '@/lib/portal/session'
import { navForUser, userMenuForUser, mobileNavForUser } from '@/lib/portal/nav'
import { signOutPortal } from '@/lib/portal/actions/auth'
import { ROLE_LABEL, STAGE_LABEL, academicYearLabel, greetingFor, formatShortDate } from '@/lib/portal/format'
import { prisma } from '@/lib/prisma'
import { NotificationBell } from '@/components/portal/NotificationBell'
import { BirthdayChip } from '@/components/portal/BirthdayChip'
import { nextBirthdayForTopbar } from '@/lib/portal/data/dashboard'
import { loadNotifications } from '@/lib/portal/data/reports'
import { withNavBadges } from '@/lib/portal/nav'
import { todayInNewYork } from '@/lib/portal/dates'

export const metadata: Metadata = {
  title: { default: 'Sunday School Portal', template: '%s | Sunday School' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser()
  const today = todayInNewYork()
  const nextBirthday = await nextBirthdayForTopbar(user, today)
  // Already loaded by <NotificationBell /> below; loadNotifications is
  // request-cached, so reading it here costs no extra query.
  const notifications = await loadNotifications(user)
  // F0792 — the bell's open-case alert embeds its own count in its key
  // ("cases:open:12"), and loadNotifications drops whatever has been
  // dismissed. So a pastor who dismisses "12 open follow-up cases" is left
  // with no sign anywhere that twelve children are still waiting, until the
  // number changes. The prototype kept two indicators for exactly this reason:
  // the bell is an alert and can be dismissed, the sidebar count is the state
  // of the list and cannot. Church-wide roles only — a servant's Follow-ups
  // page is scoped to their own classes, and a church-wide number on their row
  // would promise cases they cannot open.
  const openCases =
    user.role === 'ADMIN' || user.role === 'PASTOR'
      ? await prisma.followUpCase.count({ where: { status: 'OPEN' } })
      : 0
  const nav = withNavBadges(navForUser(user), notifications).map((item) =>
    openCases > 0 && item.href === '/portal/follow-ups' ? { ...item, badge: openCases } : item,
  )
  /**
   * The prototype's class workspace (OG `adOpenClassView`): an admin who opens a
   * class gets that class's rail, an "Admin View · <class>" pill and a way back.
   * Shell recognises the URL; this is only the id -> name map it needs to name
   * the class, and it is limited to classes this user may already open — an id
   * that is not in it simply leaves the ordinary rail in place.
   *
   * Nothing here changes who the user is. Only ADMIN gets it, matching the
   * prototype, and their writes are still recorded as their own.
   */
  /**
   * The one class whose identity crowns a servant's rail — their own, when there
   * is exactly one answer. A servant on two classes keeps the person crest,
   * because the prototype assumed one class per servant and this portal does
   * not, so there is no honest single class to name for them.
   *
   * A stage coordinator who teaches exactly one class does get it. They used to
   * be excluded, which meant the servants with the most classes in view were
   * the ones with nothing on the rail telling them which was their own.
   * Overseeing a stage is a second job, not a different home class.
   */
  const crestClassId =
    user.role === 'SERVANT' && user.classIds.length === 1 ? user.classIds[0]! : null

  /**
   * Class identities the rail may need: every class for an admin (so opening any
   * one of them can name it), or just the servant's own.
   */
  const classRows =
    user.role === 'ADMIN' || crestClassId
      ? await prisma.schoolClass.findMany({
          where: user.role === 'ADMIN' ? {} : { id: crestClassId! },
          select: { id: true, name: true, photo: true, stage: true },
        })
      : []
  const classInfo = Object.fromEntries(
    classRows.map((c) => [c.id, { name: c.name, photo: c.photo, stage: STAGE_LABEL[c.stage] }]),
  )
  return (
    <Shell
      nav={nav}
      classInfo={classInfo}
      canEnterClassWorkspace={user.role === 'ADMIN'}
      crestClassId={crestClassId}
      userMenu={userMenuForUser(user)}
      mobileNav={mobileNavForUser(user)}
      userName={user.displayName}
      roleLabel={
        // F0303 — the crest named the role and stopped: every servant read
        // "SERVANT", including the one who answers for a whole stage. The
        // prototype put the stage right under the name, and it is how the
        // church tells two people with the same title apart when one of them
        // is the person you are meant to ask about Middle School.
        user.stageOversight ? `${ROLE_LABEL[user.role]} · ${STAGE_LABEL[user.stageOversight]}` : ROLE_LABEL[user.role]
      }
      userPhoto={user.photo}
      onSignOut={signOutPortal}
      greeting={greetingFor()}
      academicYear={academicYearLabel(today)}
      topbarChip={
        <BirthdayChip
          name={nextBirthday?.name}
          when={nextBirthday ? formatShortDate(nextBirthday.on) : null}
          more={nextBirthday?.more ?? 0}
        />
      }
      headerSlot={<NotificationBell />}
    >
      {children}
    </Shell>
  )
}
