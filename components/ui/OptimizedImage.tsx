'use client'

import { useState } from 'react'
import Image, { ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad'> {
  fallbackColor?: string
}

export function OptimizedImage({
  className,
  fallbackColor = 'bg-gray-200',
  alt,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const fillContainerClass = props.fill ? 'w-full h-full' : undefined

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          fillContainerClass,
          fallbackColor,
          className
        )}
      >
        <span className="text-gray-400 text-sm">Image unavailable</span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', fillContainerClass, className)}>
      {/* Skeleton placeholder while loading */}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 skeleton',
            fallbackColor
          )}
        />
      )}
      <Image
        {...props}
        alt={alt}
        className={cn(
          'transition-all duration-500 ease-out',
          isLoading ? 'opacity-0 scale-105' : 'opacity-100 scale-100',
          className
        )}
        onLoadingComplete={() => setIsLoading(false)}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
