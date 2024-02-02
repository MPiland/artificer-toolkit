import { FC, ReactNode } from 'react'
import { alignItems, direction, spacing } from './Group.css'
import clsx from 'clsx'

interface GroupProps {
  children: ReactNode
  directionVariant?: 'column' | 'row'
  spaceVariant?: 'spaceBetween' | 'start' | 'end' | 'center'
  alignItemsVariant?: 'center' | 'start' | 'end'
  className?: any
  onClick?: () => void
}

const Group: FC<GroupProps> = ({
  children,
  directionVariant = 'row',
  spaceVariant = 'spaceBetween',
  alignItemsVariant = 'center',
  className,
  onClick,
}) => {
  return (
    <div
      className={clsx(
        direction[`${directionVariant}`],
        spacing[`${spaceVariant}`],
        alignItems[`${alignItemsVariant}`],
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
