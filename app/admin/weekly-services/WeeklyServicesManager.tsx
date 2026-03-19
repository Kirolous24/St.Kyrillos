'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, ArrowLeft, ToggleLeft, ToggleRight, Check } from 'lucide-react'
import Link from 'next/link'
import { DURATION_OPTIONS } from '@/lib/presets'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// All days in week order (Sun → Sat)
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

export interface WeeklyService {
  id: string
  dayOfWeek: number
  title: string
  time: string        // "HH:MM"
  durationMinutes: number
  location: string
  description: string | null
  enabled: boolean
  sortOrder: number
}

interface ServiceFormData {
  dayOfWeek: number
  title: string
  time: string
  durationMinutes: number
  location: string
  description: string
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = mins / 60
  return h % 1 === 0 ? `${h} hr${h > 1 ? 's' : ''}` : `${h} hrs`
}

function formatTimeDisplay(t24: string): string {
  const [hStr, mStr] = t24.split(':')
  let h = parseInt(hStr)
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${period}`
}

export function WeeklyServicesManager({ initialServices }: { initialServices: WeeklyService[] }) {
  const [services, setServices] = useState<WeeklyService[]>(initialServices)
  const [activeDay, setActiveDay] = useState<number>(0) // default to Sunday
  const [editingService, setEditingService] = useState<WeeklyService | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState<ServiceFormData>({
    dayOfWeek: 5,
    title: '',
    time: '09:00',
    durationMinutes: 60,
    location: 'Main Church',
    description: '',
  })

  const dayServices = services
    .filter((s) => s.dayOfWeek === activeDay)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  function openAddForm() {
    setForm({ dayOfWeek: activeDay, title: '', time: '09:00', durationMinutes: 60, location: 'Main Church', description: '' })
    setEditingService(null)
    setShowAddForm(true)
    setError('')
    setSuccessMsg('')
  }

  function openEditForm(service: WeeklyService) {
    setForm({
      dayOfWeek: service.dayOfWeek,
      title: service.title,
      time: service.time,
      durationMinutes: service.durationMinutes,
      location: service.location,
      description: service.description || '',
    })
    setEditingService(service)
    setShowAddForm(true)
    setError('')
    setSuccessMsg('')
  }

  function closeForm() {
    setShowAddForm(false)
    setEditingService(null)
    setError('')
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.time) {
      setError('Title and time are required.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      dayOfWeek: form.dayOfWeek,
      title: form.title.trim(),
      time: form.time,
      durationMinutes: form.durationMinutes,
      location: form.location.trim(),
      description: form.description.trim() || null,
      enabled: editingService ? editingService.enabled : true,
    }

    try {
      if (editingService) {
        const res = await fetch(`/api/weekly-services/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
        const updated: WeeklyService = await res.json()
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)).sort(sortFn))
        closeForm()
        showSuccess('Service updated.')
      } else {
        const res = await fetch('/api/weekly-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        const created: WeeklyService = await res.json()
        setServices((prev) => [...prev, created].sort(sortFn))
        setActiveDay(created.dayOfWeek)
        closeForm()
        showSuccess('Service added.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(service: WeeklyService) {
    try {
      const res = await fetch(`/api/weekly-services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...service, enabled: !service.enabled }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated: WeeklyService = await res.json()
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch {
      setError('Failed to toggle service.')
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/weekly-services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setServices((prev) => prev.filter((s) => s.id !== id))
      setDeleteConfirm(null)
      showSuccess('Service deleted.')
    } catch {
      setError('Failed to delete service.')
    } finally {
      setSaving(false)
    }
  }

  function sortFn(a: WeeklyService, b: WeeklyService) {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.sortOrder - b.sortOrder
  }

  const enabledCount = services.filter((s) => s.enabled).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Weekly Services</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {services.length} service{services.length !== 1 ? 's' : ''} configured
            {enabledCount < services.length && ` · ${enabledCount} active`}
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {error && !showAddForm && (
        <p className="mb-4 text-red-600 text-sm">{error}</p>
      )}

      {/* Day Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {ALL_DAYS.map((day) => {
          const count = services.filter((s) => s.dayOfWeek === day).length
          const activeCount = services.filter((s) => s.dayOfWeek === day && s.enabled).length
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border shrink-0 ${
                activeDay === day
                  ? 'bg-primary-900 text-white border-primary-900'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
              }`}
            >
              {DAY_SHORT[day]}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${activeDay === day ? 'text-white/70' : 'text-gray-400'}`}>
                  {activeCount}/{count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Services List */}
      <div className="space-y-2">
        {dayServices.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm mb-3">No services for {DAY_NAMES[activeDay]} yet.</p>
            <button
              onClick={openAddForm}
              className="text-sm text-primary-900 hover:underline font-medium"
            >
              Add one now
            </button>
          </div>
        ) : (
          dayServices.map((service) => (
            <div
              key={service.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                service.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-white">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleEnabled(service)}
                    className={`shrink-0 transition-colors ${service.enabled ? 'text-primary-900' : 'text-gray-300'}`}
                    title={service.enabled ? 'Disable' : 'Enable'}
                  >
                    {service.enabled
                      ? <ToggleRight className="w-7 h-7" />
                      : <ToggleLeft className="w-7 h-7" />
                    }
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-primary-900 tabular-nums">{formatTimeDisplay(service.time)}</span>
                      <span className="font-semibold text-gray-900">{service.title}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {formatDuration(service.durationMinutes)}
                      </span>
                      {!service.enabled && (
                        <span className="text-xs text-gray-400 italic">disabled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {service.location && <span className="text-xs text-gray-500">{service.location}</span>}
                      {service.description && <span className="text-xs text-gray-400">{service.description}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button
                    onClick={() => openEditForm(service)}
                    className="p-2 text-gray-400 hover:text-primary-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteConfirm === service.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(service.id)}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
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
                      onClick={() => setDeleteConfirm(service.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingService ? 'Edit Service' : 'Add Weekly Service'}
              </h2>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              {/* Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ALL_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setForm({ ...form, dayOfWeek: day })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.dayOfWeek === day
                          ? 'bg-primary-900 text-white border-primary-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {DAY_SHORT[day]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time + Duration */}
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

              {/* Title */}
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

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  maxLength={200}
                  placeholder="e.g. Main Church"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                />
                {/* Location quick-fill */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {['Main Church', 'Church & Trailer Classrooms', 'Fellowship Hall'].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setForm({ ...form, location: loc })}
                      className="px-2 py-0.5 text-xs text-primary-700 bg-primary-50 rounded hover:bg-primary-100 border border-primary-100 transition-colors"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={500}
                  placeholder="e.g. Evening Raising of Incense"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingService ? 'Update Service' : 'Add Service'}
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
