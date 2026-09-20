import { notFound } from 'next/navigation'
import { Camera } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { loadMyPhoto } from '@/lib/portal/data/reports'
import { can } from '@/lib/portal/permissions'
import { setMyPhoto, removeMyPhoto, setStudentPhoto, removeStudentPhoto } from '@/lib/portal/actions/photos'
import { PageHeader, Card, Callout } from '@/components/portal/ui'
import { PhotoUpload } from '@/components/portal/PhotoUpload'

export const metadata = { title: 'Photo' }

/**
 * The signed-in person's own photo, or — with ?student=<id> — a photo for a
 * student in a class this servant serves. Both go through the same validated
 * server action.
 */
export default async function PhotoPage({ searchParams }: { searchParams: { student?: string } }) {
  const user = await requirePortalUser()

  if (searchParams.student) {
    const student = await requireStudentRead(user, searchParams.student)
    const allowed = can(user, 'student.write', {
      classId: student.classId ?? undefined,
      classStage: student.class?.stage,
      studentId: student.id,
    })
    if (!allowed) notFound()

    return (
      <>
        <PageHeader
          title={`Photo for ${studentName(student)}`}
          icon={<Camera className="h-5 w-5" />}
          subtitle={`${student.class?.name ?? 'No class'} · shown on the roster, the leaderboard and their report card.`}
          back={{ href: `/portal/students/${student.id}`, label: studentName(student) }}
        />
        <div className="mx-auto max-w-md">
          <Card>
            <PhotoUpload
              current={student.account.photo}
              name={studentName(student)}
              action={setStudentPhoto.bind(null, student.id)}
              removeAction={removeStudentPhoto.bind(null, student.id)}
              saveLabel="Save student photo"
            />
          </Card>
        </div>
      </>
    )
  }

  const me = await loadMyPhoto(user)

  return (
    <>
      <PageHeader
        title="My photo"
        icon={<Camera className="h-5 w-5" />}
        subtitle="A small picture so people know who they are talking to."
      />
      <div className="mx-auto max-w-md space-y-4">
        <Card>
          <PhotoUpload current={me.photo} name={me.displayName} action={setMyPhoto} removeAction={removeMyPhoto} />
        </Card>
        <Callout tone="info" title="Where it goes">
          The picture is shrunk in your browser and stored with your account — it never leaves the portal, and only
          people signed in to the portal can see it.
        </Callout>
      </div>
    </>
  )
}
