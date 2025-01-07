import { MouseEvent as ReactMouseEvent, ReactNode, use } from 'react'
import {
  app_shell,
  app_main,
  app_header,
  hamburger,
  hamburger_wrapper,
  hamburger_line,
  app_sidebar,
  app_content,
} from './AppShell.css'
import clsx from 'clsx'
import ThemeContext from '../../theme/ThemeContext'
import AppShellProvider from '../../Layout/LayoutProvider'

interface AppShellProps {
  children: ReactNode
}

interface MainProps {
  children: ReactNode
}

interface ContentProps {
  children: ReactNode
}

interface HeaderProps {
  children: ReactNode
}

interface HamburgerProps {
  onClick: (event: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void
  collapsed: boolean
}

interface SidebarProps {
  children: ReactNode
  collapsed: boolean
}

export const Hamburger = ({ onClick, collapsed = false }: HamburgerProps) => {
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

export const Header = ({ children }: HeaderProps) => {
  return <header className={app_header}>{children}</header>
}

export const Main = ({ children }: MainProps) => {
  return (
    <div className={app_main} id='app-main'>
      {children}
    </div>
  )
}

export const Content = ({ children }: ContentProps) => {
  return (
    <div className={app_content} id='app-content'>
      {children}
    </div>
  )
}

export const Sidebar = ({ children, collapsed = false }: SidebarProps) => {
  return <nav className={clsx(app_sidebar, { ['collapsed']: collapsed })}>{children}</nav>
}

const AppShell = ({ children }: AppShellProps) => {
  const { themeVar } = use(ThemeContext)
  return (
    <AppShellProvider>
      <div className={clsx(app_shell, themeVar)}>{children}</div>
    </AppShellProvider>
  )
}

AppShell.Header = Header
AppShell.Main = Main
AppShell.Content = Content
AppShell.Sidebar = Sidebar
AppShell.Hamburger = Hamburger

export default AppShell
