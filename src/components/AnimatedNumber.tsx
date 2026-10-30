import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  decimals?: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}

/**
 * 数字滚动动效组件：值变化时平滑过渡
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 600,
  className = '',
  prefix = '',
  suffix = '',
}: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const start = performance.now()

    const tickFn = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = from + (to - from) * eased
      setDisplay(cur)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tickFn)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tickFn)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
