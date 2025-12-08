import { ActionIcon, useMantineColorScheme } from '@mantine/core'
import { Sun, Moon } from 'lucide-react'
import clsx from 'clsx'
import { base } from './SchemeToggle.css'

const SchemeToggle = ({ onClick }: { onClick?: () => void }) => {
  const { colorScheme } = useMantineColorScheme()
  return (
    <ActionIcon component='div' variant='outline' onClick={onClick}>
      <Sun className={clsx(base, { ['hide']: colorScheme === 'light' })} />
      <Moon className={clsx(base, { ['hide']: colorScheme === 'dark' })} />
    </ActionIcon>
  )
}

export default SchemeToggle
