import Link from 'next/link'
import { CountUp } from './CountUp'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/portal/format'

/**
 * The portal's design kit, ported from the prototype's stylesheet.
 * Surfaces are cream (#FFFDF8) on a parchment ground (#F8F4EC), edged in gold
 * (#C89B3C); page headers are burgundy banners (#4A1212) with gold corner
 * flourishes; headings are Playfair, body is Lato.
 */

/* ── Page header: the burgundy banner (.ph) ───────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  icon,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  icon?: React.ReactNode
  /** Kept for source compatibility with earlier pages; no longer rendered. */
  eyebrow?: string
}) {
  return (
    <>
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-parch-500 transition-colors hover:text-brand-800"
        >
          ← {back.label}
        </Link>
      )}
      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3 overflow-hidden rounded-[14px] bg-brand-950 px-7 py-[22px] shadow-banner">
        {/* gold corner flourishes, exactly as .ph::before / .ph::after */}
        <span aria-hidden className="pointer-events-none absolute left-4 top-4 h-3.5 w-3.5 rounded-tl-[16px] border-l-[1.6px] border-t-[1.6px] border-brand-gold" />
        <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 h-3.5 w-3.5 rounded-br-[16px] border-b-[1.6px] border-r-[1.6px] border-brand-gold" />
        <div className="relative min-w-0">
          <h1 className="flex items-center gap-2.5 font-serif text-[21px] font-bold leading-tight tracking-[-0.2px] text-parch-50 md:text-[23px]">
            {icon && <span className="text-brand-gold">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="mt-1 max-w-2xl text-[12.5px] text-white/65">{subtitle}</p>}
        </div>
        {actions && <div className="relative flex flex-wrap gap-2 print:hidden">{actions}</div>}
      </div>
    </>
  )
}

/** Photo hero for the dashboard (.dash-hero-photo-wrap). */
export function HeroBanner({
  tag,
  title,
  verse,
  reference,
  photo = '/images/new_church2.jpg',
}: {
  tag: string
  title: string
  verse?: string
  reference?: string
  photo?: string
}) {
  return (
    <div className="relative mb-5 h-[170px] overflow-hidden rounded-[20px] shadow-hero">
      {/* next/image so the 11MB source is served as a resized, optimised file */}
      <Image
        src={photo}
        alt=""
        fill
        priority
        sizes="(max-width: 768px) 100vw, 1320px"
        className="object-cover"
        style={{ objectPosition: 'center 35%' }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg,rgba(74,18,18,.92) 0%,rgba(74,18,18,.72) 45%,rgba(74,18,18,.2) 100%)',
        }}
      />
      <div className="relative flex h-full max-w-[600px] flex-col justify-center px-7">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[1.1px] text-[#E8B84B]">{tag}</p>
        <p className="mb-1.5 font-serif text-[24px] font-bold leading-tight text-white">{title}</p>
        {verse && <p className="text-[12px] italic text-white/85">{verse}</p>}
        {reference && <p className="mt-px text-[10.5px] text-white/60">{reference}</p>}
      </div>
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-serif text-[17px] font-bold text-parch-900">{children}</h2>
      {hint && <span className="text-[12px] text-parch-500">{hint}</span>}
    </div>
  )
}

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

