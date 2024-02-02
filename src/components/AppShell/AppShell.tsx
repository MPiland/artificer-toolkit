import { ReactNode, FC, RefObject } from 'react'
import { light } from '../../css/global.css'
import {
  app_shell,
  app_main,
  app_header,
  hamburger,
  hamburger_wrapper,
  hamburger_line,
  app_sidebar,
} from './AppShell.css'
import clsx from 'clsx'

interface AppShellProps {
  children: ReactNode
}

interface MainProps {
  children: ReactNode
  sidebarActive: boolean
}

interface HeaderProps {
  children: ReactNode
}

interface HamburgerProps {
  onClick: () => void
  isActive: boolean
  hamburgerRef: RefObject<HTMLDivElement>
}

interface SidebarProps {
  children: ReactNode
  isActive: boolean
  sidebarRef: RefObject<HTMLDivElement>
}

export const Hamburger: FC<HamburgerProps> = ({ onClick, isActive, hamburgerRef }) => {
  return (
    <div
      className={hamburger_wrapper}
      onClick={onClick}
      ref={hamburgerRef}
      tabIndex={0}
      role="button"
    >
      <div className={clsx(hamburger, { ['active']: isActive })}>
        <span className={hamburger_line}></span>
        <span className={hamburger_line}></span>
        <span className={hamburger_line}></span>
      </div>
    </div>
  )
}

export const Header: FC<HeaderProps> = ({ children }) => {
  return <header className={app_header}>{children}</header>
}

export const Main: FC<MainProps> = ({ children, sidebarActive }) => {
  return (
    <div
      className={clsx(app_main, {
        ['sidebar_active']: sidebarActive,
      })}
      id="app-main"
    >
      {children}
    </div>
  )
}

export const Sidebar: FC<SidebarProps> = ({ children, isActive, sidebarRef }) => {
  return (
    <nav className={clsx(app_sidebar, { ['active']: isActive })} ref={sidebarRef}>
      {children}
    </nav>
  )
}

const AppShell: FC<AppShellProps> & {
  Header: FC<HeaderProps>
  Main: FC<MainProps>
  Sidebar: FC<SidebarProps>
  Hamburger: FC<HamburgerProps>
} = ({ children }) => {
  return <div className={clsx(app_shell, light)}>{children}</div>
}

AppShell.Header = Header
AppShell.Main = Main
AppShell.Sidebar = Sidebar
AppShell.Hamburger = Hamburger

export default AppShell
