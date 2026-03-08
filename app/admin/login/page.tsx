import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLoginForm } from './AdminLoginForm'

export default async function AdminLoginPage() {
  const session = await auth()
  if (session) redirect('/admin/dashboard')

  return <AdminLoginForm />
}
