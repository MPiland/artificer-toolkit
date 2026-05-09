import { Minus } from 'lucide-react'
import type { SvgIconProps } from './createSvgIcon'

export function IMinus({ className, size = 24 }: SvgIconProps) {
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
