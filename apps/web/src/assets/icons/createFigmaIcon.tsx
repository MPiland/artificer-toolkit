import type { ReactNode } from 'react'

export type FigmaIconProps = {
  className?: string
  size?: number
}

type CreateFigmaIconOptions = {
  name: string
  slot: { x: number, y: number, width: number, height: number, viewBox: string }
  content: ReactNode
}

export const createFigmaIcon = ({ name, content }: CreateFigmaIconOptions) => {
  const FigmaIcon = ({ className, size = 24 }: FigmaIconProps) => (
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
      {content}
    </svg>
  )

  FigmaIcon.displayName = name

  return FigmaIcon
}
