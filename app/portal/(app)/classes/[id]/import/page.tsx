import { Upload } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { pinVaultEnabled } from '@/lib/portal/pin-vault'
import { PageHeader } from '@/components/portal/ui'
import { ImportPanel } from '@/components/portal/ImportPanel'

export const metadata = { title: 'Import students' }

/**
 * A servant's student import, for their own class (2026-09-27). Until now the
 * import lived only on the admin's Data & Backup page, so a servant holding
 * their class list had to type it in one child at a time. The server keeps the
 * import inside this class and skips any child who is already in the portal.
 */
export default async function ClassImportPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'student.write')
  return (
    <>
      <PageHeader
        title="Import students"
        subtitle={`${cls.name} · add or update this class from a spreadsheet`}
        icon={<Upload className="h-5 w-5" aria-hidden />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <ImportPanel classes={[]} pinsKept={pinVaultEnabled()} fixedClass={{ id: cls.id, name: cls.name, takesOtherClasses: cls.takesOtherClasses }} />
    </>
  )
}
