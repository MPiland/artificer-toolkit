import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import clsx from 'clsx'
import IDarkMode from '#assets/icons/IDarkMode'
import ILightMode from '#assets/icons/ILightMode'
import {
  themeToggleButton,
  themeToggleButtonIntent,
  themeToggleIcon,
  themeToggleRoot,
  visuallyHidden
} from './ThemeToggle.css'

export interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setColorScheme } = useMantineColorScheme()
  const activeColorScheme = useComputedColorScheme('dark')
  const nextColorScheme = activeColorScheme === 'dark' ? 'light' : 'dark'
  const Icon = activeColorScheme === 'dark' ? IDarkMode : ILightMode
  const buttonLabel = `Switch to ${nextColorScheme} mode`
  const activeLabel = `${activeColorScheme === 'dark' ? 'Dark' : 'Light'} mode active`

  return (
    <div className={clsx(themeToggleRoot, className)}>
      <button
        type='button'
        className={clsx(themeToggleButton, themeToggleButtonIntent[activeColorScheme])}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setColorScheme(nextColorScheme)}
      >
        <span className={visuallyHidden}>{activeLabel}</span>
        <Icon className={themeToggleIcon} aria-hidden='true' />
      </button>
    </div>
  )
}
