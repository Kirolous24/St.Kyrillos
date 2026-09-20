import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LifeBuoy, Upload, PencilLine, Sparkles, Contact, QrCode, BookOpen } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader, Card, IconTile } from '@/components/portal/ui'

export const metadata = { title: 'Help & Guide' }

const ICON = 'h-[18px] w-[18px]'
const S = 'font-semibold text-parch-900'

/** One guide entry. Each links to the screen it describes, so the guide is a way in. */
function Topic({
  icon,
  tone,
  title,
  href,
  children,
}: {
  icon: React.ReactNode
  tone: string
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <Card bodyClassName="flex gap-3.5">
        <IconTile accent={tone} size="sm">
          {icon}
        </IconTile>
        <div className="min-w-0">
          <h2 className="mb-1.5 text-[13.5px] font-bold text-parch-900">
            <Link
              href={href}
              className="underline-offset-4 transition-colors hover:text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
            >
              {title}
            </Link>
          </h2>
          <p className="text-[12.5px] leading-[1.7] text-parch-600">{children}</p>
        </div>
      </Card>
    </li>
  )
}

export default async function HelpPage() {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  return (
    <>
      <PageHeader
        title="Help & Guide"
        icon={<LifeBuoy className="h-5 w-5" aria-hidden />}
        subtitle="A short tour of the things servants ask about most."
      />

      <ul className="space-y-3.5">
        <Topic icon={<Upload className={ICON} />} tone="#4F46E5" title="Import and export students" href="/portal/admin/data">
          In <b className={S}>Data &amp; Backup</b>, <b className={S}>Export CSV</b> downloads the full roster as a
          spreadsheet. <b className={S}>Import CSV</b> adds many students at once instead of one by one — download the
          template first so the columns line up, fill it in, then upload. You see a preview of every row, and any
          errors, before anything is saved.
        </Topic>

        <Topic icon={<PencilLine className={ICON} />} tone="#16A34A" title="Edit many students at once" href="/portal/admin/students">
          On <b className={S}>Students</b>, bulk edit changes one field — grade, a phone number, an address — for
          several students together. Promoting a whole class to the next grade becomes one action rather than thirty.
        </Topic>

        <Topic icon={<Sparkles className={ICON} />} tone="#C89B3C" title="Make your own point activities" href="/portal/admin/sessions">
          In a class&rsquo;s <b className={S}>Points</b> tab, add your own way to earn points — a name and how many
          points it is worth, say &ldquo;Choir practice&rdquo;. It appears beside the built-in ones for everyone in that
          class, and you can remove it again later.
        </Topic>

        <Topic icon={<Contact className={ICON} />} tone="#DC2626" title="Correct a student’s details" href="/portal/admin/students">
          Open a student to see their profile, then <b className={S}>Edit student info</b> to fix their name, grade,
          birthday, address, or a parent&rsquo;s name and phone number. Only the admin can move a student to a different
          class.
        </Topic>

        <Topic icon={<QrCode className={ICON} />} tone="#2563EB" title="Take attendance by QR code" href="/portal/qr">
          <b className={S}>QR Check-in</b> opens a scanner. Students hold up the code from their own{' '}
          <b className={S}>My QR Code</b> page and are marked present as they arrive — quicker than reading down a list
          on a busy Sunday.
        </Topic>

        <Topic icon={<BookOpen className={ICON} />} tone="#6F1D1B" title="Find the curriculum" href="/portal/curriculum">
          <b className={S}>Curriculum Resources</b> links straight to the official Diocese curriculum for every grade,
          plus the hymns and memorization curricula — no hunting around ssc.suscopts.org for them.
        </Topic>
      </ul>

      <p className="mt-6 text-center text-[12px] text-parch-500">
        Still stuck? Ask your Sunday School admin — they can reset a PIN, move a student, or fix an account.
      </p>
    </>
  )
}
