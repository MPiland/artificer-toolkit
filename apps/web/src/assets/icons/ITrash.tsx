import { Trash2 } from 'lucide-react'
import type { FigmaIconProps } from './createFigmaIcon'

const ITrash = ({ className, size = 24 }: FigmaIconProps) => (
  <Trash2
    aria-hidden='true'
    className={className}
    data-icon='ITrash'
    size={size}
    strokeWidth={2}
  />
)

ITrash.displayName = 'ITrash'

export default ITrash
