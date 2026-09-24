'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useChimeMuted, setChimeMuted } from '@/hooks/useChime'
import { buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Turns the confirmation tones off, everywhere at once.
 *
 * Sat next to the controls that make the noise rather than buried in Settings:
 * the moment you want silence is the moment you are standing in a quiet room
 * with the register open, and a preference you have to go and find is one you
 * put up with instead.
 */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useChimeMuted()
  return (
    <button
      type="button"
      data-sound-toggle=""
      aria-pressed={muted}
      onClick={() => setChimeMuted(!muted)}
      title={muted ? 'Sounds are off — turn them on' : 'Turn the sounds off'}
      aria-label={muted ? 'Turn confirmation sounds on' : 'Turn confirmation sounds off'}
      className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] px-2.5', className)}
    >
      {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      <span className="sr-only sm:not-sr-only sm:ml-1.5 sm:text-[11.5px]">{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  )
}
