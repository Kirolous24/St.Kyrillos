/**
 * Painted the instant a portal link is clicked, while the server renders the
 * real page. Mirrors the prototype's `.sk` shimmer so the wait reads as the
 * page arriving rather than the app hanging.
 *
 * Mounted through a per-segment `loading.tsx`, and ONLY on segments that can
 * never call notFound(). A Suspense boundary makes Next flush a 200 before the
 * page component runs, so a boundary above a page that 404s turns that 404
 * into a 200 — which once masked a permission regression. Segments with a
 * dynamic `[id]` child therefore deliberately have no skeleton.
 */
export default function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* page header banner */}
      <div className="mb-5 h-[96px] rounded-[14px] bg-brand-950/90" />

      {/* stat row */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-5 shadow-panel">
            <div className="portal-sk h-[52px] w-[52px] rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <div className="portal-sk mb-2 h-[9px] w-[60%] rounded" />
              <div className="portal-sk h-[22px] w-[40%] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* body */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3.5 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-[18px] shadow-card">
              <div className="portal-sk mb-3 h-[11px] w-[30%] rounded" />
              {[0, 1, 2].map((r) => (
                <div key={r} className="flex items-center gap-3 border-b border-[#F5F2ED] py-3 last:border-b-0">
                  <div className="portal-sk h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="portal-sk mb-1.5 h-[11px] w-[72%] rounded" />
                    <div className="portal-sk h-[11px] w-[30%] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-[18px] shadow-card">
              <div className="portal-sk mb-3 h-[11px] w-[45%] rounded" />
              <div className="portal-sk mb-2 h-[11px] w-full rounded" />
              <div className="portal-sk mb-2 h-[11px] w-[80%] rounded" />
              <div className="portal-sk h-[11px] w-[55%] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
