'use client'

import { useState, useMemo } from 'react'
import { signOut } from 'next-auth/react'
import { Plus, Pencil, Trash2, X, LogOut, Zap } from 'lucide-react'
import { EVENT_PRESETS, DURATION_OPTIONS } from '@/lib/presets'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface ScheduleEvent {
  id: string
  date: string // ISO string from DB e.g. "2026-03-08T12:00:00.000Z"
  time: string
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

interface EventFormData {
  date: string // "YYYY-MM-DD"
  time: string // "HH:MM"
  durationMinutes: number
  title: string
  description: string
  location: string
}

// Extract "YYYY-MM-DD" from an ISO date string, timezone-safe (uses the UTC date stored at noon)
function isoToDateStr(iso: string): string {
  return iso.slice(0, 10)
}

// Parse "YYYY-MM-DD" into a local Date (midnight local time) — no UTC shift
function dateStrToLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Format a local Date as "YYYY-MM-DD"
function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Get the 4-week window bounds (local time), starting from this week's Sunday
function getWeekBounds() {
  const now = new Date()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - now.getDay())
  sunday.setHours(0, 0, 0, 0)

  return Array.from({ length: 4 }, (_, i) => {
    const start = new Date(sunday)
    start.setDate(sunday.getDate() + i * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  })
}

// Find the next upcoming occurrence of a given weekday within the 4-week window
function nextOccurrence(weekday: number, bounds: ReturnType<typeof getWeekBounds>): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 28; i++) {
    const d = new Date(bounds[0].start)
    d.setDate(bounds[0].start.getDate() + i)
    if (d >= today && d.getDay() === weekday) return toDateStr(d)
  }
  return toDateStr(bounds[0].start)
}

