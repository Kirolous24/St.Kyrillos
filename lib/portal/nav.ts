import type { PortalUser } from './permissions'
import type { NavItem } from '@/components/portal/Shell'
import { STAGE_LABEL } from './format'

// The portal's whole route map. Feature work adds pages under these paths;
// this file is the single place the sidebar is defined.

const PROFILE: NavItem = { href: '/portal/profile', label: 'My Profile', icon: 'profile', section: 'Account' }
const SETTINGS: NavItem = { href: '/portal/settings', label: 'My PIN', icon: 'settings', section: 'Account' }
const HELP: NavItem = { href: '/portal/help', label: 'Help & Guide', icon: 'help', section: 'Account' }

/**
 * The stage overview only exists for servants who actually oversee one, and it
 * is labelled by that stage — "Middle School", not a generic "My Stage" — which
 * is how the prototype named it too.
 */
function stageItem(user: PortalUser, section: string): NavItem[] {
  if (!user.stageOversight) return []
  return [{ href: '/portal/my-stage', label: STAGE_LABEL[user.stageOversight], icon: 'stage', section }]
}

/**
 * The topbar avatar dropdown, restored from the prototype's `.atb-user-dd`
 * (OG L1555-1662). The prototype gave each role its own shortcut menu —
 * admins reached Classes / Servants / All Students / Settings from here, and
 * it is how the church's admins are used to navigating. Sign out lives here
 * for every role; in the OG only the servant and admin menus carried it, but
 * a menu that cannot sign you out is a dead end.
 *
 * Only routes that actually exist are listed. "My Profile" was the first item
 * in the OG's student and servant menus and is deliberately absent until that
 * page exists — a shortcut to a 404 is worse than no shortcut.
 */
