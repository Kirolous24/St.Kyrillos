export interface EventPreset {
  title: string
  durationMinutes: number
  location: string
  description: string | null
  defaultTime?: string  // 24-hr format, e.g. '09:00'
  defaultDay?: number   // 0=Sunday … 6=Saturday
}

export const EVENT_PRESETS: EventPreset[] = [
  { title: 'Divine Liturgy', durationMinutes: 180, location: 'Main Church', description: null },
  { title: 'Matins', durationMinutes: 60, location: 'Main Church', description: 'Morning Raising of Incense' },
  { title: 'Sunday School', durationMinutes: 120, location: 'Church & Trailer Classrooms', description: null, defaultTime: '11:30', defaultDay: 0 },
  { title: 'Bible Study', durationMinutes: 90, location: 'Fellowship Hall', description: null },
  { title: 'Youth Meeting', durationMinutes: 180, location: 'Main Church', description: null, defaultTime: '18:30', defaultDay: 0 },
  { title: 'Vespers', durationMinutes: 45, location: 'Main Church', description: 'Evening Raising of Incense' },
  { title: 'Midnight Praises', durationMinutes: 120, location: 'Main Church', description: null },
]

export const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hrs' },
  { value: 120, label: '2 hrs' },
  { value: 150, label: '2.5 hrs' },
  { value: 180, label: '3 hrs' },
  { value: 210, label: '3.5 hrs' },
  { value: 240, label: '4 hrs' },
]
