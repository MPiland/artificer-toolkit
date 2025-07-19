import { type ReactNode } from 'react'
import { base, title as trigger_title, icon, icon_collapse } from './Trigger.css'
import clsx from 'clsx'
import { PlusIcon, Trash2 } from 'lucide-react'
import { Group } from '@mantine/core'

export type TriggerProps = {
  disabled?: boolean
  toggle?: () => void
  title: string
  removeFn?: () => void
  titleLeft?: ReactNode
  titleRight?: ReactNode
  className?: string
}

const Trigger = ({
  disabled = false,
  toggle = () => {},
  title,
  removeFn,
  titleLeft,
  titleRight,
  className,
}: TriggerProps) => {
  return (
    <div className={clsx(base, className)} onClick={() => !disabled && toggle()}>
      <Group justify='space-between' align='center' gap='xs'>
        {titleLeft}
        <h3 className={trigger_title}>{title}</h3>
        {titleRight}
        {removeFn && <Trash2 className={icon} onClick={removeFn} />}
      </Group>
      <PlusIcon className={clsx(icon_collapse, icon)} />
    </div>
  )
}

export default Trigger
