'use client'

import Image from 'next/image'

interface ClergyHeaderProps {
  clergName: string
  clergTitle: string
  clergImage: string
  pageTitle: string
}

export function ClergyHeader({
  clergName,
  clergTitle,
  clergImage,
  pageTitle
}: ClergyHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      {/* Clergy info */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          <Image
            src={clergImage}
            alt={clergName}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
        <div>
          <p className="font-medium text-gray-900">{clergName}</p>
          <p className="text-sm text-gray-500">{clergTitle}</p>
        </div>
      </div>

      {/* Page title */}
      <h1 className="font-serif text-heading-3 md:text-heading-2 text-gray-900">
        {pageTitle}
      </h1>
    </div>
  )
}