function timeToMinutes(t: string): number {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const p = m[3].toUpperCase()
  if (p === 'PM' && h !== 12) h += 12
  if (p === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function formatTimeForInput(display: string): string {
  const mins = timeToMinutes(display)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

function formatTimeForDisplay(t24: string): string {
  const [hStr, mStr] = t24.split(':')
  let h = parseInt(hStr)
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${period}`
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = mins / 60
  return h % 1 === 0 ? `${h} hr${h > 1 ? 's' : ''}` : `${h} hrs`
}

export function ScheduleManager({ initialEvents }: { initialEvents: ScheduleEvent[] }) {
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => toDateStr(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const weekBounds = useMemo(() => getWeekBounds(), [])
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const minDate = toDateStr(weekBounds[0].start)
  const maxDate = toDateStr(weekBounds[3].end)

  const [form, setForm] = useState<EventFormData>({
    date: todayStr,
    time: '09:00',
    durationMinutes: 60,
    title: '',
    description: '',
    location: '',
  })

  // The 7 days for the currently selected week
  const weekDays = useMemo(() => {
    const { start } = weekBounds[selectedWeek]
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateStr = toDateStr(date)
      const dayEvents = events
        .filter((e) => isoToDateStr(e.date) === dateStr)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      return { date, dateStr, dayEvents }
    })
  }, [events, selectedWeek, weekBounds])

  function openAddForm(defaultDate?: string) {
    setForm({ date: defaultDate || todayStr, time: '09:00', durationMinutes: 60, title: '', description: '', location: '' })
    setEditingEvent(null)
    setShowForm(true)
    setError('')
  }

  function openPresetForm(preset: typeof EVENT_PRESETS[0]) {
    setForm({
      date: selectedDateStr,
      time: preset.defaultTime ?? '09:00',
      durationMinutes: preset.durationMinutes,
      title: preset.title,
      description: preset.description || '',
      location: preset.location,
    })
    setEditingEvent(null)
    setShowForm(true)
    setError('')
  }

  function openEditForm(event: ScheduleEvent) {
    setForm({
      date: isoToDateStr(event.date),
      time: formatTimeForInput(event.time),
      durationMinutes: event.durationMinutes || 60,
      title: event.title,
      description: event.description || '',
      location: event.location || '',
    })
    setEditingEvent(event)
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingEvent(null)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const displayTime = formatTimeForDisplay(form.time)
    const sortOrder = timeToMinutes(displayTime)

    const payload = {
      date: form.date,
      time: displayTime,
      sortOrder,
      durationMinutes: form.durationMinutes,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
    }

    try {
      if (editingEvent) {
        const res = await fetch(`/api/schedule/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
        const updated = await res.json()
        setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)))
      } else {
        const res = await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        const created = await res.json()
        setEvents((prev) => [...prev, created])
      }
      closeForm()
      // Switch to the week that contains the saved date
      const d = dateStrToLocal(form.date)
      for (let i = 0; i < 4; i++) {
        if (d >= weekBounds[i].start && d <= weekBounds[i].end) {
          setSelectedWeek(i)
          break
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setEvents((prev) => prev.filter((ev) => ev.id !== id))
      setDeleteConfirm(null)
    } catch {
      setError('Failed to delete event.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
          <p className="text-gray-500 text-sm">
            Managing {MONTH_SHORT[weekBounds[0].start.getMonth()]} {weekBounds[0].start.getDate()} –{' '}
            {MONTH_SHORT[weekBounds[3].end.getMonth()]} {weekBounds[3].end.getDate()}, {weekBounds[3].end.getFullYear()}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Quick Add Presets */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium text-gray-700">Quick Add</span>
          <span className="text-xs text-gray-400">
            → {DAY_NAMES[dateStrToLocal(selectedDateStr).getDay()]}, {MONTH_SHORT[dateStrToLocal(selectedDateStr).getMonth()]} {dateStrToLocal(selectedDateStr).getDate()}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENT_PRESETS.map((preset) => (
            <button
              key={preset.title}
              onClick={() => openPresetForm(preset)}
              className="px-3 py-1.5 text-sm bg-primary-50 text-primary-900 rounded-lg hover:bg-primary-100 transition-colors border border-primary-100"
            >
              {preset.title}
              <span className="ml-1.5 text-xs text-primary-600">({formatDuration(preset.durationMinutes)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Week Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {weekBounds.map(({ start, end }, i) => {
          const count = events.filter((e) => {
            const d = dateStrToLocal(isoToDateStr(e.date))
            return d >= start && d <= end
          }).length
          const label = i === 0 ? 'This Week' : i === 1 ? 'Next Week' : `Week ${i + 1}`
          return (
            <button
              key={i}
              onClick={() => setSelectedWeek(i)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 border ${
                selectedWeek === i
                  ? 'bg-primary-900 text-white border-primary-900'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <span className="font-semibold">{label}</span>
              <span className={`ml-1.5 text-xs ${selectedWeek === i ? 'text-white/70' : 'text-gray-400'}`}>
                {MONTH_SHORT[start.getMonth()]} {start.getDate()} – {MONTH_SHORT[end.getMonth()]} {end.getDate()}
              </span>
              {count > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedWeek === i ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-700'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Days in selected week */}
      <div className="space-y-3">
        {weekDays.map(({ date, dateStr, dayEvents }) => {
          const isToday = dateStr === todayStr
          const isPast = dateStrToLocal(dateStr) < dateStrToLocal(todayStr)
          const isSelected = selectedDateStr === dateStr
          return (
            <div
              key={dateStr}
              className={`rounded-xl border overflow-hidden transition-all duration-150 ${
                isSelected
                  ? 'border-primary-900 ring-2 ring-primary-900/20 shadow-md'
                  : isToday
                    ? 'border-gold shadow-sm'
                    : 'border-gray-200'
              }`}
            >
              {/* Day Header — click to select */}
              <div
                onClick={() => setSelectedDateStr(dateStr)}
                className={`flex items-center justify-between px-4 py-3 border-b cursor-pointer select-none ${
                  isSelected
                    ? 'bg-primary-900/5 border-primary-900/20'
                    : isToday
                      ? 'bg-gold/10 border-gold/30'
                      : isPast
                        ? 'bg-gray-50 border-gray-100'
                        : 'bg-white border-gray-100 hover:bg-gray-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Date circle */}
                  <div className={`w-11 h-11 rounded-full flex flex-col items-center justify-center leading-none ${
                    isSelected ? 'bg-primary-900 text-white' : isToday ? 'bg-gold text-primary-950' : isPast ? 'bg-gray-200 text-gray-500' : 'bg-primary-50 text-primary-900'
                  }`}>
                    <span className="text-[9px] font-bold uppercase tracking-wide">{DAY_NAMES[date.getDay()].slice(0, 3)}</span>
                    <span className="text-lg font-bold">{date.getDate()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
                        {DAY_NAMES[date.getDay()]}, {MONTH_FULL[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
                      </span>
                      {isSelected && (
                        <span className="text-xs bg-primary-900 text-white px-1.5 py-0.5 rounded-full font-bold">Selected</span>
                      )}
                      {isToday && !isSelected && (
                        <span className="text-xs bg-gold text-primary-950 px-1.5 py-0.5 rounded-full font-bold">Today</span>
                      )}
                      {isPast && !isToday && (
                        <span className="text-xs text-gray-400">Past</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {dayEvents.length === 0 ? 'No events' : `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openAddForm(dateStr) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-900 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Events */}
              <div className="bg-white divide-y divide-gray-50">
                {dayEvents.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-300 italic">No events scheduled</p>
                ) : (
                  dayEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-primary-900 tabular-nums w-20">{event.time}</span>
                          <span className="font-medium text-gray-900">{event.title}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            {formatDuration(event.durationMinutes || 60)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-[5.25rem]">
                          {event.location && <span className="text-xs text-gray-500">{event.location}</span>}
                          {event.description && <span className="text-xs text-gray-400">{event.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <button
                          onClick={() => openEditForm(event)}
                          className="p-2 text-gray-400 hover:text-primary-900 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirm === event.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(event.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                              Confirm
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(event.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Button */}
      <button
        onClick={() => openAddForm()}
        className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Event
      </button>

      {error && !showForm && <p className="mt-4 text-red-600 text-sm">{error}</p>}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h2>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Schedule up to {MONTH_SHORT[weekBounds[3].end.getMonth()]} {weekBounds[3].end.getDate()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  maxLength={200}
                  placeholder="e.g. Divine Liturgy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  maxLength={200}
                  placeholder="e.g. Main Church"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={500}
                  rows={2}
                  placeholder="Optional details about this event"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900 resize-none"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Add Event'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
