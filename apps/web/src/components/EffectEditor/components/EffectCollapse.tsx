import { type ReactNode } from 'react'
import { Collapse } from '#app/ui/primitives/Collapse'
import IChevron from '#assets/icons/IChevron'
import {
  collapseChevron,
  editorPanel,
  sectionBody,
  sectionKicker,
  sectionTrigger
} from '../EffectEditor.css'

export function EffectCollapse({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <Collapse
      defaultOpened
      variant='borderless'
      className={editorPanel}
      contentClassName={sectionBody}
      props={{
        trigger: {
          title,
          titleId: id,
          className: sectionTrigger,
          titleClassName: sectionKicker,
          collapseIcon: <IChevron className={collapseChevron} size={14} />
        }
      }}
    >
      {children}
    </Collapse>
  )
}
