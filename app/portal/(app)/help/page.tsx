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

  // Several topics linked straight at /portal/admin/*, which 404s for a servant
  // — the guide sent them to a wall. Each now points at the surface their own
  // role actually has: /portal/students resolves to their class roster.
  const isAdmin = user.role === 'ADMIN'
  const dataHref = isAdmin ? '/portal/admin/data' : '/portal/students'
  const studentsHref = isAdmin ? '/portal/admin/students' : '/portal/students'

  return (
    <>
      <PageHeader
        title="Help & Guide"
        icon={<LifeBuoy className="h-5 w-5" aria-hidden />}
        subtitle="A short tour of the things servants ask about most."
      />

      <ul className="space-y-3.5">
        <Topic icon={<Upload className={ICON} />} tone="#4F46E5" title="Import and export students" href={dataHref}>
          {isAdmin ? (
            <>
              In <b className={S}>Data &amp; Backup</b>, <b className={S}>Export CSV</b> downloads the full roster as a
              spreadsheet. <b className={S}>Import CSV</b> adds many students at once instead of one by one — download
              the template first so the columns line up, fill it in, then upload. <b className={S}>Preview</b> shows
              exactly what the file would do, and any errors, before anything is saved.
            </>
          ) : (
            <>
              On your class page, <b className={S}>Export CSV</b> downloads that class&rsquo;s roster as a spreadsheet.
              Importing a file back in creates and moves accounts church-wide, so it stays with the admin — send them
              the filled-in sheet.
            </>
          )}
        </Topic>

        <Topic icon={<PencilLine className={ICON} />} tone="#16A34A" title="Edit many students at once" href={studentsHref}>
          {isAdmin ? (
            <>
              On <b className={S}>All students</b>, tick the students you want, then use the bar at the bottom to set
              one field — grade, a phone number, an address — for all of them together. Promoting a whole class to the
              next grade becomes one action rather than thirty, and <b className={S}>Undo</b> puts the old values back.
            </>
          ) : (
            <>
              Editing many students at once is an admin tool. Open a student from your class page and use{' '}
              <b className={S}>Edit</b> to change their details one at a time, or ask the admin to run a bulk change.
            </>
          )}
        </Topic>

        {/* F0652 — this topic still pointed at /portal/admin/sessions, which
            turns away everyone but an admin (admin/sessions/page.tsx:13): the
            guide sent a servant to a wall over a feature they already have.
            addActivity() lives on their own class's Points page. The pastor has
            points.write on no class at all, so that page 404s for him too — he
            gets the leaderboard, which is the part of this that is his. */}
        <Topic
          icon={<Sparkles className={ICON} />}
          tone="#C89B3C"
          title="Make your own point activities"
          href={user.role === 'PASTOR' ? '/portal/leaderboard' : '/portal/points'}
        >
          {user.role === 'PASTOR' ? (
            <>
              Point activities are set up by each class&rsquo;s own servants, on that class&rsquo;s{' '}
              <b className={S}>Points</b> tab — a name and how many points it is worth, say &ldquo;Choir
              practice&rdquo;. The <b className={S}>Leaderboard</b> shows where the children stand once they are
              awarded.
            </>
          ) : (
            <>
              In a class&rsquo;s <b className={S}>Points</b> tab, <b className={S}>+ New activity</b> adds your own way
              to earn points — a name and how many points it is worth, say &ldquo;Choir practice&rdquo;. It appears
              beside the built-in ones for everyone in that class, and you can remove it again later.
            </>
          )}
        </Topic>

        <Topic icon={<Contact className={ICON} />} tone="#DC2626" title="Correct a student’s details" href={studentsHref}>
          Open a student to see their profile, then <b className={S}>Edit student info</b> to fix their name, grade,
          birthday, address, or a parent&rsquo;s name and phone number. Only the admin can move a student to a different
          class.
        </Topic>

        <Topic icon={<QrCode className={ICON} />} tone="#2563EB" title="Take attendance by QR code" href="/portal/qr">
          <b className={S}>QR Check-in</b> opens a scanner. Students hold up the code from their own{' '}
          <b className={S}>My QR Code</b> page and are marked present as they arrive — quicker than reading down a list
          on a busy Sunday.{' '}
          {/* F0011 — the printed card format changed (STKQR:<uid> became a
              4-digit ID), so every card printed by the old Sunday School app is
              now unreadable. Without this sentence a servant holds up an old
              card on a Sunday morning, gets "could not read that card", and
              concludes the scanner is broken. Named in prose rather than
              hyperlinked on purpose: Print QR cards turns a pastor away, and
              the pastor reads this page. */}
          <b className={S}>Cards printed from the old Sunday School app will not scan</b> — the code on them is a
          different format. Print a fresh set once from <b className={S}>Print QR cards</b> on the QR Check-in page and
          hand them out; until a class has new cards, type the student&rsquo;s 4-digit ID instead.
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
