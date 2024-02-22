import { FC, ReactNode } from 'react'
import { alignItems, direction, flexWrap, spacing } from './Group.css'
import clsx from 'clsx'

interface GroupProps {
  children: ReactNode
  directionVariant?: 'column' | 'row'
  justifyContentVariant?: 'spaceBetween' | 'start' | 'end' | 'center'
  alignItemsVariant?: 'center' | 'start' | 'end'
  flexWrapVariant?: 'wrap' | 'nowrap'
  className?: any
  onClick?: () => void
}

const Group: FC<GroupProps> = ({
  children,
  directionVariant = 'row',
  justifyContentVariant = 'spaceBetween',
  alignItemsVariant = 'center',
  flexWrapVariant = 'wrap',
  className,
  onClick,
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
