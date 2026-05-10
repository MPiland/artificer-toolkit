import type { ReactNode } from 'react'

export type SvgIconProps = {
  className?: string
  size?: number
}

type CreateSvgIconOptions = {
  name: string
  slot: { x: number, y: number, width: number, height: number, viewBox: string }
  content: ReactNode
}

export const createSvgIcon = ({ name, content, slot }: CreateSvgIconOptions) => {
  const SvgIcon = ({ className, size = 24 }: SvgIconProps) => (
    <svg
      aria-hidden='true'
      className={className}
      data-icon={name}
      width={size}
      height={size}
      viewBox='0 0 48 48'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <svg
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        viewBox={slot.viewBox}
        fill='none'
        preserveAspectRatio='none'
      >
        {content}
      </svg>
    </svg>
  )

  SvgIcon.displayName = name

  return SvgIcon
}
