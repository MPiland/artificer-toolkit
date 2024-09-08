import { AllHTMLAttributes, ElementType, ReactNode, Ref } from 'react'
import type { Sprinkles } from '../../css/sprinkles.css'
import { ClassValue } from 'clsx'

export interface BoxProps
  extends Omit<AllHTMLAttributes<HTMLElement>, 'as' | 'width' | 'height' | 'color' | 'className'>,
    Sprinkles {
  children?: ReactNode
  as?: ElementType
  className?: ClassValue
  ref?: Ref<HTMLElement>
}

const Box = ({ as: Element = 'div', className, ref, ...props }: BoxProps) => {
  const nativeProps: Record<string, unknown> = {}

  for (const key in props) {
    nativeProps[key] = props[key as keyof typeof props]
  }

  return <Element ref={ref} className={className} {...nativeProps} />
}

export default Box
