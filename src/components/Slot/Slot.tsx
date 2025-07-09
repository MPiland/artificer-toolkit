import {
  cloneElement,
  isValidElement,
  Children,
  type ReactElement,
  type ReactNode,
  type HTMLAttributes,
  type RefAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react'

type SlotProps = {
  children: ReactNode
} & HTMLAttributes<HTMLElement> &
  RefAttributes<HTMLElement>

const Slot = ({ children, ...props }: SlotProps) => {
  const child = Children.only(children)

  if (isValidElement(child)) {
    const childProps = child.props as { [key: string]: unknown }
    return cloneElement(child as ReactElement, {
      // Spread child props first
      ...childProps,

      // Merge class names manually
      className: [props.className, childProps && childProps.className].filter(Boolean).join(' '),

      // Merge event handlers
      onClick: (e: ReactMouseEvent<HTMLElement, MouseEvent>) => {
        props.onClick?.(e)
        if (typeof childProps.onClick === 'function') {
          childProps.onClick(e)
        }
      },

      // Spread remaining new props (like data-attributes)
      ...props,
    })
  }

  return <>{children}</>
}

export default Slot
