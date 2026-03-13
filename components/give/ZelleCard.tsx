'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function ZelleCard() {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)

  function copy(text: string, type: 'email' | 'phone') {
    navigator.clipboard.writeText(text)
    if (type === 'email') {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else {
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100">
      <div className="w-16 h-16 rounded-full bg-[#6D1ED4]/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="12" fill="#6D1ED4"/>
          <path d="M12 14h24l-16 20h16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
        Give via Zelle
      </h2>
      <p className="text-gray-600 mb-6">
        Send your donation directly via Zelle. No fees, instant transfer.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        {/* Email */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm break-all">
              popekyrillosnashvilletn@gmail.com
            </p>
            <button
              onClick={() => copy('popekyrillosnashvilletn@gmail.com', 'email')}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Copy email"
            >
              {copiedEmail ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* Phone */}
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</p>
          <div className="flex items-center justify-between gap-2">
            <a href="tel:9546630569" className="font-semibold text-gray-900 text-sm hover:text-[#6D1ED4] transition-colors">
              (954) 663-0569
            </a>
            <button
              onClick={() => copy('9546630569', 'phone')}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Copy phone"
            >
              {copiedPhone ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-4 text-center">
        Search by email or phone in your Zelle app
      </p>
    </div>
  )
}
