import * as React from 'react'
import { createPortal } from 'react-dom'

interface PortalProps {
  children: React.ReactNode
  container?: Element | null
}

export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = React.useState(false)
  const target = container ?? (typeof document !== 'undefined' ? document.body : null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !target) return null
  return createPortal(children, target)
}
