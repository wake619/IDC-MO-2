import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PanelProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** 是否显示切角装饰 */
  corners?: boolean
  /** 是否显示扫描线 */
  scanline?: boolean
  delay?: number
}

/**
 * 通用面板容器：霓虹描边 + 切角 + 标题栏 + 入场动效
 */
export default function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  corners = true,
  scanline = false,
  delay = 0,
}: PanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={`panel ${corners ? 'corner-frame' : ''} ${scanline ? 'scanline-overlay' : ''} flex flex-col ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-cyber-500/10">
          <div className="min-w-0">
            {title && <h3 className="panel-title truncate">{title}</h3>}
            {subtitle && (
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={`flex-1 min-h-0 p-3 ${bodyClassName}`}>{children}</div>
    </motion.section>
  )
}