/** The cream card with a gold left edge (.c). */
export function Card({
  children,
  className,
  title,
  action,
  icon,
  bodyClassName,
  tone = 'default',
}: {
  children: React.ReactNode
  className?: string
  title?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  bodyClassName?: string
  tone?: 'default' | 'brand'
}) {
  return (
    <section
      className={cn(
        'portal-hover-lift overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_rgba(20,20,15,.12)]',
        tone === 'brand' && 'border-brand-gold/40 border-l-brand-gold',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-[#F3F0EB] px-[18px] py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-brand-gold-dark">{icon}</span>}
            {title && <h2 className="truncate text-[13px] font-semibold text-parch-900">{title}</h2>}
          </div>
          {action && <div className="shrink-0 print:hidden">{action}</div>}
        </header>
      )}
      <div className={cn('p-[18px]', bodyClassName)}>{children}</div>
    </section>
  )
}

/** A coloured rounded tile holding an icon (.stat-ico / .cls-icon). */
export function IconTile({
  accent = '#6F1D1B',
  size = 'md',
  children,
  solid = false,
}: {
  accent?: string
  size?: 'sm' | 'md'
  children: React.ReactNode
  solid?: boolean
}) {
  const dim = size === 'sm' ? 'h-[42px] w-[42px] rounded-[12px]' : 'h-[52px] w-[52px] rounded-[14px]'
  return (
    <span
      className={cn('grid shrink-0 place-items-center', dim)}
      style={solid ? { background: accent, color: '#fff' } : { background: `${accent}1A`, color: accent }}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** The stat card (.stat): gold left edge, icon tile, big number. */
/**
 * F0086 — whether a stat tile's value is a number worth counting up to, and how
 * to print it at each step. Returns null for anything that is not.
 *
 * Kept narrow on purpose. A tile can hold "—", "82%", "8 of 10", a name or an
 * element, and counting up to any of those is either meaningless or wrong: the
 * OG animated integers and percentages and nothing else.
 *
 * Returns plain data — a number and a suffix string — not a formatter. A function
 * cannot be passed to a client component, and doing so threw
 * "Functions cannot be passed directly to Client Components" on every page that
 * has a stat tile, which is all of them.
 */
function countableValue(value: React.ReactNode): { to: number; suffix: string } | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) && Math.abs(value) > 1
      ? { to: value, suffix: '' }
      : null
  }
  if (typeof value !== 'string') return null
  const m = /^(-?\d[\d,]*)(%?)$/.exec(value.trim())
  if (!m) return null
  const to = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(to) || Math.abs(to) <= 1) return null
  return { to, suffix: m[2] ?? '' }
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
  accent,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'brand'
  icon?: React.ReactNode
  accent?: string
}) {
  const toneColor = {
    default: '#2F2930',
    brand: '#6F1D1B',
    good: '#16A34A',
    warn: '#D97706',
    bad: '#DC2626',
  }[tone ?? 'default']
  const tile = accent ?? toneColor
  // F0095 — the left edge was gold on every tile, so a red "12 open cases" and
  // a green attendance rate read as the same kind of number down a row of five.
  // The prototype had four semantic edges (.stat.bl/.gr/.gd/.nv). It follows the
  // accent the call site already passes and falls back to gold when nothing
  // semantic was said, so a tile with no tone and no accent looks as it did.
  const edge = accent ?? (tone && tone !== 'default' ? toneColor : '#C89B3C')
  const countable = countableValue(value)

  return (
    // `data-stat` is a test hook. The label renders uppercase via CSS and the
    // word "Attendance" also appears on class cards and buttons, so a text
    // search cannot tell a stat tile from the rest of the page — a check that
    // read the page text would pass with the tile missing.
    <div
      data-stat={label}
      style={{ borderLeftColor: edge }}
      className="portal-hover-lift flex items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 bg-parch-50 p-5 shadow-panel transition-[transform,box-shadow,border-color] duration-250 hover:-translate-y-[3px] hover:border-[#DCD4C4] hover:shadow-[0_10px_28px_-8px_rgba(20,20,15,.18)]"
    >
      {icon && <IconTile accent={tile}>{icon}</IconTile>}
      <div className="min-w-0 flex-1">
        <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{label}</span>
        <span
          className="mb-0.5 block text-[30px] font-bold leading-none tracking-[-0.5px] tabular-nums"
          style={{ color: toneColor }}
        >
          {/* F0086 — counts up on screen, prints and server-renders as the final
              number, and does neither for a reader who asked for less motion. */}
          {countable ? <CountUp value={countable.to} suffix={countable.suffix} /> : value}
        </span>
        {hint && <span className="block text-[12px] text-parch-500">{hint}</span>}
      </div>
    </div>
  )
}

