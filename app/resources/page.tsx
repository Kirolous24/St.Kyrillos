import { redirect } from 'next/navigation'

// Redirect /resources to /resources/sermons
export default function ResourcesPage() {
  redirect('/resources/sermons')
}
