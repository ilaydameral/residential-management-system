import { useCallback, useEffect, useRef, type ReactNode } from 'react'

interface Point {
  x: number
  y: number
}

interface Ripple {
  x: number
  y: number
  radius: number
  opacity: number
  born: number
}

const CELL_SIZE = 52
const INFLUENCE_RADIUS = 240
const MAX_WARP = 22
const DOT_SPACING = 30
const LERP_SPEED = 0.08

const LINE_BASE = { r: 255, g: 255, b: 255, a: 0.07 }
const NODE_BASE_RADIUS = 1.6
const NODE_ACTIVE_RADIUS = 3.0

function lerpN(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpColor(
  base: { r: number; g: number; b: number; a: number },
  active: { r: number; g: number; b: number; a: number },
  t: number,
): string {
  const r = Math.round(lerpN(base.r, active.r, t))
  const g = Math.round(lerpN(base.g, active.g, t))
  const b = Math.round(lerpN(base.b, active.b, t))
  const a = lerpN(base.a, active.a, t)
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

interface KineticGridProps {
  children?: ReactNode
  className?: string
}

export function KineticGrid({ children, className = '' }: KineticGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<Point>({ x: -9999, y: -9999 })
  const targetMouseRef = useRef<Point>({ x: -9999, y: -9999 })
  const ripplesRef = useRef<Ripple[]>([])
  const rafRef = useRef<number>(0)
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  const getWarpedPoint = useCallback(
    (
      gx: number,
      gy: number,
      col: number,
      row: number,
      mouse: Point,
      ripples: Ripple[],
      cols: number,
      rows: number,
    ): { pt: Point; proximity: number } => {
      const edgeMargin = 1.5
      const colPin = Math.min(col / edgeMargin, (cols - 1 - col) / edgeMargin, 1)
      const rowPin = Math.min(row / edgeMargin, (rows - 1 - row) / edgeMargin, 1)
      const pinFactor = colPin * colPin * rowPin * rowPin

      const dx = gx - mouse.x
      const dy = gy - mouse.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const proximity = Math.max(0, 1 - dist / INFLUENCE_RADIUS) * pinFactor

      let rx = 0
      let ry = 0
      for (const r of ripples) {
        const rdx = gx - r.x
        const rdy = gy - r.y
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
        const waveWidth = 50
        const diff = rdist - r.radius
        if (Math.abs(diff) < waveWidth) {
          const strength = (1 - Math.abs(diff) / waveWidth) * r.opacity * 14 * pinFactor
          const angle = Math.atan2(rdy, rdx)
          const sign = diff < 0 ? -1 : 1
          rx += Math.cos(angle) * strength * sign * -1
          ry += Math.sin(angle) * strength * sign * -1
        }
      }

      if (dist < INFLUENCE_RADIUS && dist > 0 && pinFactor > 0) {
        const t = dist / INFLUENCE_RADIUS
        const eased = t < 0.01 ? 0 : (1 - t) * (1 - t) * Math.min(1, dist / 60)
        const warpAmt = eased * MAX_WARP * pinFactor
        const angle = Math.atan2(dy, dx)
        return {
          pt: {
            x: gx - Math.cos(angle) * warpAmt + rx,
            y: gy - Math.sin(angle) * warpAmt + ry,
          },
          proximity,
        }
      }

      return { pt: { x: gx + rx, y: gy + ry }, proximity }
    },
    [],
  )

  const draw = useCallback(
    (now: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { w: W, h: H } = sizeRef.current
      if (W <= 0 || H <= 0) return

      const mouse = mouseRef.current
      const ripples = ripplesRef.current

      const theme = {
        bg: '#0b0f19',
        lineActive: { r: 37, g: 99, b: 235, a: 0.75 },
        nodeActive: { r: 59, g: 130, b: 246, a: 0.95 },
        glow: '37,99,235',
        ripple: '59,130,246',
      }

      ctx.clearRect(0, 0, W, H)

      // Dark Navy Background
      ctx.fillStyle = theme.bg
      ctx.fillRect(0, 0, W, H)

      // Ambient gradient
      const bgGrd = ctx.createRadialGradient(W * 0.3, H * 0.4, 60, W * 0.3, H * 0.4, Math.max(W, H) * 0.8)
      bgGrd.addColorStop(0, 'rgba(30, 58, 138, 0.18)')
      bgGrd.addColorStop(0.6, 'rgba(15, 23, 42, 0.06)')
      bgGrd.addColorStop(1, 'rgba(11, 15, 25, 0)')
      ctx.fillStyle = bgGrd
      ctx.fillRect(0, 0, W, H)

      // Background dot texture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
      for (let x = DOT_SPACING / 2; x < W; x += DOT_SPACING) {
        for (let y = DOT_SPACING / 2; y < H; y += DOT_SPACING) {
          ctx.beginPath()
          ctx.arc(x, y, 0.65, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Update ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        const age = (now - r.born) / 1000
        r.radius = Math.max(0, age * 360)
        r.opacity = Math.max(0, 1 - age * 1.1)
        if (r.opacity <= 0) ripples.splice(i, 1)
      }

      // Grid points
      const cols = Math.max(2, Math.ceil(W / CELL_SIZE)) + 1
      const rows = Math.max(2, Math.ceil(H / CELL_SIZE)) + 1
      const cellW = W / (cols - 1)
      const cellH = H / (rows - 1)

      const pts: Point[][] = []
      const prox: number[][] = []

      for (let row = 0; row < rows; row++) {
        pts[row] = []
        prox[row] = []
        for (let col = 0; col < cols; col++) {
          const { pt, proximity } = getWarpedPoint(
            col * cellW,
            row * cellH,
            col,
            row,
            mouse,
            ripples,
            cols,
            rows,
          )
          pts[row][col] = pt
          prox[row][col] = proximity
        }
      }

      // Grid lines
      const drawSeg = (p1: Point, p2: Point, pr1: number, pr2: number) => {
        const avg = (pr1 + pr2) / 2
        const t = avg * avg * (3 - 2 * avg)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = lerpColor(LINE_BASE, theme.lineActive, t)
        ctx.lineWidth = lerpN(0.75, 1.35, t)
        ctx.stroke()
      }

      ctx.lineCap = 'round'

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols - 1; col++) {
          drawSeg(pts[row][col], pts[row][col + 1], prox[row][col], prox[row][col + 1])
        }
      }

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows - 1; row++) {
          drawSeg(pts[row][col], pts[row + 1][col], prox[row][col], prox[row + 1][col])
        }
      }

      // Intersection nodes
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = pts[row][col]
          const pr = prox[row][col]
          const t = pr * pr * (3 - 2 * pr)
          const r = lerpN(NODE_BASE_RADIUS, NODE_ACTIVE_RADIUS, t)

          if (t > 0.25) {
            const glowR = r + lerpN(0, 5, (t - 0.25) / 0.75)
            const grd = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, glowR)
            grd.addColorStop(0, `rgba(${theme.glow}, ${(t * 0.25).toFixed(3)})`)
            grd.addColorStop(1, `rgba(${theme.glow}, 0)`)
            ctx.beginPath()
            ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
            ctx.fillStyle = grd
            ctx.fill()
          }

          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fillStyle = lerpColor({ r: 255, g: 255, b: 255, a: 0.15 }, theme.nodeActive, t)
          ctx.fill()
        }
      }

      // Ripple rings
      for (const r of ripples) {
        const safeRadius = Math.max(0, r.radius)
        ctx.beginPath()
        ctx.arc(r.x, r.y, safeRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${theme.ripple}, ${(r.opacity * 0.2).toFixed(3)})`
        ctx.lineWidth = 1.25
        ctx.stroke()
      }
    },
    [getWarpedPoint],
  )

  const animate = useCallback(
    (now: number) => {
      const m = mouseRef.current
      const t = targetMouseRef.current
      m.x = lerpN(m.x, t.x, LERP_SPEED)
      m.y = lerpN(m.y, t.y, LERP_SPEED)

      draw(now)
      rafRef.current = requestAnimationFrame(animate)
    },
    [draw],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setSize = () => {
      if (!container || !canvas) return
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      canvas.width = w
      canvas.height = h
      sizeRef.current = { w, h }
      if (mouseRef.current.x === -9999) {
        mouseRef.current = { x: -9999, y: -9999 }
        targetMouseRef.current = { x: -9999, y: -9999 }
      }
      if (prefersReducedMotion) {
        draw(performance.now())
      }
    }

    setSize()
    window.addEventListener('resize', setSize)

    if (prefersReducedMotion) {
      draw(performance.now())
      return () => {
        window.removeEventListener('resize', setSize)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        targetMouseRef.current = { x, y }
      } else {
        targetMouseRef.current = { x: -9999, y: -9999 }
      }
    }

    const onMouseLeave = () => {
      targetMouseRef.current = { x: -9999, y: -9999 }
    }

    const onClick = (e: MouseEvent) => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        ripplesRef.current.push({
          x,
          y,
          radius: 0,
          opacity: 1,
          born: performance.now(),
        })
      }
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    container.addEventListener('click', onClick)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', setSize)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      container.removeEventListener('click', onClick)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [animate, draw])

  return (
    <div ref={containerRef} className={`kinetic-grid-container ${className}`}>
      <canvas ref={canvasRef} className="kinetic-grid-canvas" />
      <div className="kinetic-grid-content">{children}</div>
    </div>
  )
}
