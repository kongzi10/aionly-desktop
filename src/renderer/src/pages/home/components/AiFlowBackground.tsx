import { useTheme } from '@renderer/context/ThemeProvider'
import { ThemeMode } from '@renderer/types'
import type { FC } from 'react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

interface FlowPalette {
  ribbonHues: [string, string, string]
  ribbonAlphaBase: number
  ribbonAlphaStep: number
  linkRgb: string
  linkAlpha: number
  particleMintRgb: string
  particleBlueRgb: string
  glowRgb: string
  glowAlpha: number
  orbitalRgb: string
  orbitalAlphaBase: number
  orbitalAlphaStep: number
}

interface Particle {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  tint: number
  alpha: number
}

interface Ribbon {
  offset: number
  phase: number
  amp: number
  speed: number
}

const LIGHT_PALETTE: FlowPalette = {
  ribbonHues: ['105,205,197', '104,145,232', '169,194,239'],
  ribbonAlphaBase: 0.035,
  ribbonAlphaStep: 0.012,
  linkRgb: '106,145,201',
  linkAlpha: 0.13,
  particleMintRgb: '91,197,190',
  particleBlueRgb: '101,137,202',
  glowRgb: '110,190,207',
  glowAlpha: 0.055,
  orbitalRgb: '120,157,207',
  orbitalAlphaBase: 0.055,
  orbitalAlphaStep: 0.012
}

const DARK_PALETTE: FlowPalette = {
  ribbonHues: ['72,226,211', '91,139,255', '135,174,255'],
  ribbonAlphaBase: 0.055,
  ribbonAlphaStep: 0.018,
  linkRgb: '100,154,235',
  linkAlpha: 0.22,
  particleMintRgb: '83,231,211',
  particleBlueRgb: '112,157,255',
  glowRgb: '83,220,221',
  glowAlpha: 0.09,
  orbitalRgb: '100,158,229',
  orbitalAlphaBase: 0.075,
  orbitalAlphaStep: 0.016
}

const LIGHT_BACKGROUND = `
  radial-gradient(ellipse at 50% 110%, rgba(177, 211, 255, 0.34), transparent 54%),
  radial-gradient(ellipse at 8% 18%, rgba(207, 232, 255, 0.56), transparent 34%),
  radial-gradient(ellipse at 92% 22%, rgba(210, 247, 241, 0.52), transparent 30%),
  #f7f9fc
`

const DARK_BACKGROUND = `
  radial-gradient(ellipse at 50% 110%, rgba(37, 75, 145, 0.28), transparent 55%),
  radial-gradient(ellipse at 8% 18%, rgba(27, 64, 125, 0.24), transparent 36%),
  radial-gradient(ellipse at 92% 22%, rgba(16, 105, 105, 0.19), transparent 32%),
  linear-gradient(135deg, #080d18 0%, #0b1222 52%, #07131b 100%)
`

/**
 * Decorative animated backdrop for the home landing page.
 * Renders drifting particles, flowing ribbons and orbital loops on a canvas,
 * and swaps between the light and dark palettes following the active theme.
 */
