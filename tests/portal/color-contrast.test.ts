import { describe, it, expect } from 'vitest'
import tailwindConfig from '@/tailwind.config'

// WCAG 2.x relative luminance / contrast ratio, straight from the spec formula.
function relativeLuminance(hex: string): number {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [rl, gl, bl] = [r, g, b].map(linear)
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// components/portal/ui.tsx uses text-parch-500 as muted/hint copy — at
// 11-12.5px, normal weight — on both parch-50 and parch-100 surfaces
// throughout the portal, so the token itself must clear AA (4.5:1) on both.
const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>
const parch50 = colors.parch['50']
const parch100 = colors.parch['100']
const parch500 = colors.parch['500']

describe('portal muted-text token contrast (parch-500)', () => {
  it('clears WCAG AA (4.5:1) for normal text on the parch-50 surface', () => {
    expect(contrastRatio(parch500, parch50)).toBeGreaterThanOrEqual(4.5)
  })

  it('clears WCAG AA (4.5:1) for normal text on the parch-100 surface', () => {
    expect(contrastRatio(parch500, parch100)).toBeGreaterThanOrEqual(4.5)
  })
})
