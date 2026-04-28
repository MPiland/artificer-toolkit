import { ExternalLink } from 'lucide-react'
import type { FigmaIconProps } from './createFigmaIcon'

export function IExternalLink({ className, size = 24 }: FigmaIconProps) {
  return (
    <ExternalLink
      aria-hidden='true'
      className={className}
      data-icon='IExternalLink'
      size={size}
      strokeWidth={2}
    />
  )
}