const AiFlowBackground: FC = () => {
  const { theme } = useTheme()
  const isDark = theme === ThemeMode.dark

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paletteRef = useRef<FlowPalette>(isDark ? DARK_PALETTE : LIGHT_PALETTE)
  const renderRef = useRef<(() => void) | null>(null)

  // Keep the palette in sync with the theme without restarting the animation loop.
  useEffect(() => {
    paletteRef.current = isDark ? DARK_PALETTE : LIGHT_PALETTE
    renderRef.current?.()
  }, [isDark])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let time = 0
    let frame = 0
    let particles: Particle[] = []
    let ribbons: Ribbon[] = []
    let rect = wrapper.getBoundingClientRect()
    const pointer = { x: -9999, y: -9999, active: false }
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const curveY = (x: number, ribbon: Ribbon, tt: number) => {
      const base = height * (0.53 + (ribbon.offset - 4.5) * 0.032)
      return (
        base +
        Math.sin(x * 0.0042 + tt * ribbon.speed * 900 + ribbon.phase) * ribbon.amp +
        Math.sin(x * 0.009 + tt * ribbon.speed * 550 + ribbon.phase * 1.7) * ribbon.amp * 0.28
      )
    }

    const seed = () => {
      const count = Math.max(70, Math.min(170, Math.floor((width * height) / 9500)))
      particles = []
      for (let i = 0; i < count; i++) {
        particles.push({
          x: rand(-30, width + 30),
          y: rand(-20, height + 20),
          r: rand(0.7, 2.1),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.12, 0.55),
          tint: Math.random(),
          alpha: rand(0.18, 0.62)
        })
      }
      ribbons = []
      for (let i = 0; i < 10; i++) {
        ribbons.push({ offset: i, phase: rand(0, Math.PI * 2), amp: rand(24, 70), speed: rand(0.00012, 0.0003) })
      }
    }

    const renderFrame = () => {
      const palette = paletteRef.current
      ctx.clearRect(0, 0, width, height)

      // Broad, low-opacity light currents.
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ribbons.forEach((ribbon, i) => {
        ctx.beginPath()
        for (let x = -20; x <= width + 20; x += 7) {
          const y = curveY(x, ribbon, time)
          if (x === -20) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const hue = palette.ribbonHues[i % 3]
        ctx.strokeStyle = `rgba(${hue},${palette.ribbonAlphaBase + (i % 4) * palette.ribbonAlphaStep})`
        ctx.lineWidth = i % 4 === 0 ? 1.1 : 0.65
        ctx.stroke()
      })
      ctx.restore()

      // Drifting particles and their nearest-neighbour links.
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += Math.sin(time * 0.00045 + p.phase) * 0.22 * p.speed
        p.y += Math.cos(time * 0.00038 + p.phase) * 0.18 * p.speed
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (pointer.active && dist < 145) {
          p.x += (dx / (dist || 1)) * -0.45
          p.y += (dy / (dist || 1)) * -0.45
        }
        if (p.x < -35) p.x = width + 35
        if (p.x > width + 35) p.x = -35
        if (p.y < -35) p.y = height + 35
        if (p.y > height + 35) p.y = -35

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const ddx = p.x - q.x
          const ddy = p.y - q.y
          const d2 = ddx * ddx + ddy * ddy
          if (d2 < 105 * 105) {
            const alpha = (1 - Math.sqrt(d2) / 105) * palette.linkAlpha
            ctx.strokeStyle = `rgba(${palette.linkRgb},${alpha})`
            ctx.lineWidth = 0.65
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }

        const glow = pointer.active && dist < 145 ? (1 - dist / 145) * 0.8 : 0
        const particleRgb = p.tint > 0.7 ? palette.particleMintRgb : palette.particleBlueRgb
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + glow * 1.1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${particleRgb},${p.alpha + glow})`
        ctx.fill()
        if (glow > 0.15) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 5 + glow * 6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${palette.glowRgb},${glow * palette.glowAlpha})`
          ctx.fill()
        }
      }

      // Soft orbital loops drifting behind the title.
      const cx = width * 0.5
      const cy = height * 0.52
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        const rx = Math.min(width * 0.37, 440) + k * 23
        const ry = Math.min(height * 0.17, 130) + k * 13
        for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.025) {
          const wobble = 1 + Math.sin(a * 3 + time * 0.0003 + k) * 0.025
          const x = cx + Math.cos(a + time * 0.00008 * (k + 1)) * rx * wobble
          const y = cy + Math.sin(a + time * 0.00008 * (k + 1)) * ry * wobble
          if (a === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${palette.orbitalRgb},${palette.orbitalAlphaBase - k * palette.orbitalAlphaStep})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    const updateRect = () => {
      rect = wrapper.getBoundingClientRect()
    }

    const resize = () => {
      updateRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      renderFrame()
    }

    const loop = () => {
      renderFrame()
      time += 16
      frame = requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = true
    }
    const onPointerLeave = () => {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    renderRef.current = renderFrame
    resize()

    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduceMotion) {
      frame = requestAnimationFrame(loop)
    }

    const observer = new ResizeObserver(() => resize())
    observer.observe(wrapper)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('scroll', updateRect, true)
    document.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('blur', onPointerLeave)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', updateRect, true)
      document.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('blur', onPointerLeave)
      renderRef.current = null
    }
  }, [])

  return (
    <Wrapper ref={wrapperRef} $dark={isDark} aria-hidden="true">
      <Scene ref={canvasRef} />
      <Grain $dark={isDark} />
    </Wrapper>
  )
}

const Wrapper = styled.div<{ $dark: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: ${({ $dark }) => ($dark ? DARK_BACKGROUND : LIGHT_BACKGROUND)};
`

const Scene = styled.canvas`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
`

const Grain = styled.div<{ $dark: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: ${({ $dark }) => ($dark ? 0.09 : 0.17)};
  mix-blend-mode: ${({ $dark }) => ($dark ? 'screen' : 'multiply')};
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.14'/%3E%3C/svg%3E");
`

export default AiFlowBackground
