import Link from '@/components/portal/Link'
import { notFound } from 'next/navigation'
import { LifeBuoy, Upload, PencilLine, Sparkles, Contact, QrCode, BookOpen, HeartHandshake, ClipboardList, ClipboardCheck, UsersRound } from 'lucide-react'
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
  // 2026-09-27 — servants import into their own class: straight to it when they
  // have one, otherwise to the class list to pick one.
  const dataHref = isAdmin
    ? '/portal/admin/data'
    : user.classIds.length === 1
      ? `/portal/classes/${user.classIds[0]}/import`
      : '/portal/classes'
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
              exactly what the file would do, and any errors, before anything is saved. A new student whose name is
              already in the portal is skipped, so nobody is added twice.
            </>
          ) : (
            <>
              On your class page, <b className={S}>Import students</b> adds your class list from a spreadsheet:
              download the template, fill it in, choose the file, then <b className={S}>Preview</b> and{' '}
              <b className={S}>Confirm import</b>. Every row goes into your class, and a child who is already in the
              portal is skipped, so nobody is added twice. <b className={S}>Export</b> downloads your class with
              everyone&rsquo;s ID; edit it and import it back to update their details.
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
          title="How points work"
          href={user.role === 'ADMIN' ? '/portal/admin/sessions' : user.role === 'PASTOR' ? '/portal/leaderboard' : '/portal/points'}
        >
          {/* 2026-09-28 — sessions and the church-wide activities are the same
              in every class; each class may also add its own activities, at
              values it chooses (the church decided so a day after making them
              church-wide only). */}
          Children earn points for each session they attend, for their quiz scores, and for activities. Every class
          has the church&rsquo;s activities, and a class can add its own under <b className={S}>Class activities</b>{' '}
          and choose what each is worth. In a class&rsquo;s <b className={S}>Points</b> tab, pick the children and an
          activity, then <b className={S}>+ Give</b>. For anything else, choose <b className={S}>Custom</b>: type how
          many points and what for, and tick <b className={S}>Save for next time</b> to keep it as one of the
          class&rsquo;s own. Taking points away always costs 2 and needs a reason.{' '}
          {user.role === 'ADMIN' ? (
            <>
              You set the session values and the church&rsquo;s activities in <b className={S}>Sessions &amp; Points</b>.
            </>
          ) : (
            <>The admin sets the session values and the church&rsquo;s activities in Sessions &amp; Points.</>
          )}
        </Topic>
        <Topic icon={<Contact className={ICON} />} tone="#DC2626" title="Correct a student’s details" href={studentsHref}>
          Open a student to see their profile, then <b className={S}>Edit student info</b> to fix their name, grade,
          birthday, address, or a parent&rsquo;s name and phone number. <b className={S}>Call first</b> chooses whose
          number the Call and WhatsApp buttons use; it is the mother&rsquo;s unless you pick another. A class&rsquo;s{' '}
          <b className={S}>Photos</b> page takes every child&rsquo;s photo in one go, which helps with the youngest, who
          cannot add their own. Only the admin can move a student to a different class.
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

        {/* 2026-10-24 — the Women's, Men's and Youth meetings. */}
        <Topic
          icon={<HeartHandshake className={ICON} />}
          tone="#0E7490"
          title="Fellowship meetings"
          href={(user.fellowshipClassIds ?? []).length === 1 ? `/portal/classes/${user.fellowshipClassIds![0]}` : '/portal/classes'}
        >
          A meeting&rsquo;s people are <b className={S}>members</b>, not students: servants from any class, and people who
          don&rsquo;t serve. Add them on the meeting&rsquo;s page with <b className={S}>Add member</b> — find a servant by
          name so they keep their own login, or add someone new — or bring a whole list with{' '}
          <b className={S}>Import members</b> (paste straight from Google Sheets works). For attendance, tap names on{' '}
          <b className={S}>Take attendance</b>, or open <b className={S}>QR check-in</b>: members scan it with their phone
          camera, no app or sign-in, and tap their own name. Press <b className={S}>Done</b> when everyone is in, so the
          portal can open follow-ups for whoever keeps missing (two meetings in a row, unless the admin chose another
          number). There are no points, quizzes or grades.
        </Topic>

        {/* 2026-10-25 — the planner, the week's presentation and daily reminders. */}
        <Topic icon={<ClipboardList className={ICON} />} tone="#B45309" title="Your assignments, the planner and the presentation" href="/portal/assignments">
          <b className={S}>My Assignments</b> lists what you are down for, with the <b className={S}>Planner</b> every
          class uses, and each of your classes&rsquo; presentation for this Sunday and next: open it, or add or change
          the Canva link for everyone serving the class. Once your part is ready, tap <b className={S}>Mark done</b>;
          until then you are reminded each evening, and on Saturday evening of everything for Sunday. The 5th &amp; 6th
          and 7th &amp; 8th boys&rsquo; and girls&rsquo; classes can also take each other&rsquo;s attendance: open{' '}
          <b className={S}>Attendance</b> and pick the class.
        </Topic>

        {/* 2026-10-25 — groups shuffled every two months; the sender's greeting. */}
        <Topic icon={<UsersRound className={ICON} />} tone="#5B21B6" title="Follow-up groups and messages" href="/portal/my-group">
          Each child has one servant who follows them up, on <b className={S}>My Group</b>. Every two months the groups are
          shuffled, so each child gets to know another servant; brothers and sisters stay together, and everyone is told
          their new group. A class&rsquo;s Coordinator can press <b className={S}>Shuffle now</b> on the class page, which
          starts the two months again. Messages to families start &ldquo;Hello, this is&rdquo; and your name, so a parent
          knows who is writing. On <b className={S}>Follow-ups</b>, pick a <b className={S}>Class</b> at the top to see
          just that class.
        </Topic>

        {/* 2026-10-26 — one quiz posted to several classes. */}
        <Topic icon={<ClipboardCheck className={ICON} />} tone="#0E7490" title="Post one quiz to several classes" href="/portal/exams">
          On <b className={S}>Exams &amp; Quizzes</b>, write a quiz or import a sheet of them, then tick the other classes
          under <b className={S}>Also post to</b>. Each class gets its own copy, with its own results. You can post to
          every class you serve; a Stage coordinator to their stage; the admin to any class. The 5th &amp; 6th and
          7th &amp; 8th Coordinators and Assistant Coordinators can post to the other half of their pair too, though its
          results stay with its own servants.
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
