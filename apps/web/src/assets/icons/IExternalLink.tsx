import { ExternalLink } from 'lucide-react'
import type { SvgIconProps } from './createSvgIcon'

export function IExternalLink({ className, size = 24 }: SvgIconProps) {
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
