import { TbCaretDown, TbCaretUp, TbSquareMinus, TbSquarePlus } from 'react-icons/tb'
import { useState, ReactNode, useRef, useEffect, cloneElement, Children, ReactElement } from 'react'
import { tabs_tab, tabs_body, tabs_wrapper, tabs_tab_icon, tabs_content, tabs_header } from './Tabs.css'
import { clsx } from 'clsx'
import { Group } from '@mantine/core'

interface HeaderProps {
  children?: ReactNode
}

interface TabProps {
  title: string
  className?: string | number | symbol | any
  leftSide?: ReactNode
  rightSide?: ReactNode
  onClick?: () => void
  isActive?: boolean
  style?: 'border' | 'borderless'
}

interface PanelProps {
  children?: ReactNode
  className?: string | number | symbol | any
}

interface TabsProps {
  children?: ReactNode | ReactNode[]
  className?: string | number | symbol | any
  style?: 'border' | 'borderless'
}

const Header = ({ children }: HeaderProps) => {
  const [borderless, setBorderless] = useState<boolean>(false)
  const headerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const header = headerRef.current
    if (header) {
      const parent = header.parentElement

      if (parent) {
        const parentBorderless = parent.classList.contains('borderless')

        if (parentBorderless) {
          setBorderless(true)
        } else if (borderless) {
          setBorderless(false)
        }
      }
    }
  }, [borderless])

  return (
    <div ref={headerRef} className={clsx(tabs_header, { borderless })}>
      {children}
    </div>
  )
}

const Panel = ({ children, className }: PanelProps) => {
  return (
    <div className={clsx(tabs_body)}>
      <div className={clsx(tabs_content, { [className]: className })}>{children}</div>
    </div>
  )
}

const Tab = ({ title, className, leftSide, rightSide, isActive, onClick, style }: TabProps) => {
  return (
    <div className={clsx(tabs_tab, { [className]: className, ['inactive']: !isActive })} onClick={onClick}>
      <Group>
        {leftSide}
        <h3>{title}</h3>
        {rightSide}
      </Group>
      <Group>
        {style === 'border' ?
          <span className={tabs_tab_icon}>
            {isActive ?
              <TbSquarePlus />
            : <TbSquareMinus />}
          </span>
        : <span className={tabs_tab_icon}>
            {isActive ?
              <TbCaretDown />
            : <TbCaretUp />}
          </span>
        }
      </Group>
    </div>
  )
}

const Tabs = ({ children, className, style = 'border' }: TabsProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0)

  const handleTabClick = (index: number) => {
    if (index === activeIndex) {
      setActiveIndex(null)
    } else {
      setActiveIndex(index)
    }
  }

  const childrenArray = Children.toArray(children) as ReactElement[]
  const header = childrenArray.find((child: any) => child.type.name === 'Header')
  const tabs = Children.toArray((header as ReactElement<{ children: ReactNode }>)?.props.children).filter(
    (child: any) => child.type.name === 'Tab'
  )
  const panels = childrenArray.filter((child: any) => child.type.name === 'Panel')

  return (
    <div className={clsx(tabs_wrapper, { [className]: className }, { ['borderless']: style === 'borderless' })}>
      {header &&
        cloneElement(header as ReactElement<{ children: ReactNode }>, {
          children: tabs.map((tab: any, index: number) =>
            cloneElement(tab, { index, isActive: index === activeIndex, onClick: () => handleTabClick(index), style })
          ),
        })}

      {panels[activeIndex as number]}
    </div>
  )
}

Tabs.Header = Header
Tabs.Tab = Tab
Tabs.Panel = Panel

export default Tabs
