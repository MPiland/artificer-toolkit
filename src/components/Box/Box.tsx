import { AllHTMLAttributes, CSSProperties, ElementType, ReactNode, forwardRef } from 'react'
import type { Sprinkles } from '../../css/sprinkles.css'
import { ClassValue } from 'clsx'

export interface BoxProps
  extends Omit<AllHTMLAttributes<HTMLElement>, 'as' | 'width' | 'height' | 'color' | 'className'>,
    Sprinkles {
  children?: ReactNode
  as?: ElementType
  className?: ClassValue
  style?: CSSProperties
}

const Box = forwardRef<HTMLElement, BoxProps>(function Box({ as: Element = 'div', className, style, ...props }, ref) {
  const nativeProps: Record<string, unknown> = {}

  for (const key in props) {
    nativeProps[key] = props[key as keyof typeof props]
  }

  // Attach the ref to the rendered element
  return <Element ref={ref} className={className} style={style} {...nativeProps} />
})

export default Box
