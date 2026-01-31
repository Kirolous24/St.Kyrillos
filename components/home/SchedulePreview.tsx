import { Calendar, ArrowRight, Clock, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SCHEDULE } from '@/lib/constants'
import { cn } from '@/lib/utils'

const dayIcons: { [key: string]: typeof Sun } = {
  'Sunday': Sun,
  'Wednesday': Moon,
  'Friday': Moon,
}

export function SchedulePreview() {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative">
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23722f37' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />

      <div className="container-custom relative">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 text-primary-900 text-sm font-medium mb-6">
            <Clock className="w-4 h-4" />
            <span>Service Times</span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-gray-900 mb-4">
            This Week at <span className="text-primary-900">St. Kyrillos</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Join us for worship, prayer, and fellowship
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {SCHEDULE.regular.map((day, index) => {
              const DayIcon = dayIcons[day.day] || Calendar
              const isHighlighted = day.day === 'Sunday'

              return (
                <div
                  key={day.day}
                  className={cn(
                    "group relative rounded-2xl p-6 transition-all duration-500",
                    "hover:shadow-soft-xl hover:-translate-y-1",
                    isHighlighted
                      ? "bg-primary-900 text-white shadow-soft-lg"
                      : "bg-white border border-gray-100 shadow-soft"
                  )}
                >
                  {/* Highlight badge */}
                  {isHighlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gold text-primary-950 text-xs font-bold rounded-full">
                      Main Service
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                      isHighlighted ? "bg-white/20" : "bg-primary-100"
                    )}>
                      <DayIcon className={cn(
                        "w-6 h-6",
                        isHighlighted ? "text-white" : "text-primary-900"
                      )} />
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-serif font-semibold text-xl",
                        isHighlighted ? "text-white" : "text-gray-900"
                      )}>
                        {day.day}
                      </h3>
                    </div>
                  </div>

                  {/* Services list */}
                  <ul className="space-y-4">
                    {day.services.map((service, idx) => (
                      <li
                        key={idx}
                        className={cn(
                          "flex justify-between items-start pb-3",
                          idx !== day.services.length - 1 && (isHighlighted ? "border-b border-white/20" : "border-b border-gray-100")
                        )}
                      >
                        <span className={cn(
                          "text-sm",
                          isHighlighted ? "text-white/80" : "text-gray-600"
                        )}>
                          {service.name}
                        </span>
                        <span className={cn(
                          "font-semibold text-sm whitespace-nowrap ml-4 tabular-nums",
                          isHighlighted ? "text-gold-light" : "text-primary-900"
                        )}>
                          {service.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Note */}
          <p className="text-center text-gray-400 text-sm mb-10 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            {SCHEDULE.calendarNote}
          </p>

          {/* CTA */}
          <div className="text-center">
            <Button href="/schedule" variant="primary" className="group">
              <span>View Full Schedule</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
