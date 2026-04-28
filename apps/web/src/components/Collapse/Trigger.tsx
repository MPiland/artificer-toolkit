import { type ReactNode } from 'react'
import { base, button, title as trigger_title, icon, icon_collapse } from './Trigger.css'
import clsx from 'clsx'
import { PlusIcon, Trash2 } from 'lucide-react'
import { ActionIcon, Group, Tooltip, UnstyledButton } from '@mantine/core'

export type TriggerProps = {
  disabled?: boolean
  toggle?: () => void
  title: string
  titleId?: string
  contentId?: string
  removeFn?: () => void
  titleLeft?: ReactNode
  titleRight?: ReactNode
  titleClassName?: string
  className?: string
  opened?: boolean
  collapseIcon?: ReactNode
}

export function Trigger({
  disabled = false,
  toggle = () => {},
  title,
  titleId,
  contentId,
  removeFn,
  titleLeft,
  titleRight,
  titleClassName,
  className,
  opened = false,
  collapseIcon,
}: TriggerProps) {
  return (
    <div className={clsx(base, className)} data-state={opened ? 'open' : 'closed'}>
      <UnstyledButton
        className={clsx(button, className)}
        disabled={disabled}
        aria-expanded={opened}
        aria-controls={contentId}
        onClick={() => !disabled && toggle()}
      >
        <Group justify='space-between' align='center' gap='xs' wrap='nowrap'>
          {titleLeft}
          <span id={titleId} className={clsx(trigger_title, titleClassName)}>{title}</span>
        </Group>
        {collapseIcon ?? <PlusIcon className={clsx(icon_collapse, icon)} />}
      </UnstyledButton>
      {titleRight}
      {removeFn && (
        <Tooltip label={`Remove ${title}`}>
          <ActionIcon
            aria-label={`Remove ${title}`}
            variant='subtle'
            onClick={(event) => {
              event.stopPropagation()
              removeFn()
            }}
          >
            <Trash2 className={icon} />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  )
}
