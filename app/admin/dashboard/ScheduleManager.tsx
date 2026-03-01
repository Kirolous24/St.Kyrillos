'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Plus, Pencil, Trash2, X, LogOut, Zap } from 'lucide-react'
import { EVENT_PRESETS, DURATION_OPTIONS } from '@/lib/presets'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface ScheduleEvent {
  id: string
  dayOfWeek: number
  time: string
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

interface EventFormData {
  dayOfWeek: number
  time: string
  durationMinutes: number
  title: string
  description: string
  location: string
}

function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

function formatTimeForInput(timeStr: string): string {
  const minutes = timeToMinutes(timeStr)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function formatTimeForDisplay(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  let h = parseInt(hStr)
  const m = mStr
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const hrs = mins / 60
  return hrs % 1 === 0 ? `${hrs} hr${hrs > 1 ? 's' : ''}` : `${hrs} hrs`
}

export function ScheduleManager({ initialEvents }: { initialEvents: ScheduleEvent[] }) {
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents)
  const [selectedDay, setSelectedDay] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<EventFormData>({
    dayOfWeek: 0,
    time: '09:00',
    durationMinutes: 60,
    title: '',
    description: '',
    location: '',
  })

  const dayEvents = events
    .filter((e) => e.dayOfWeek === selectedDay)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  function openAddForm() {
    setForm({ dayOfWeek: selectedDay, time: '09:00', durationMinutes: 60, title: '', description: '', location: '' })
    setEditingEvent(null)
    setShowForm(true)
    setError('')
  }

  function openPresetForm(preset: typeof EVENT_PRESETS[0]) {
    setForm({
      dayOfWeek: preset.defaultDay ?? selectedDay,
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
      dayOfWeek: event.dayOfWeek,
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
      dayOfWeek: form.dayOfWeek,
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
      setSelectedDay(form.dayOfWeek)
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
          <p className="text-gray-500 text-sm">Manage weekly church events</p>
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

      {/* Day Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {DAYS.map((day, i) => {
          const count = events.filter((e) => e.dayOfWeek === i).length
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(i)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDay === i
                  ? 'bg-primary-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {day}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${selectedDay === i ? 'text-white/70' : 'text-gray-400'}`}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Events List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {dayEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No events scheduled for {DAYS[selectedDay]}
          </div>
        ) : (
          dayEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary-900 tabular-nums w-20">
                    {event.time}
                  </span>
                  <span className="font-medium text-gray-900">{event.title}</span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                    {formatDuration(event.durationMinutes || 60)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-[5.25rem]">
                  {event.location && (
                    <span className="text-xs text-gray-500">{event.location}</span>
                  )}
                  {event.description && (
                    <span className="text-xs text-gray-400">{event.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4 shrink-0">
                <button
                  onClick={() => openEditForm(event)}
                  className="p-2 text-gray-400 hover:text-primary-900 hover:bg-gray-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {deleteConfirm === event.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
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

      {/* Add Button */}
      <button
        onClick={openAddForm}
        className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Custom Event
      </button>

      {error && !showForm && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                >
                  {DAYS.map((day, i) => (
                    <option key={day} value={i}>{day}</option>
                  ))}
                </select>
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
