'use client'

import { OptimizedImage } from '@/components/ui/OptimizedImage'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { cn } from '@/lib/utils'

interface ImageTextSectionProps {
  imageSrc: string
  imageAlt: string
  imageCaption?: string
  imagePosition?: 'left' | 'right'
  stepNumber?: number
  children: React.ReactNode
  className?: string
  imageClassName?: string
}

export function ImageTextSection({
  imageSrc,
  imageAlt,
  imageCaption,
  imagePosition = 'left',
  stepNumber,
  children,
  className,
  imageClassName,
}: ImageTextSectionProps) {
  const { ref, isVisible } = useScrollAnimation()

  const imageBlock = (
    <div className={cn(
      'relative',
      isVisible
        ? imagePosition === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'
        : 'opacity-0'
    )}>
      {stepNumber && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:-top-4 md:-left-4 z-10 w-10 h-10 rounded-full bg-gold flex items-center justify-center shadow-lg">
          <span className="font-serif font-bold text-white text-lg">{stepNumber}</span>
        </div>
      )}
      <OptimizedImage
        src={imageSrc}
        alt={imageAlt}
        width={600}
        height={400}
        className={cn(
          'rounded-xl shadow-soft-xl w-full h-auto object-cover aspect-[4/3]',
          imageClassName
        )}
      />
      {imageCaption && (
        <p className="mt-3 text-sm text-gray-500 text-center">
          {imageCaption}
        </p>
      )}
    </div>
  )

  const textBlock = (
    <div className={cn(
      'flex flex-col justify-center',
      isVisible
        ? imagePosition === 'left' ? 'animate-slide-in-right' : 'animate-slide-in-left'
        : 'opacity-0'
    )}>
      {children}
    </div>
  )

  return (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center',
        className
      )}
    >
      {imagePosition === 'left' ? (
        <>
          {imageBlock}
          {textBlock}
        </>
      ) : (
        <>
          {textBlock}
          {imageBlock}
        </>
      )}
    </div>
  )
}
