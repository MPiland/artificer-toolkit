import { ReactNode } from 'react'
import { alignItems, direction, flexWrap, spacing } from './Group.css'
import clsx from 'clsx'

const Group = ({
  children,
  directionVariant = 'row',
  justifyContentVariant = 'spaceBetween',
  alignItemsVariant = 'center',
  flexWrapVariant = 'wrap',
  className,
  onClick,
}: {
  children: ReactNode
  directionVariant?: 'column' | 'row'
  justifyContentVariant?: 'spaceBetween' | 'start' | 'end' | 'center' | 'spaceAround'
  alignItemsVariant?: 'center' | 'start' | 'end'
  flexWrapVariant?: 'wrap' | 'noWrap'
  className?: any
  onClick?: () => void
}) => {
  return (
    <div
      className={clsx(
        direction[directionVariant],
        spacing[justifyContentVariant],
        alignItems[alignItemsVariant],
        flexWrap[flexWrapVariant],
        {
          [className]: className,
        }
      )}
      onClick={() => onClick && onClick()}
    >
      {children}
    </div>
  )
}

export default Group
