import type { PortalUser } from './permissions'
import type { NavItem } from '@/components/portal/Shell'
import { STAGE_LABEL } from './format'

// The portal's whole route map. Feature work adds pages under these paths;
// this file is the single place the sidebar is defined.

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

export function navForUser(user: PortalUser): NavItem[] {
  switch (user.role) {
    case 'ADMIN':
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes', section: 'People' },
        { href: '/portal/admin/students', label: 'Students', icon: 'students', section: 'People' },
        { href: '/portal/admin/servants', label: 'Servants', icon: 'servants', section: 'People' },
        ...stageItem(user, 'People'),
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups', section: 'People' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'People' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Teaching' },
        { href: '/portal/lessons', label: 'Lessons', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/agenda', label: 'Schedule of the Year', icon: 'agenda', section: 'Teaching' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Teaching' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/qr', label: 'QR Check-in', icon: 'qr', section: 'Attendance' },
        { href: '/portal/servant-attendance', label: 'Servants Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Community' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Community' },
        { href: '/portal/reports', label: 'Church Reports', icon: 'reports', section: 'Administration' },
        { href: '/portal/admin/classes', label: 'Manage Classes', icon: 'classes', section: 'Administration' },
        { href: '/portal/admin/sessions', label: 'Sessions & Points', icon: 'points', section: 'Administration' },
        { href: '/portal/admin/data', label: 'Data & Backup', icon: 'settings', section: 'Administration' },
        { href: '/portal/admin/audit', label: 'Activity Log', icon: 'audit', section: 'Administration' },
        SETTINGS,
        HELP,
      ]

    case 'PASTOR':
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
        { href: '/portal/classes', label: 'Classes', icon: 'classes', section: 'People' },
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups', section: 'People' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'People' },
        { href: '/portal/lessons', label: 'Lessons', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Teaching' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Community' },
        { href: '/portal/reports', label: 'Church Reports', icon: 'reports', section: 'Community' },
        SETTINGS,
        HELP,
      ]

    case 'SERVANT':
      return [
        { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
        { href: '/portal/classes', label: 'My Classes', icon: 'classes', section: 'My Class' },
        ...stageItem(user, 'My Class'),
        { href: '/portal/follow-ups', label: 'Follow-ups', icon: 'followups', section: 'My Class' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'My Class' },
        { href: '/portal/exams', label: 'Exams', icon: 'exams', section: 'Teaching' },
        { href: '/portal/lessons', label: 'Lesson Prep', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/agenda', label: 'Schedule of the Year', icon: 'agenda', section: 'Teaching' },
        { href: '/portal/assignments', label: 'My Assignments', icon: 'lessons', section: 'Teaching' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Teaching' },
        { href: '/portal/curriculum', label: 'Curriculum', icon: 'curriculum', section: 'Teaching' },
        { href: '/portal/qr', label: 'QR Check-in', icon: 'qr', section: 'Attendance' },
        { href: '/portal/servant-attendance', label: 'Servants Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'Attendance' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' },
        { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Community' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'Community' },
        { href: '/portal/reports', label: 'Reports', icon: 'reports', section: 'Community' },
        SETTINGS,
        HELP,
      ]

    case 'STUDENT':
      return [
        { href: '/portal', label: 'My Page', icon: 'dashboard' },
        { href: '/portal/quizzes', label: 'Quizzes', icon: 'exams', section: 'Learning' },
        { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Learning' },
        { href: '/portal/hymns', label: 'Hymns', icon: 'hymns', section: 'Learning' },
        { href: '/portal/achievements', label: 'Achievements', icon: 'achievements', section: 'My Progress' },
        { href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard', section: 'My Progress' },
        { href: '/portal/my-attendance', label: 'My Attendance', icon: 'attendance', section: 'My Progress' },
        { href: '/portal/my-qr', label: 'My QR Code', icon: 'qr', section: 'My Progress' },
        { href: '/portal/feed', label: 'Class Posts', icon: 'feed', section: 'Community' },
        { href: '/portal/events', label: 'Events', icon: 'events', section: 'Community' },
        { href: '/portal/birthdays', label: 'Birthdays', icon: 'birthdays', section: 'Community' },
        SETTINGS,
      ]
  }
}
