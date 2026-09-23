'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
} from 'chart.js'

// Only what the portal's charts actually draw. Chart.js v4 registers nothing
// by default, so this is the whole cost — the `auto` entry point would pull in
// every controller, scale and plugin including ones nothing here uses.
// `Filler` is required, not optional: the line charts use `fill: true`.
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
)

export interface ChartPoint {
  label: string
  value: number | null
}

/**
 * The portal's charts, in the prototype's colours.
 *
 * Two things this component exists to get right:
 *
 * 1. **It prints.** A `<canvas>` inside the `hidden print:block` idiom this app
 *    uses everywhere lays out 0×0 and prints an empty rectangle — and this
 *    portal prints a great deal. So the canvas is `print:hidden` and a plain
 *    table carrying the same numbers takes its place on paper. The chart is
 *    never the only copy of the data.
 * 2. **It says what it is measuring.** Attendance can mean "who was in the
 *    room" or a scored rate that drops excused absences, and the two disagree.
 *    Every chart states its own question in `caption` rather than leaving a
 *    reader to assume.
 */
export function PortalChart({
  kind,
  points,
  label,
  caption,
  colour = '#6F1D1B',
  suffix = '',
  maxY,
  height = 190,
}: {
  kind: 'line' | 'bar'
  points: ChartPoint[]
  /** Dataset name, used in the tooltip. */
  label: string
  /** The question this chart answers, shown under it and on the printed table. */
  caption: string
  colour?: string
  /** Appended to every tick and tooltip value, e.g. '%'. */
  suffix?: string
  /** Pin the axis, e.g. 100 for a percentage. Omit to autoscale. */
  maxY?: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    // Someone who asked for less motion gets none of it, matching globals.css.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    chartRef.current = new Chart(el, {
      type: kind,
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label,
            data: points.map((p) => p.value),
            borderColor: colour,
            backgroundColor: kind === 'line' ? `${colour}1A` : colour,
            fill: kind === 'line',
            tension: 0.35,
            borderWidth: kind === 'line' ? 2 : 0,
            pointRadius: kind === 'line' ? 3 : 0,
            pointBackgroundColor: colour,
            borderRadius: kind === 'bar' ? 6 : undefined,
            maxBarThickness: 34,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: still ? false : { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y}${suffix} ${label.toLowerCase()}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            beginAtZero: true,
            ...(maxY === undefined ? {} : { max: maxY }),
            grid: { color: '#F0EEE8' },
            ticks: {
              font: { size: 10 },
              precision: suffix === '' ? 0 : undefined,
              callback: (v) => `${v}${suffix}`,
            },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [kind, points, label, colour, suffix, maxY])

  return (
    <>
      <div style={{ height }} className="print:hidden">
        <canvas ref={canvasRef} role="img" aria-label={`${label}. ${caption}`} />
      </div>
      <p className="mt-2 text-[11px] text-parch-500 print:hidden">{caption}</p>

      {/* The printed copy. A canvas cannot print from inside a hidden block, so
          the numbers go on paper as a table instead of a blank rectangle. */}
      <table className="hidden w-full text-[10.5px] print:table">
        <caption className="pb-1 text-left text-[11px] font-bold text-parch-700">
          {label} — {caption}
        </caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label} className="border-b border-parch-200">
              <td className="py-0.5">{p.label}</td>
              <td className="py-0.5 text-right tabular-nums">
                {p.value === null ? '—' : `${p.value}${suffix}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
