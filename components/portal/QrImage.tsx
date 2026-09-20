import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

/**
 * Server-rendered QR codes. `qrcode` produces an SVG string, which we hand to
 * an <img> as a data URL: no canvas build, no client bundle, and nothing goes
 * through dangerouslySetInnerHTML.
 *
 * Styled like the prototype's QR canvases: radius 14 on cream, with the soft
 * warm drop shadow it uses under every code it shows.
 */

const INK = '#4A1212' // brand-950
const PAPER = '#FFFDF8' // parch-50

export async function qrSvgDataUrl(value: string, margin = 1): Promise<string> {
  const svg = await QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin,
    color: { dark: INK, light: PAPER },
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function QrImage({
  value,
  size = 220,
  alt = '',
  className,
}: {
  value: string
  size?: number
  alt?: string
  className?: string
}) {
  const src = await qrSvgDataUrl(value)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn('rounded-[14px] bg-parch-50 shadow-[0_4px_16px_rgba(74,59,50,.09)]', className)}
    />
  )
}
