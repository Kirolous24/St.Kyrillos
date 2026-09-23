/**
 * The dashboard's own skeleton (F0087). It is the heaviest page in the portal
 * — five aggregates, a chart and seven widgets — and was the only one that
 * showed nothing at all while it loaded.
 *
 * It lives in a `(home)` route group rather than at `app/portal/(app)/` on
 * purpose. A `loading.tsx` covers its segment **and every child route**, so
 * one placed on `(app)` would put a Suspense boundary above `students/[id]`,
 * `classes/[id]` and every other page that calls notFound() — and a boundary
 * above a 404 makes Next flush a 200 first, which would turn every permission
 * refusal in the portal into a blank success. The group scopes it to this page
 * alone; `(home)` adds nothing to the URL, so the dashboard is still /portal.
 *
 * Shaped like what arrives — hero, five stat tiles, the quick-action row, then
 * the two-column body — so the page settles into place instead of jumping.
 */
export default function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>

      <div className="mb-5 h-[124px] rounded-[14px] bg-brand-950/90" />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-5 shadow-panel"
          >
            <div className="portal-sk h-[52px] w-[52px] rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <div className="portal-sk mb-2 h-[9px] w-[60%] rounded" />
              <div className="portal-sk h-[22px] w-[40%] rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-[14px] border border-parch-200 bg-parch-50 p-[18px] shadow-card"
          >
            <div className="portal-sk h-[46px] w-[46px] shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <div className="portal-sk mb-2 h-[11px] w-[55%] rounded" />
              <div className="portal-sk h-[10px] w-[80%] rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[16px] border border-parch-200 bg-parch-50 p-[18px] shadow-card">
                <div className="portal-sk mb-3 h-[34px] w-[34px] rounded-[10px]" />
                <div className="portal-sk mb-2 h-[13px] w-[70%] rounded" />
                <div className="portal-sk mb-1.5 h-[10px] w-full rounded" />
                <div className="portal-sk h-[10px] w-[60%] rounded" />
              </div>
            ))}
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-[18px] shadow-card"
            >
              <div className="portal-sk mb-3 h-[11px] w-[30%] rounded" />
              <div className="portal-sk h-[140px] w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-[18px] shadow-card"
            >
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
