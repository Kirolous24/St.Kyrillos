'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, Cross } from 'lucide-react'
import type { CopticDayData } from '@/lib/coptic-api'

export function CopticDayMeta({ data }: { data: CopticDayData }) {
  if (!data.copticDate && !data.season) return null

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mt-0.5">
      {data.copticDate && (
        <span className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">
          {data.copticDate}
        </span>
      )}
      {data.season && (
        <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
          {data.season}
        </span>
      )}
      {data.isFasting && (
        <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
          Fasting
        </span>
      )}
      {data.feasts.map((f) => (
        <span
          key={f.id}
          className="bg-gold/20 text-gold px-1.5 py-0.5 rounded font-medium"
        >
          {f.name}
        </span>
      ))}
    </div>
  )
}

export function CopticDayPanel({ data }: { data: CopticDayData }) {
  const [showReadings, setShowReadings] = useState(false)
  const [showSaints, setShowSaints] = useState(false)

  const hasReadings = data.readings.length > 0
  const hasSaints = data.synaxarium.length > 0

  if (!hasReadings && !hasSaints) return null

  return (
    <div className="bg-gray-50/50 px-4 py-2 border-t border-gray-100 space-y-1">
      {/* Readings toggle */}
      {hasReadings && (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowReadings(!showReadings) }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-900 transition-colors py-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Today&apos;s Readings ({data.readings.length})
            {showReadings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showReadings && (
            <div className="ml-5 space-y-1 pb-2">
              {data.readings.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-gray-600">{r.section}:</span>{' '}
                  <span className="text-gray-800">{r.reference}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saints toggle */}
      {hasSaints && (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSaints(!showSaints) }}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-700 hover:text-purple-900 transition-colors py-1"
          >
            <Cross className="w-3.5 h-3.5" />
            Saints Commemorated ({data.synaxarium.length})
            {showSaints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSaints && (
            <div className="ml-5 space-y-1 pb-2">
              {data.synaxarium.map((s, i) => (
                <div key={i} className="text-xs text-gray-700">
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
