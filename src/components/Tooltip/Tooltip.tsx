import { useFloating, offset, flip, FloatingPortal, FloatingArrow, arrow } from '@floating-ui/react'
import { ReactNode, useRef } from 'react'
import { tooltip_message, tooltip_nowrapper } from './Tooltip.css'
import clsx from 'clsx'

interface TooltipProps {
  children?: ReactNode
  className?: string | number | symbol | any
  label?: string
  opened: boolean
  nowrapper?: boolean
}

const Tooltip = ({ children, className, label, opened, nowrapper }: TooltipProps) => {
  const arrowRef = useRef(null)

  const appMain = document.getElementById('app-main')

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
    open: opened,
    middleware: [offset(7), flip(), arrow({ element: arrowRef })],
  })

  return (
    <div ref={refs.setReference} className={clsx({ [className]: className }, { [tooltip_nowrapper]: nowrapper })}>
      {children}
      {opened && (
        <FloatingPortal root={appMain}>
          <div ref={refs.setFloating} style={floatingStyles}>
            <div className={tooltip_message}>{label}</div>
            <FloatingArrow ref={arrowRef} context={context} />
          </div>
        </FloatingPortal>
      )}
    </div>
  )
}

export default Tooltip
