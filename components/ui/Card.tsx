import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={cn(hover ? 'card-hover' : 'card', 'p-6', className)}>
      {children}
    </div>
  )
}

interface ActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  href: string
  className?: string
}

export function ActionCard({ icon: Icon, title, description, href, className }: ActionCardProps) {
  return (
    <Link href={href} className="block group">
      <div
        className={cn(
          'card-hover p-8 h-full',
          'group-hover:scale-[1.02] transition-transform duration-300',
          className
        )}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              'w-16 h-16 rounded-full bg-primary-50',
              'flex items-center justify-center mb-6',
              'group-hover:bg-primary-100',
              'group-hover:scale-110 transition-all duration-300'
            )}
          >
            <Icon className="w-8 h-8 text-primary-900 group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <h3 className="font-serif text-heading-4 text-gray-900 mb-3">
            {title}
          </h3>
          <p className="text-body text-gray-600 mb-4">
            {description}
          </p>
          <span className="text-gold font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all duration-300">
            Learn more
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

interface ContentCardProps {
  title: string
  date?: string
  author?: string
  excerpt?: string
  href: string
  category?: string
  className?: string
}

export function ContentCard({
  title,
  date,
  author,
  excerpt,
  href,
  category,
  className,
}: ContentCardProps) {
  return (
    <Link href={href} className="block group">
      <article className={cn('card-hover p-6', className)}>
        {(date || author || category) && (
          <div className="flex items-center gap-2 text-body-sm text-gray-500 mb-3">
            {category && (
              <>
                <span className="text-gold font-medium uppercase tracking-wide text-xs">
                  {category}
                </span>
                <span>•</span>
              </>
            )}
            {date && <time>{date}</time>}
            {author && date && <span>•</span>}
            {author && <span>{author}</span>}
          </div>
        )}
        <h3 className="font-serif text-heading-4 text-gray-900 mb-3 group-hover:text-primary-900 transition-colors">
          {title}
        </h3>
        {excerpt && (
          <p className="text-body text-gray-600 line-clamp-3 mb-4">{excerpt}</p>
        )}
        <span className="text-gold font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
          Read more
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </span>
      </article>
    </Link>
  )
}
