import { type ComponentProps, type ReactNode, type RefObject, useId } from 'react'
import { base, borderless } from './Collapse.css'
import * as footer from './Footer.css'
import clsx from 'clsx'
import HTMLReactParser from '#app/utils/reactParser/dom-to-react'
import { Collapse as MantineCollapse } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Trigger, type TriggerProps } from './Trigger'

type CollapseProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
  ref?: RefObject<HTMLDivElement | null>
  disabled?: boolean
  defaultOpened?: boolean
  variant?: 'framed' | 'borderless'
  props: {
    trigger: TriggerProps
    footer?: {
      children: ReactNode
    }
  }
} & Omit<ComponentProps<typeof MantineCollapse>, 'in'>

export function Collapse({
  children,
  className,
  contentClassName,
  ref,
  disabled = false,
  defaultOpened = false,
  variant = 'framed',
  props,
  ...collapseProps
}: CollapseProps) {
  const [opened, { toggle }] = useDisclosure(defaultOpened)
  const generatedId = useId()
  const contentId = collapseProps.id ?? `${generatedId}-content`
  const titleId = props.trigger.titleId ?? `${generatedId}-title`
  const parsedContent = typeof children === 'string' ? HTMLReactParser(children) : children

  return (
    <div ref={ref} className={clsx(variant === 'borderless' ? borderless : base, className)}>
      <Trigger
        {...props.trigger}
        titleId={titleId}
        contentId={contentId}
        opened={opened}
        toggle={toggle}
        disabled={disabled}
      />
      <MantineCollapse
        id={contentId}
        in={opened}
        role='region'
        aria-labelledby={titleId}
        className={clsx(contentClassName ?? className)}
        transitionDuration={120}
        transitionTimingFunction='cubic-bezier(0.7,0,0.3,1)'
        {...collapseProps}
      >
        {parsedContent}
      </MantineCollapse>
      {props.footer && <div className={footer.base}>{props.footer?.children}</div>}
    </div>
  )
}
