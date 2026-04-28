import { Minus } from 'lucide-react'
import type { FigmaIconProps } from './createFigmaIcon'

export function IMinus({ className, size = 24 }: FigmaIconProps) {
  return (
    <Minus
      aria-hidden='true'
      className={className}
      data-icon='IMinus'
      size={size}
      strokeWidth={2}
    />
  )
}
