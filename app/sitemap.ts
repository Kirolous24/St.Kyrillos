import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL

  const routes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/schedule`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/about/coptic-orthodoxy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about/st-kyrillos-vi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about/clergy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about/faqs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/services/sunday-school`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/choir`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/hymns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/mens-meeting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/womens-meeting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/youth-meeting`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/services/kitchen-cleaning`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/confession`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/give`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/media/livestream`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/resources`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  return routes
}
