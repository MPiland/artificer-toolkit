import { MouseEvent as ReactMouseEvent } from 'react'
import { hamburger, hamburger_wrapper, hamburger_line } from './Hamburger.css'
import clsx from 'clsx'

export const Hamburger = ({
  onClick,
  collapsed = false,
}: {
  onClick: (event: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void
  collapsed: boolean
}) => {
    
  return (
    <div className={clsx(hamburger_wrapper, { ['open']: !collapsed })} onClick={onClick} tabIndex={0} role='button'>
      <div className={hamburger}>
        <span className={hamburger_line}></span>
        <span className={hamburger_line}></span>
        <span className={hamburger_line}></span>
      </div>
    </div>
  )
}