/** A tappable card that leads somewhere (the prototype's quick actions). */
export function ActionCard({
  href,
  title,
  description,
  icon,
  accent = '#6F1D1B',
}: {
  href: string
  title: string
  description: string
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <Link
      href={href}
      className="portal-hover-lift group flex items-center gap-4 rounded-[16px] border border-parch-200 bg-parch-50 p-[18px] shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(74,59,50,.1)]"
    >
      <IconTile accent={accent}>{icon}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-parch-900">{title}</span>
        <span className="block truncate text-[12px] text-parch-500">{description}</span>
      </span>
      <span aria-hidden className="text-parch-400 transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  )
}

/** A class tile for the classes grid (.cls-card). */
export function ClassCard({
  href,
  name,
  accent,
  icon,
  photo,
  note,
  rows,
  actions,
}: {
  href?: string
  name: string
  accent: string
  icon: React.ReactNode
  /**
   * F0153 — the class's own photo, when it has one. Without this the upload
   * control on the class page stored an image that was never drawn anywhere,
   * which is worse than not offering the control at all. The coloured tile stays
   * as the fallback, so a class with no photo looks exactly as it did.
   */
  photo?: string | null
  /**
   * F0535 / F0538 — the class's own notes line, under its name.
   *
   * The prototype showed a caption such as "Ages 9 to 11" beneath each class.
   * An admin can already write exactly that in the class's Description, and it
   * was visible only on the admin screen — so the church had the information
   * and the servants opening these cards never saw it. A caption under a class
   * name does not justify a new column on live classes; it justifies showing
   * the one that already holds it.
   */
  note?: string | null
  rows: { key: string; value: React.ReactNode }[]
  actions?: React.ReactNode
}) {
  const head = (
    <div className="flex items-center gap-3 px-4 pb-3 pt-4">
      {photo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-[10px] border border-parch-200 object-cover"
          style={{ borderLeftWidth: 3, borderLeftColor: accent }}
        />
      ) : (
        <IconTile accent={accent} size="sm" solid>
          {icon}
        </IconTile>
      )}
      <div className="min-w-0">
        <p className="truncate font-serif text-[14px] font-bold text-parch-900">{name}</p>
        {note && <p className="truncate text-[11.5px] text-parch-500">{note}</p>}
      </div>
    </div>
  )
  return (
    <div className="portal-hover-lift overflow-hidden rounded-[16px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-[3px] hover:shadow-[0_8px_20px_rgba(74,59,50,.1)]">
      {href ? <Link href={href}>{head}</Link> : head}
      <div className="px-4 pb-3.5">
        {rows.map((r) => (
          <div key={r.key} className="flex justify-between gap-2 border-t border-[#F5F2ED] py-1.5 text-[12px]">
            <span className="shrink-0 text-parch-500">{r.key}</span>
            <span className="truncate text-right font-semibold text-[#374151]">{r.value}</span>
          </div>
        ))}
        {actions && <div className="mt-3 flex gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand' | 'gold' | 'info'
}) {
  const cls = {
    neutral: 'bg-parch-100 text-parch-700',
    good: 'bg-[#DCFCE7] text-[#16A34A]',
    warn: 'bg-[#FEF3C7] text-[#D97706]',
    bad: 'bg-[#FEE2E2] text-[#DC2626]',
    info: 'bg-[#DBEAFE] text-[#2563EB]',
    brand: 'bg-brand-50 text-brand-800',
    gold: 'bg-brand-wash text-brand-gold-dark',
  }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-[10px] px-[11px] py-1 text-[12px] font-bold', cls)}>
      {children}
    </span>
  )
}

export function Callout({
  children,
  tone = 'info',
  title,
}: {
  children: React.ReactNode
  tone?: 'info' | 'good' | 'warn' | 'bad'
  title?: string
}) {
  const cls = {
    info: 'border-[#DBEAFE] bg-[#DBEAFE]/50 text-[#2563EB]',
    good: 'border-[#DCFCE7] bg-[#DCFCE7]/60 text-[#16A34A]',
    warn: 'border-[#FEF3C7] bg-[#FEF3C7]/70 text-[#D97706]',
    bad: 'border-[#FEE2E2] bg-[#FEE2E2]/60 text-[#DC2626]',
  }[tone]
  return (
    <div className={cn('rounded-[12px] border px-4 py-3 text-[12.5px]', cls)}>
      {title && <p className="mb-0.5 font-bold">{title}</p>}
      {children}
    </div>
  )
}

export function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dim = {
    sm: 'h-8 w-8 text-[10.5px]',
    md: 'h-10 w-10 text-[12px]',
    lg: 'h-16 w-16 text-[17px]',
    xl: 'h-24 w-24 text-[24px]',
  }[size]
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={cn('shrink-0 rounded-full border-2 border-brand-gold object-cover', dim)} />
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border-2 border-brand-gold bg-brand-800 font-bold text-[#E8D3A3]',
        dim,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-parch-300 bg-parch-50/70 px-4 py-10 text-center">
      <p className="font-serif text-[15px] font-bold text-parch-900">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-[12.5px] text-parch-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'good' | 'warn' | 'bad'; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const fill = { brand: '#6F1D1B', good: '#16A34A', warn: '#D97706', bad: '#DC2626' }[tone]
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-[20px] bg-[#E9E6DE] shadow-[inset_0_1px_2px_rgba(74,59,50,.07)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-[20px] transition-[width] duration-700" style={{ width: `${pct}%`, background: fill }} />
    </div>
  )
}

