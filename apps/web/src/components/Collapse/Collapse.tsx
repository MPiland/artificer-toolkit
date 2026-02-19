import { type ComponentProps, type ReactNode, type RefObject } from 'react'
import { base } from './Collapse.css'
import * as footer from './Footer.css'
import clsx from 'clsx'
import { HTMLReactParser } from '@utils'
import { Collapse as MantineCollapse } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import Trigger, { type TriggerProps } from './Trigger'

type CollapseProps = {
  children: ReactNode
  className?: string
  ref?: RefObject<HTMLDivElement | null>
  disabled?: boolean
  props: {
    trigger: TriggerProps
    footer?: {
      children: ReactNode
    }
  }
} & Omit<ComponentProps<typeof MantineCollapse>, 'in'>

const Collapse = ({ children, className, ref, disabled = false, props }: CollapseProps) => {
  const [opened, { toggle }] = useDisclosure(false)
  const parsedContent = HTMLReactParser(children)

  return (
    <div ref={ref} className={clsx(base, className)}>
      <Trigger {...props.trigger} toggle={toggle} disabled={disabled} />
      <MantineCollapse
        in={opened}
        className={clsx(className)}
        transitionDuration={120}
        transitionTimingFunction='cubic-bezier(0.7,0,0.3,1)'
        {...props}
      >
        {parsedContent}
      </MantineCollapse>
      {props.footer && <div className={footer.base}>{props.footer?.children}</div>}
    </div>
  )
}

export default Collapse
