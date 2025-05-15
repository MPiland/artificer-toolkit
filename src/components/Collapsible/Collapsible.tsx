import { type ComponentProps, type ReactNode, type RefObject, memo, use, useEffect } from 'react'
import {
  card,
  card_trigger_title,
  card_trigger,
  card_content,
  card_content_wrapper,
  card_footer,
  card_trigger_icon_collapse,
  card_trigger_icon,
} from './Collapsible.css'
import clsx from 'clsx'
import { HTMLReactParser } from '@/utils'
import { PlusIcon, Trash2 } from 'lucide-react'
import CollapsibleProvider from './CollapsibleProvider'
import { CollapsibleContext } from './CollapsibleContext'
import { Collapse, Group } from '@mantine/core'
import { Slot } from '../Slot/Slot'

type CollapsibleHeaderProps = {
  title: string
  removeFn?: () => void
  titleLeft?: ReactNode
  titleRight?: ReactNode
  className?: string
}

const CollapsibleTrigger = ({ title, removeFn, titleLeft, titleRight, className }: CollapsibleHeaderProps) => {
  const { setOpen, disabledState, open } = use(CollapsibleContext)

  const handleToggle = () => {
    if (disabledState === false) {
      setOpen((prev) => !prev)
    }
  }

  return (
    <Slot data-state={open ? 'open' : 'closed'}>
      <div className={clsx(card_trigger, className)} onClick={handleToggle}>
        <Group justify='space-between' gap='xs'>
          {titleLeft}
          <h3 className={card_trigger_title}>{title}</h3>
          {titleRight}
          {removeFn && <div><Trash2 className={card_trigger_icon} onClick={removeFn} /></div>}
        </Group>
        <PlusIcon className={clsx(card_trigger_icon_collapse, card_trigger_icon)} />
      </div>
    </Slot>
  )
}

type CollapsibleContentProps = {
  children?: ReactNode | string
} & Omit<ComponentProps<typeof Collapse>, 'in'>

const CollapsibleContent = ({ children, className, ...props }: CollapsibleContentProps) => {
  const { open } = use(CollapsibleContext)
  const parsedContent = HTMLReactParser(children)

  return (
    <Slot data-state={open ? 'open' : 'closed'}>
      <Collapse in={open} className={clsx(card_content_wrapper, className)} {...props}>
        <div className={card_content}>{parsedContent}</div>
      </Collapse>
    </Slot>
  )
}

const CollapsibleFooter = ({ children }: { children: ReactNode }) => {
  return <div className={card_footer}>{children}</div>
}

type CollapsibleBaseProps = {
  children: ReactNode
  className?: string
  ref?: RefObject<HTMLDivElement | null>
  disabled?: boolean
  defaultOpen?: boolean
}

const CollapsibleBase = ({ children, className, ref, disabled = false, defaultOpen = false }: CollapsibleBaseProps) => {
  const { disabledState, setDisabledState, defaultOpenState, setDefaultOpenState } = use(CollapsibleContext)

  useEffect(() => {
    if (disabledState !== disabled) setDisabledState(disabled)
    if (defaultOpenState !== defaultOpen) setDefaultOpenState(defaultOpen)
  }, [disabledState, setDisabledState, defaultOpenState, setDefaultOpenState, disabled, defaultOpen])

  return (
    <div ref={ref} className={clsx(card, className)}>
      {children}
    </div>
  )
}

const CollapsibleRoot = ({ children, className, ref, disabled, defaultOpen }: CollapsibleBaseProps) => {
  return (
    <CollapsibleProvider>
      <CollapsibleBase className={className} ref={ref} disabled={disabled} defaultOpen={defaultOpen}>
        {children}
      </CollapsibleBase>
    </CollapsibleProvider>
  )
}

const MemoizedCollapsibleRoot = memo(CollapsibleRoot)

// Properly assign static properties **after** memo
const Collapsible = Object.assign(MemoizedCollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
  Footer: CollapsibleFooter,
})

export default Collapsible
