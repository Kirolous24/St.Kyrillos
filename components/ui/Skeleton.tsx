import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-soft">
      <Skeleton className="w-16 h-16 rounded-full mb-4" />
      <Skeleton className="h-6 w-3/4 mb-3" />
      <SkeletonText lines={2} />
    </div>
  )
}

export function SkeletonImage({ className }: SkeletonProps) {
  return (
    <div className={cn('skeleton aspect-video rounded-lg', className)} />
  )
}