/**
 * A short confirmation that something was saved, shown where the control that
 * saved it was (F0506, and the pattern F0505 introduced on the feed composer).
 *
 * Deliberately NOT a floating toast. Three reasons, all learned here:
 *   - `position: fixed` inside page content is trapped by `.portal-enter`'s
 *     transform, so a real toast layer has to `createPortal` into the body;
 *   - a notice that fades on a timer has told nobody anything if they looked
 *     away, and these are confirmations a servant may need to act on;
 *   - it survives the `router.refresh()` that follows a write, because it is
 *     client state next to the button rather than a transient overlay.
 *
 * `role="status"` so a screen reader announces it without stealing focus.
 */
export function InlineNotice({
  children,
  tone = 'good',
  className,
}: {
  children: React.ReactNode
  tone?: 'good' | 'bad'
  className?: string
}) {
  return (
    <p
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cn(
        'rounded-[10px] border px-3 py-1.5 text-[12px] font-bold',
        tone === 'good'
          ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
          : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
        className,
      )}
    >
      {children}
    </p>
  )
}

/* ── Controls ─────────────────────────────────────────────────────────────── */

export function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  title,
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  className?: string
  /** Supplementary only — every caller also says the same thing in visible text. */
  title?: string
}) {
  return (
    <Link href={href} title={title} className={cn(buttonClass(variant, size), className)}>
      {children}
    </Link>
  )
}

/** primary = the prototype's burgundy→gold gradient (.btn-n); gold = .btn-g. */
export function buttonClass(
  variant: 'primary' | 'secondary' | 'danger' | 'gold' | 'ghost' = 'primary',
  size: 'sm' | 'md' = 'md',
) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-3.5 py-[7px] text-[12px]' : 'px-5 py-2.5 text-[12px]',
    variant === 'primary' &&
      'portal-hover-lift bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-white shadow-[0_4px_12px_rgba(90,31,31,.28)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(90,31,31,.35)] hover:brightness-[1.06]',
    variant === 'gold' && 'portal-hover-lift bg-brand-gold text-white shadow-[0_1px_3px_rgba(200,155,60,.3)] hover:-translate-y-px hover:bg-[#B8852A]',
    variant === 'secondary' && 'border border-parch-200 bg-parch-50 font-bold text-parch-900 hover:border-brand-gold/60 hover:bg-brand-wash',
    variant === 'ghost' && 'font-semibold text-brand-800 hover:bg-brand-wash',
    variant === 'danger' && 'border-[1.5px] border-[#DC2626] bg-transparent font-medium text-[#DC2626] hover:bg-[#DC2626] hover:text-white',
  )
}

export const inputClass =
  'w-full rounded-lg border-[1.5px] border-parch-200 bg-parch-50 px-3 py-2.5 text-[13px] text-parch-900 outline-none transition-colors placeholder:text-parch-400 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/25'

export const selectClass = inputClass
export const textareaClass = cn(inputClass, 'min-h-[5rem] leading-relaxed')
export const checkboxClass = 'h-4 w-4 rounded border-parch-300 text-brand-800 focus:ring-brand-gold/50 focus:ring-offset-0'

export function Field({
  label,
  htmlFor,
  children,
  hint,
  error,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  hint?: string
  error?: string
}) {
  return (
    <div className="mb-3.5 flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-bold text-parch-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-red-600">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-parch-500">{hint}</p>
      )}
    </div>
  )
}

/* ── Tables ───────────────────────────────────────────────────────────────── */

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-[18px] overflow-x-auto px-[18px] sm:mx-0 sm:px-0', className)}>
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  )
}

export function Th({ children, className, align = 'left', colSpan, rowSpan }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; colSpan?: number; rowSpan?: number }) {
  return (
    <th
      scope={colSpan && colSpan > 1 ? 'colgroup' : 'col'}
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        'border-b border-parch-200 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'border-b border-[#F5F2ED] px-3 py-2.5 align-middle text-parch-800 transition-colors group-hover/row:bg-brand-wash/60',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'whitespace-nowrap rounded-[10px] px-4 py-2 text-[12px] font-bold transition-all',
        active
          ? 'bg-brand-wash text-brand-800 shadow-nav-on ring-1 ring-brand-gold/50'
          : 'border border-parch-200 bg-parch-50 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
      )}
    >
      {children}
    </Link>
  )
}

export function Tabs({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap gap-2 print:hidden">{children}</div>
}
