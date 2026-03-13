'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Plus, Trash2, X, LogOut, ChevronDown, ChevronUp, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { DURATION_OPTIONS } from '@/lib/presets'

interface TemplateEvent {
  id?: string
  title: string
  time: string
  durationMinutes: number
  location: string
  description: string | null
}

interface TemplateDay {
  id?: string
  dayOffset: number
  label: string
  events: TemplateEvent[]
}

interface Template {
  id: string
  name: string
  description: string
  totalDays: number
  days: TemplateDay[]
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = mins / 60
  return h % 1 === 0 ? `${h} hr${h > 1 ? 's' : ''}` : `${h} hrs`
}

function formatTime(t24: string): string {
  const [hStr, mStr] = t24.split(':')
  let h = parseInt(hStr)
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${period}`
}

export function TemplateManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [editing, setEditing] = useState<Template | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  function openNew() {
    setEditing({
      id: '',
      name: '',
      description: '',
      totalDays: 1,
      days: [{ dayOffset: 0, label: 'Day 1', events: [{ title: '', time: '09:00', durationMinutes: 60, location: 'Main Church', description: null }] }],
    })
    setIsNew(true)
    setExpandedDays(new Set([0]))
    setError('')
  }

  function openEdit(tmpl: Template) {
    // Deep copy
    setEditing(JSON.parse(JSON.stringify(tmpl)))
    setIsNew(false)
    setExpandedDays(new Set(tmpl.days.map((_, i) => i)))
    setError('')
  }

  function closeEditor() {
    setEditing(null)
    setIsNew(false)
    setError('')
  }

  // Day management
  function addDay() {
    if (!editing) return
    const newOffset = editing.days.length > 0 ? Math.max(...editing.days.map((d) => d.dayOffset)) + 1 : 0
    const updated = {
      ...editing,
      totalDays: newOffset + 1,
      days: [...editing.days, { dayOffset: newOffset, label: `Day ${newOffset + 1}`, events: [] }],
    }
    setEditing(updated)
    setExpandedDays(new Set(Array.from(expandedDays).concat(editing.days.length)))
  }

  function removeDay(idx: number) {
    if (!editing) return
    const days = editing.days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, dayOffset: i }))
    setEditing({ ...editing, totalDays: days.length, days })
  }

  function updateDay(idx: number, field: string, value: string) {
    if (!editing) return
    const days = editing.days.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    setEditing({ ...editing, days })
  }

  // Event management within a day
  function addEvent(dayIdx: number) {
    if (!editing) return
    const days = editing.days.map((d, i) => {
      if (i !== dayIdx) return d
      return { ...d, events: [...d.events, { title: '', time: '09:00', durationMinutes: 60, location: 'Main Church', description: null }] }
    })
    setEditing({ ...editing, days })
  }

  function removeEvent(dayIdx: number, evIdx: number) {
    if (!editing) return
    const days = editing.days.map((d, i) => {
      if (i !== dayIdx) return d
      return { ...d, events: d.events.filter((_, ei) => ei !== evIdx) }
    })
    setEditing({ ...editing, days })
  }

  function updateEvent(dayIdx: number, evIdx: number, field: string, value: string | number) {
    if (!editing) return
    const days = editing.days.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        events: d.events.map((ev, ei) => (ei === evIdx ? { ...ev, [field]: value } : ev)),
      }
    })
    setEditing({ ...editing, days })
  }

  function toggleDay(idx: number) {
    const next = new Set(expandedDays)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setExpandedDays(next)
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.name.trim()) { setError('Template name is required'); return }
    if (!editing.description.trim()) { setError('Description is required'); return }
    if (editing.days.length === 0) { setError('At least one day is required'); return }

    // Validate all events have titles
    for (const day of editing.days) {
      for (const ev of day.events) {
        if (!ev.title.trim()) { setError(`All events need a title (check ${day.label})`); return }
      }
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        totalDays: editing.days.length,
        days: editing.days.map((d, i) => ({
          dayOffset: i,
          label: d.label.trim(),
          events: d.events.map((ev) => ({
            title: ev.title.trim(),
            time: ev.time,
            durationMinutes: ev.durationMinutes,
            location: ev.location.trim() || 'Main Church',
            description: ev.description?.trim() || null,
          })),
        })),
      }

      let result: Template
      if (isNew) {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        result = await res.json()
        setTemplates((prev) => [...prev, result].sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        const res = await fetch(`/api/templates/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
        result = await res.json()
        setTemplates((prev) => prev.map((t) => (t.id === result.id ? result : t)))
      }
      closeEditor()
    } catch {
      setError('Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      setDeleteConfirm(null)
      if (editing?.id === id) closeEditor()
    } catch {
      setError('Failed to delete template.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Season Templates</h1>
          </div>
          <p className="text-gray-500 text-sm ml-8">Reusable schedule templates for feasts, fasts, and special seasons</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && !editing && <p className="mb-4 text-red-600 text-sm">{error}</p>}

      {/* Template List */}
      {!editing && (
        <div className="space-y-3">
          {templates.length === 0 && (
            <p className="text-gray-400 text-center py-12">No templates yet. Create your first one!</p>
          )}
          {templates.map((tmpl) => {
            const totalEvents = tmpl.days.reduce((sum, d) => sum + d.events.length, 0)
            return (
              <div key={tmpl.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex-1 cursor-pointer" onClick={() => openEdit(tmpl)}>
                    <h3 className="font-semibold text-gray-900">{tmpl.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{tmpl.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded font-medium">
                        {tmpl.totalDays} day{tmpl.totalDays > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400">
                        {totalEvents} event{totalEvents !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openEdit(tmpl)}
                      className="px-3 py-1.5 text-sm text-primary-900 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                    >
                      Edit
                    </button>
                    {deleteConfirm === tmpl.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(tmpl.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                          Delete
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(tmpl.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Quick preview of days */}
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {tmpl.days.map((day) => (
                    <span key={day.dayOffset} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {day.label} ({day.events.length})
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Template Editor */}
      {editing && (
        <div className="space-y-6">
          {/* Template Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Pascha (Holy) Week"
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="e.g. Palm Sunday through Bright Saturday (8 days)"
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 text-gray-900"
              />
            </div>
          </div>

          {/* Days */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Days ({editing.days.length})</h2>
              <button onClick={addDay} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-900 hover:bg-primary-50 rounded-lg border border-primary-100 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                Add Day
              </button>
            </div>

            {editing.days.map((day, dayIdx) => (
              <div key={dayIdx} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Day header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer select-none"
                  onClick={() => toggleDay(dayIdx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary-900 text-white text-xs font-bold flex items-center justify-center">
                      {dayIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={day.label}
                      onChange={(e) => { e.stopPropagation(); updateDay(dayIdx, 'label', e.target.value) }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Day label"
                      className="px-2 py-1 text-sm font-medium border border-transparent hover:border-gray-300 focus:border-primary-900 rounded focus:outline-none text-gray-900 bg-transparent"
                    />
                    <span className="text-xs text-gray-400">{day.events.length} event{day.events.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {editing.days.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeDay(dayIdx) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove day"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expandedDays.has(dayIdx) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Day events (expandable) */}
                {expandedDays.has(dayIdx) && (
                  <div className="p-4 space-y-3">
                    {day.events.length === 0 && (
                      <p className="text-sm text-gray-300 italic">No events — add one below</p>
                    )}
                    {day.events.map((ev, evIdx) => (
                      <div key={evIdx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <div className="col-span-3">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Time</label>
                            <input
                              type="time"
                              value={ev.time}
                              onChange={(e) => updateEvent(dayIdx, evIdx, 'time', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-900 text-gray-900"
                            />
                          </div>
                          <div className="col-span-5">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Title</label>
                            <input
                              type="text"
                              value={ev.title}
                              onChange={(e) => updateEvent(dayIdx, evIdx, 'title', e.target.value)}
                              placeholder="Event title"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-900 text-gray-900"
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Duration</label>
                            <select
                              value={ev.durationMinutes}
                              onChange={(e) => updateEvent(dayIdx, evIdx, 'durationMinutes', parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-900 text-gray-900"
                            >
                              {DURATION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-6">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Location</label>
                            <input
                              type="text"
                              value={ev.location}
                              onChange={(e) => updateEvent(dayIdx, evIdx, 'location', e.target.value)}
                              placeholder="Location"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-900 text-gray-900"
                            />
                          </div>
                          <div className="col-span-6">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Description (optional)</label>
                            <input
                              type="text"
                              value={ev.description || ''}
                              onChange={(e) => updateEvent(dayIdx, evIdx, 'description', e.target.value || '')}
                              placeholder="Optional"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-900 text-gray-900"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeEvent(dayIdx, evIdx)}
                          className="mt-4 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Remove event"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addEvent(dayIdx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-900 hover:bg-primary-50 rounded-lg border border-dashed border-primary-200 transition-colors w-full justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Event to {day.label}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Save / Cancel */}
          <div className="flex gap-3 sticky bottom-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors disabled:opacity-50 shadow-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isNew ? 'Create Template' : 'Save Changes'}
            </button>
            <button
              onClick={closeEditor}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-lg bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
