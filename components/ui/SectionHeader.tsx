import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
  titleClassName?: string
  subtitleClassName?: string
  withAccent?: boolean
}

export function SectionHeader({
  title,
  subtitle,
  centered = true,
  className,
  titleClassName,
  subtitleClassName,
  withAccent = false,
}: SectionHeaderProps) {
  return (
    <div className={cn(centered && 'text-center', 'mb-12', className)}>
      {withAccent && (
        <div className={cn('mb-4', centered && 'flex justify-center')}>
          <span className="inline-block w-12 h-1 bg-gold rounded-full" />
        </div>
      )}
      <h2
        className={cn(
          'font-serif text-heading-1 md:text-display-2 text-gray-900 text-balance',
          titleClassName
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-4 text-body-lg text-gray-600 max-w-2xl',
            centered && 'mx-auto',
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
