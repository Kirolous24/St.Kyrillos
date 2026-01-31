import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Clock, Users, Target, ArrowLeft } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sunday School',
  description: `Sunday School at ${CHURCH_INFO.fullName}. Religious education for children and adults.`,
}

export default function SundaySchoolPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Sunday School
            </h1>
            <p className="text-xl text-white/80">
              Growing in Faith, Together
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl">
          <div className="mb-12">
            <h2 className="font-serif text-3xl font-semibold text-gray-900 mb-6">
              About Sunday School
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Sunday School is the heart of our faith formation ministry. We provide structured, age-appropriate religious education for children and young people, helping them understand the teachings of the Gospel and develop a deeper connection with Christ and the Church.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Who It's For */}
            <div className="bg-primary-50 rounded-xl p-6 border border-primary-100">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-primary-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Who It's For</h3>
              </div>
              <p className="text-gray-700">
                Children and young adults (ages 3-18), organized into grade-appropriate classes. Parents are also welcome to join adult education sessions.
              </p>
            </div>

            {/* What You'll Get Out of It */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-5 h-5 text-blue-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Benefits</h3>
              </div>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Deeper understanding of the Gospel</li>
                <li>• Bible study and scripture memorization</li>
                <li>• Orthodox Christian values and traditions</li>
                <li>• Community with peers in faith</li>
              </ul>
            </div>

            {/* When & Where */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-green-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Schedule</h3>
              </div>
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Day:</span> Sunday
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Time:</span> [TIME - Add specific time]
              </p>
              <p className="text-gray-700 text-sm mt-3">
                Location: Church Hall
              </p>
            </div>
          </div>

          {/* Images Placeholder */}
          <div className="mb-12">
            <h3 className="font-serif text-2xl font-semibold text-gray-900 mb-6">
              Sunday School in Action
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-xl overflow-hidden bg-gray-200 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 font-medium">[Image 1]</p>
                  <p className="text-gray-500 text-sm">Sunday School class in session</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden bg-gray-200 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 font-medium">[Image 2]</p>
                  <p className="text-gray-500 text-sm">Students learning together</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden bg-gray-200 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 font-medium">[Image 3]</p>
                  <p className="text-gray-500 text-sm">Community gathering</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-950 rounded-xl p-8 text-white text-center">
            <h3 className="font-serif text-2xl font-semibold mb-4">
              Join Us This Sunday
            </h3>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto">
              Sunday School is open to all children and young adults in our community. No prior knowledge needed—just a desire to grow in faith!
            </p>
            <Link
              href="/contact"
              className="inline-block bg-white text-primary-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Get More Information
            </Link>
          </div>
        </div>
      </section>

      {/* Back Link */}
      <section className="section-padding bg-gray-50 border-t border-gray-200">
        <div className="container-custom">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-primary-900 hover:text-primary-950 font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Services
          </Link>
        </div>
      </section>
    </>
  )
}
