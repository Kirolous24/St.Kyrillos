'use client'

import { Clock, MapPin } from 'lucide-react'

interface MetaInfoProps {
  duration: number
  location: {
    name: string
    street: string
    cityStateZip: string
  }
}

export function MetaInfo({ duration, location }: MetaInfoProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8 text-sm text-gray-600 mb-8 pb-8 border-b border-gray-200">
      {/* Duration */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span>{duration} min appointments</span>
      </div>

      {/* Location */}
      <div className="flex items-start gap-2">
        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div>
          <p>{location.name}</p>
          <p>{location.street}</p>
          <p>{location.cityStateZip}</p>
        </div>
      </div>
    </div>
  )
}
