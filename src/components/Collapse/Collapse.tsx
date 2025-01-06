import { TbCaretDown, TbCaretUp, TbSquareMinus, TbSquarePlus } from 'react-icons/tb'
import { useState, ReactNode, useRef, useEffect } from 'react'
import {
  collapse_header,
  collapse_body,
  collapse_wrapper,
  collapse_header_icon,
  collapse_content,
  collapse_header_left,
  collapse_header_right,
  collapse_header_group,
} from './Collapse.css'
import clsx from 'clsx'
import Group from '../Group/Group'

const Header = ({
  startOpened,
  title,
  className,
  leftSide,
  rightSide,
  children,
}: {
  title?: string
  className?: string | number | symbol | any
  handleRemove?: () => void
  leftSide?: ReactNode
  rightSide?: ReactNode
  startOpened?: boolean
  children?: ReactNode
}) => {
  const headerRef = useRef<HTMLDivElement>(null)

  const [borderless, setBorderless] = useState<boolean>(false)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true)

  useEffect(() => {
    if (startOpened) {
      setIsCollapsed(false)
    } else {
      setIsCollapsed(true)
    }
  }, [startOpened])

  useEffect(() => {
    const header = headerRef.current
    if (header) {
      const parent = header.parentElement

      if (parent) {
        const parentBorderless = parent.classList.contains('borderless')
        const parentCollapsed = parent.classList.contains('collapsed')

        if (parentBorderless) {
          setBorderless(true)
        } else if (borderless) {
          setBorderless(false)
        }

        if ((parentCollapsed && !isCollapsed) || (!parentCollapsed && isCollapsed)) {
          parent.classList.toggle('collapsed')
        }
      }
    }
  }, [borderless, isCollapsed])

  const handleClick = () => {
    setIsCollapsed((prev: any) => !prev)
  }

  return (
    <div className={clsx(collapse_header, { [className]: className })} onClick={handleClick} ref={headerRef}>
      <Group className={collapse_header_group}>
        {leftSide && <span className={collapse_header_left}>{leftSide}</span>}
        <h3>{title}</h3>
        {rightSide && <span className={collapse_header_right}>{rightSide}</span>}
      </Group>
      <Group alignItemsVariant='end' className={collapse_header_group}>
        {children}
        {!borderless ? (
          <span className={collapse_header_icon}>{isCollapsed ? <TbSquarePlus /> : <TbSquareMinus />}</span>
        ) : (
          <span className={collapse_header_icon}>{isCollapsed ? <TbCaretDown /> : <TbCaretUp />}</span>
        )}
      </Group>
    </div>
  )
}

const Body = ({ children, className }: { children?: ReactNode; className?: string | number | symbol | any }) => {
  return (
    <div className={clsx(collapse_body)}>
      <div className={clsx(collapse_content, { [className]: className })}>{children}</div>
    </div>
  )
}

const Collapse = ({
  children,
  className,
  style = 'border',
}: {
  children?: ReactNode
  className?: string | number | symbol | any
  style?: 'border' | 'borderless'
}) => {
  return (
    <div
      className={clsx(collapse_wrapper, { [className]: className }, { ['borderless']: style === 'borderless' })}
      data-component='collapse'
    >
      {children}
    </div>
  )
}

Collapse.Header = Header
Collapse.Body = Body

export default Collapse