export function userMenuForUser(user: PortalUser): NavItem[] {
  switch (user.role) {
    case 'ADMIN':
      return [
        { href: '/portal/profile', label: 'My Profile', icon: 'profile' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes' },
        { href: '/portal/admin/servants', label: 'Servants', icon: 'servants' },
        { href: '/portal/admin/students', label: 'All Students', icon: 'students' },
        { href: '/portal/admin/data', label: 'Settings', icon: 'settings' },
        { href: '/portal/photo', label: 'My Photo', icon: 'photo' },
      ]
    case 'PASTOR':
      return [
        { href: '/portal/profile', label: 'My Profile', icon: 'profile' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes' },
        // F0122 — the sidebar entry was pointed at the church-wide grid, but the
        // avatar menu still carried the same label over a bare /portal/reports,
        // which resolves to the Attendance tab pinned to whichever class happens
        // to be first. A pastor clicking "Church Reports" from any page landed
        // on one class's register.
        { href: '/portal/reports?tab=church', label: 'Church Reports', icon: 'reports' },
        { href: '/portal/photo', label: 'My Photo', icon: 'photo' },
      ]
    case 'SERVANT':
      return [
        { href: '/portal/profile', label: 'My Profile', icon: 'profile' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance' },
        { href: '/portal/assignments', label: 'My Assignments', icon: 'lessons' },
        { href: '/portal/photo', label: 'My Photo', icon: 'photo' },
      ]
    case 'STUDENT':
      return [
        { href: '/portal/profile', label: 'My Profile', icon: 'profile' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance' },
        { href: '/portal/my-qr', label: 'My QR Code', icon: 'qr' },
        { href: '/portal/photo', label: 'My Photo', icon: 'photo' },
      ]
  }
}

/**
 * The persistent mobile bottom bar, restored from the prototype's
 * `.mob-bottom-nav` (`#st-mob-nav` / `#sv-mob-nav` / `#ad-mob-nav` /
 * `#pt-mob-nav`, OG L19936-19963). Five one-tap destinations per role plus a
 * "More" button, which is how everyone actually navigated on a phone — and
 * servants and children are on phones every Sunday. The port replaced it with
 * a hamburger overlay, so every destination became two taps behind a menu.
 *
 * Labels are the prototype's own, abbreviated to fit a 64px bar.
 */
export function mobileNavForUser(user: PortalUser): NavItem[] {
  switch (user.role) {
    case 'ADMIN':
      return [
        { href: '/portal', label: 'Home', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes' },
        { href: '/portal/admin/servants', label: 'Servants', icon: 'servants' },
        { href: '/portal/admin/students', label: 'Students', icon: 'students' },
        { href: '/portal/announcements', label: 'News', icon: 'announcements' },
      ]
    case 'PASTOR':
      return [
        { href: '/portal', label: 'Home', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes' },
        { href: '/portal/leaderboard', label: 'Rank', icon: 'leaderboard' },
        { href: '/portal/events', label: 'Events', icon: 'events' },
        { href: '/portal/follow-ups', label: 'Visits', icon: 'followups' },
      ]
    case 'SERVANT':
      return [
        { href: '/portal', label: 'Home', icon: 'dashboard' },
        { href: '/portal/students', label: 'Students', icon: 'students' },
        { href: '/portal/attendance', label: 'Attend', icon: 'attendance' },
        { href: '/portal/points', label: 'Points', icon: 'points' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams' },
      ]
    case 'STUDENT':
      return [
        { href: '/portal', label: 'Home', icon: 'dashboard' },
        { href: '/portal/quizzes', label: 'Exams', icon: 'exams' },
        { href: '/portal/grades', label: 'Grades', icon: 'points' },
        { href: '/portal/readings', label: 'Reading', icon: 'readings' },
        { href: '/portal/profile', label: 'Profile', icon: 'profile' },
      ]
  }
}

/**
 * The class workspace an admin gets when they open a class — the prototype's
 * `adOpenClassView` (OG L2643-2657).
 *
 * In the old app, clicking a class card swapped the whole application into the
 * servant shell: `_me` was rewritten with `role:'servant'` and that class's id,
 * the sidebar became the servant's class-scoped rail, and an "Admin View" pill
 * plus an "Exit to Admin" button sat in the sidebar header. It did that because
 * the prototype was built twice — `pg-admin` and `pg-servant` were separate page
 * trees, and the admin's tree had no class workspace at all.
 *
 * **The identity swap is not reproduced, and the distinction matters.** The old
 * app had two of these. `adOpenClassView` kept the admin's own `uid` and changed
 * only role and scope, so anything written was still logged as the admin — that
 * is a view switch, and it is what this is. `adOpenServantProfile` (OG L2660)
 * set `uid: servantId`, so the admin *became* that servant and their writes were
 * recorded under that servant's name. That is impersonation, it is F0163, and
 * the church ruled it out: on children's records the log has to keep answering
 * "who marked this child absent".
 *
 * Every row below is genuinely scoped to the class. Two of the prototype's rows
 * only worked there because the whole app had been re-pointed at one class, so
 * their destinations here had to learn `?class=` first — a row that looks scoped
 * and quietly is not is worse than no row.
 */
export function classWorkspaceNav(classId: string, isAdmin: boolean): NavItem[] {
  const base = `/portal/classes/${classId}`
  return [
    { href: base, label: 'Students', icon: 'students', section: 'This class' },
    { href: `${base}/attendance`, label: 'Attendance', icon: 'attendance', section: 'This class' },
    { href: `${base}/points`, label: 'Points', icon: 'points', section: 'This class' },
    { href: `/portal/qr?class=${classId}`, label: 'QR Attendance', icon: 'qr', section: 'This class' },
    { href: `/portal/qr?tab=scan&mode=points&class=${classId}`, label: 'QR Points', icon: 'points', section: 'This class' },
    { href: `/portal/follow-ups?class=${classId}`, label: 'Follow-up', icon: 'followups', section: 'This class' },
    { href: `/portal/reports/class/${classId}`, label: 'Attendance Report', icon: 'reports', section: 'This class' },
    { href: `/portal/reports/cards?class=${classId}`, label: 'Student Reports', icon: 'reports', section: 'This class' },
    { href: `/portal/feed?class=${classId}`, label: 'Class Posts', icon: 'feed', section: 'This class' },
    { href: `/portal/lessons?class=${classId}`, label: 'Lesson Preparation', icon: 'lessons', section: 'This class' },
    { href: `/portal/exams?class=${classId}`, label: 'Exams', icon: 'exams', section: 'This class' },
    // Admin-only, and the one row a servant in this workspace would not have.
    ...(isAdmin
      ? [{ href: `${base}/credentials`, label: 'Logins & PINs', icon: 'settings', section: 'This class' } as NavItem]
      : []),
  ]
}

export function navForUser(user: PortalUser): NavItem[] {
  switch (user.role) {
    case 'ADMIN':
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes', section: 'People' },
        // F0158 — the prototype called this "All Students" and the avatar
        // dropdown still does. An admin reading "Students" beside "Classes" and
        // "Servants" cannot tell whether it is the church-wide roll or a
        // class's; "All" is the whole distinction.
        { href: '/portal/admin/students', label: 'All Students', icon: 'students', section: 'People' },
        { href: '/portal/admin/servants', label: 'Servants', icon: 'servants', section: 'People' },
        ...stageItem(user, 'People'),
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups', section: 'People' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'People' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Teaching' },
        { href: '/portal/lessons', label: 'Lessons', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/agenda', label: 'Schedule of the Year', icon: 'agenda', section: 'Teaching' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Teaching' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/attendance', label: 'Take Student Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/qr', label: 'QR Check-in', icon: 'qr', section: 'Attendance' },
        // F0159 — "QR Points" is the servant scanning children's codes to award
        // points (the OG's openQRAttendance('points')), not the projected group
        // code. It landed on the group generator, which is the other flow
        // entirely, and the scanner then opened on Attendance so the mode had to
        // be re-picked by hand. Both halves fixed: the tab, and ScanPanel
        // honouring ?mode= at last.
        { href: '/portal/qr?tab=scan&mode=points', label: 'QR Points', icon: 'points', section: 'Attendance' },
        { href: '/portal/servant-attendance', label: 'Servants Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Community' },
        { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Community' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Community' },
        // F0151 — Church Reports moves up to Community, where the pastor's copy
        // of the same page already sits: reading the church's numbers was never
        // a maintenance task.
        { href: '/portal/reports?tab=church', label: 'Church Reports', icon: 'reports', section: 'Community' },
        // F0151 / F0667 — the prototype had one sidebar item, "Settings", and an
        // admin told to "go to Settings" had to know which of four pages held
        // the thing they were sent for. The four are the same tools; the group
        // header is the word they were trained on. My PIN joins them, because
        // the OG's Settings page held Account & Login too — and it must stay
        // inside this run, since Shell groups by *contiguous* section, so an
        // item after PROFILE would draw a second "Settings" heading.
        { href: '/portal/admin/classes', label: 'Manage Classes', icon: 'classes', section: 'Settings' },
        { href: '/portal/admin/sessions', label: 'Sessions & Points', icon: 'points', section: 'Settings' },
        { href: '/portal/admin/data', label: 'Data & Backup', icon: 'settings', section: 'Settings' },
        { href: '/portal/admin/audit', label: 'Activity Log', icon: 'audit', section: 'Settings' },
        { ...SETTINGS, section: 'Settings' },
        PROFILE,
        HELP,
      ]

    case 'PASTOR':
      // F0165 — the prototype's pastor sidebar was six flat rows in this exact
      // order (index.stripped.html L19123-19128: overview, classes,
      // leaderboard, schedule/events, visitation, churchreports). Fr. Pachom
      // opens this rail a handful of times a week and navigates by position;
      // the pages added since had been interleaved through his six, so the row
      // that used to be third was now sixth. The six go back on top, unlabelled
      // as they were, and everything added since sits in named groups beneath.
      // No href changes, so the Follow-ups badge and any bookmark still resolve.
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
        { href: '/portal/events', label: 'Events', icon: 'events' },
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups' },
        { href: '/portal/reports?tab=church', label: 'Church Reports', icon: 'reports' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'People' },
        { href: '/portal/lessons', label: 'Lessons', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Teaching' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        // F0280 — every other role could reach the readings; the two who read
        // at the altar could not.
        { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Community' },
        PROFILE,
        SETTINGS,
        HELP,
      ]

    case 'SERVANT':
      // F0157 (and with it F0160, F0161, F0253, F0264, F0328, F0425) — the
      // prototype's seven servant groups, in its order, checked line by line
      // against _incoming/sunday-school/index.stripped.html L4006-4042:
      //   Overview · Attendance & Rewards · Planning · Community ·
      //   Servant Ministry · Teaching · Support
      // These are the names every servant in the church was trained on, and
      // four specific losses come back with them: "Attendance Report" and
      // "Student Reports" were two one-click items in the attendance group
      // rather than one "Reports" filed under Community (F0160/F0425);
      // Birthdays opened the Community block instead of trailing My Class
      // (F0253); "Lesson Preparation" meant the agenda, not the lesson archive,
      // so the label sat on the wrong page and a servant following it landed
      // somewhere they had never been sent (F0161/F0264); and the readings
      // belong with the material a servant opens while preparing, not with the
      // noticeboard (F0328).
      // Every href below already resolves for a SERVANT today, including
      // /portal/reports/cards, whose only gate is `user.role === 'STUDENT'`
      // (reports/cards/page.tsx:87), so no row here can 404.
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard', section: 'Overview' },
        // F0332 — the prototype gave a servant a "Class Profile" entry that went
        // to their class. Here it went to a list, and for the servants who serve
        // one class that list has one card on it: a click spent to be told what
        // they already knew. Students, Attendance and Points beside this one
        // already jump straight through. A stage overseer keeps the list,
        // because the classes they can open are not only the ones they are on.
        user.classIds.length === 1 && !user.stageOversight
          ? { href: `/portal/classes/${user.classIds[0]}`, label: 'Class Profile', icon: 'classes', section: 'Overview' }
          : { href: '/portal/classes', label: 'My Classes', icon: 'classes', section: 'Overview' },
        { href: '/portal/students', label: 'Students', icon: 'students', section: 'Attendance & Rewards' },
        { href: '/portal/attendance', label: 'Attendance', icon: 'attendance', section: 'Attendance & Rewards' },
        { href: '/portal/qr', label: 'QR Attendance', icon: 'qr', section: 'Attendance & Rewards' },
        // F0159 — see the admin rail above: the scan flow, opening in points mode.
        { href: '/portal/qr?tab=scan&mode=points', label: 'QR Points', icon: 'points', section: 'Attendance & Rewards' },
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups', section: 'Attendance & Rewards' },
        { href: '/portal/points', label: 'Points', icon: 'points', section: 'Attendance & Rewards' },
        { href: '/portal/reports', label: 'Attendance Report', icon: 'reports', section: 'Attendance & Rewards' },
        { href: '/portal/reports/cards', label: 'Student Reports', icon: 'reports', section: 'Attendance & Rewards' },
        { href: '/portal/agenda', label: 'Lesson Preparation', icon: 'agenda', section: 'Planning' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Planning' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'Community' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Community' },
        ...stageItem(user, 'Servant Ministry'),
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'Servant Ministry' },
        { href: '/portal/servant-attendance', label: 'Servants Attendance', icon: 'attendance', section: 'Servant Ministry' },
        { href: '/portal/assignments', label: 'My Assignments', icon: 'lessons', section: 'Servant Ministry' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Teaching' },
        { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Teaching' },
        { href: '/portal/lessons', label: 'Lessons', icon: 'lessons', section: 'Teaching' },
        { ...PROFILE, section: 'Support' },
        { ...SETTINGS, section: 'Support' },
        { ...HELP, section: 'Support' },
      ]

    case 'STUDENT':
      // F0164 / F0039 / F0236 — the prototype's student groups (Overview ·
      // Learning · Faith · Class) and, more importantly, its wording, read off
      // index.stripped.html L11585-11605: "Daily Quiz" and "Today's Reading"
      // are the names the church taught its children and printed on the sheets
      // servants hand out. A child told to "do the daily quiz" should find those
      // words on the rail rather than work out that it is called Quizzes here.
      // Every href is unchanged, so the quiz badge — which withNavBadges matches
      // on /portal/quizzes — survives the relabel.
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard', section: 'Overview' },
        { ...PROFILE, section: 'Overview' },
        { href: '/portal/quizzes', label: 'Daily Quiz', icon: 'exams', section: 'Learning' },
        { href: '/portal/grades', label: 'Grades & Points', icon: 'points', section: 'Learning' },
        { href: '/portal/achievements', label: 'Achievements', icon: 'achievements', section: 'Learning' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Learning' },
        { href: '/portal/readings', label: "Today's Reading", icon: 'readings', section: 'Faith' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Faith' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'Class' },
        { href: '/portal/my-qr', label: 'My QR Code', icon: 'qr', section: 'Class' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Class' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Class' },
        // F0279 — a child could be told something in an announcement and have
        // nowhere to go and read it: the dashboard card was the only way in and
        // it shows one notice. Checked the destination first, the way F0280 had
        // to be: /portal/announcements carries no role gate, and
        // listAnnouncements scopes a student to church-wide, their stage and
        // their own class, so this resolves rather than 404ing.
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Class' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'Class' },
        SETTINGS,
      ]
  }
}

/**
 * The prototype's sidebar badges — Daily Quiz (F0689), follow-up visits
 * (F0108/F0788), birthdays (F0789) and assignments (F0790/F0266).
 *
 * Every badge is derived from the person's own **unread notifications**, so:
 *   - no extra query: `loadNotifications` is request-cached and the bell
 *     already loads it;
 *   - the badge and the bell can never tell different stories;
 *   - dismissing the notification clears the badge, which is what the OG's
 *     clearExamBadge() did by hand.
 *
 * It counts what each notification *stands for* (twelve open cases, three
 * birthdays), not how many notifications there are — a "1" beside Follow-ups
 * when twelve children are waiting would be worse than no badge at all.
 *
 * Matching is by the notification's own `href`, so a new notification kind gets
 * its badge for free and no href can be badged that the nav does not contain.
 */
export function withNavBadges(
  items: NavItem[],
  notifications: readonly { href: string; count?: number }[],
): NavItem[] {
  const byHref = new Map<string, number>()
  for (const n of notifications) {
    byHref.set(n.href, (byHref.get(n.href) ?? 0) + (n.count ?? 1))
  }
  if (byHref.size === 0) return items
  return items.map((item) => {
    const count = byHref.get(item.href)
    return count ? { ...item, badge: count } : item
  })
}

/** @deprecated Use withNavBadges, which covers every destination. */
export function withQuizBadge(items: NavItem[], notifications: readonly { key: string }[]): NavItem[] {
  const count = notifications.filter((n) => n.key.startsWith('exam:')).length
  if (count === 0) return items
  return items.map((item) => (item.href === '/portal/quizzes' ? { ...item, badge: count } : item))
}
