import { prisma } from '@/lib/prisma'

const KNOWN_USERS = ['Kirolous', 'Fr. Pachom', 'T. Marcelle']
const DISPLAY_NAMES: Record<string, string> = {
  'Kirolous': 'Kirolous',
  'Fr. Pachom': 'Abouna',
  'T. Marcelle': 'Tasoni',
}
const INITIALS: Record<string, string> = {
  'Kirolous': 'K',
  'Fr. Pachom': 'A',
  'T. Marcelle': 'T',
}
const AVATAR_COLORS: Record<string, string> = {
  'Kirolous': 'bg-primary-900 text-white',
  'Fr. Pachom': 'bg-gold text-primary-950',
  'T. Marcelle': 'bg-primary-200 text-primary-900',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Added',
  updated: 'Edited',
  deleted: 'Deleted',
  batch_created: 'Batch added',
}

const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-600',
  updated: 'text-blue-600',
  deleted: 'text-red-500',
  batch_created: 'text-green-600',
}

function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLastSeen(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export async function StatsPanel() {
  const [actionCounts, lastSeenRecords, recentLogs, totalEvents] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ['userName', 'action'],
      _sum: { count: true },
    }),
    prisma.userLastSeen.findMany(),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.scheduleEvent.count(),
  ])

  // Build per-user stats
  const userStats = KNOWN_USERS.map((user) => {
    const userActions = actionCounts.filter((a) => a.userName === user)
    const get = (action: string) =>
      userActions.find((a) => a.action === action)?._sum.count ?? 0

    const created = (get('created') ?? 0) + (get('batch_created') ?? 0)
    const updated = get('updated') ?? 0
    const deleted = get('deleted') ?? 0
    const total = created + updated + deleted

    const lastSeen = lastSeenRecords.find((r) => r.userName === user)?.lastSeenAt ?? null

    return { user, created, updated, deleted, total, lastSeen }
  })

  const totalActions = recentLogs.length

  return (
    <div className="max-w-4xl mx-auto px-4 pb-2">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Activity Overview</h2>
            <p className="text-xs text-gray-400 mt-0.5">{totalEvents} events live · {totalActions} actions logged</p>
          </div>
        </div>

        {/* User cards */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {userStats.map(({ user, created, updated, deleted, total, lastSeen }) => (
            <div key={user} className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${AVATAR_COLORS[user]}`}>
                  {INITIALS[user]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{DISPLAY_NAMES[user]}</p>
                  {lastSeen ? (
                    <p className="text-[11px] text-gray-400 leading-tight" title={formatLastSeen(lastSeen)}>
                      Last seen {formatRelative(lastSeen)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-300 leading-tight">Never signed in</p>
                  )}
                </div>
              </div>

              {total === 0 ? (
                <p className="text-xs text-gray-300 italic">No activity yet</p>
              ) : (
                <div className="flex gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{created}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Added</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{updated}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Edited</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-500">{deleted}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Deleted</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent activity feed */}
        {recentLogs.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${AVATAR_COLORS[log.userName] ?? 'bg-gray-200 text-gray-600'}`}>
                    {INITIALS[log.userName] ?? log.userName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium text-xs ${ACTION_COLORS[log.action] ?? 'text-gray-600'}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                      {log.count > 1 ? ` ×${log.count}` : ''}
                    </span>
                    <span className="text-gray-600 text-xs ml-1 truncate">{log.detail}</span>
                  </div>
                  <span className="text-[11px] text-gray-300 shrink-0 tabular-nums">
                    {formatRelative(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentLogs.length === 0 && (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-gray-300 italic">No activity logged yet. Actions will appear here as you manage the schedule.</p>
          </div>
        )}
      </div>
    </div>
  )
}
