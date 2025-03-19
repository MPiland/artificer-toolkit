import { ReactNode, HTMLProps, useRef, use, KeyboardEvent } from 'react'
import {
  useMergeRefs,
  FloatingPortal,
  FloatingArrow,
  FloatingFocusManager,
  FloatingList,
  useListItem,
  useFloating,
  flip,
  offset,
  shift,
  autoUpdate,
  Placement,
  arrow,
  useInteractions,
  useDismiss,
  useRole,
  useClick,
} from '@floating-ui/react'
import { FloatingContext } from './FloatingContext'
import FloatingProvider, { FloatingOptionsProps } from './FloatingProvider'
import { floating_arrow, floating_content, floating_option, floating_option_right_side } from './Floating.css'
import clsx from 'clsx'
import { TbCheck } from 'react-icons/tb'

const Floating = ({ children }: { children: ReactNode } & FloatingOptionsProps) => {
  return <FloatingProvider>{children}</FloatingProvider>
}

const Anchor = function FloatingAnchor({
  children,
  className,
  ref: propRef,
  ...props
}: HTMLProps<HTMLElement> & {
  ref?: React.Ref<HTMLElement>
}) {
  const context = use(FloatingContext)
  const childrenRef = (children as any).ref
  const ref = useMergeRefs([context.setReference, propRef, childrenRef])

  const { getReferenceProps: anchorReferenceProps } = useInteractions([useClick(context.rootContext)])

  return (
    <div
      ref={ref}
      className={className}
      {...context.getReferenceProps({
        ...props,
      })}
      {...anchorReferenceProps()}
    >
      {children}
    </div>
  )
}

type MenuProps = HTMLProps<HTMLDivElement> & {
  boundary: 'app' | 'form'
  initialOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showArrow?: boolean
  placement?: Placement
}

const Menu = function FloatingMenu({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  showArrow = false,
  style,
  boundary = 'app',
  placement = 'bottom-start',
  ...props
}: MenuProps) {
  const arrowRef = useRef(null)

  const floatingContext = use(FloatingContext)

  const open = controlledOpen || floatingContext.rootContext.open
  const onOpenChange = setControlledOpen || floatingContext.rootContext.onOpenChange

  const appMain = document.getElementById('app-main')
  const formContent = document.getElementById('form-content')

  const { floatingStyles, context } = useFloating({
    rootContext: floatingContext.rootContext,
    placement,
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange,
    middleware: [
      offset(5),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 5,
      }),
      shift({ padding: 5 }),
      arrow({ element: arrowRef }),
    ],
    elements: {
      reference: floatingContext.reference,
    },
  })

  const { getFloatingProps: menuFloatingProps } = useInteractions([
    useRole(floatingContext.rootContext, { role: 'menu' }),
    useClick(floatingContext.rootContext),
  ])

  if (!context.open) return null

  return (
    <FloatingPortal root={boundary === 'form' ? formContent : appMain}>
      <FloatingFocusManager
        context={floatingContext.rootContext}
        closeOnFocusOut={true}
        returnFocus={true}
        modal={false}
      >
        <div
          ref={floatingContext.setFloating}
          style={{
            ...floatingStyles,
            ...style,
          }}
          {...floatingContext.getFloatingProps({
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              props.onKeyDown?.(e)
            },
          })}
          {...menuFloatingProps()}
          className={clsx(floating_content, props.className)}
        >
          <FloatingList elementsRef={floatingContext.elementsRef} labelsRef={floatingContext.labelsRef}>
            {props.children}
          </FloatingList>
          {showArrow && (
            <FloatingArrow ref={arrowRef} context={context} className={clsx(floating_arrow, props.className)} />
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

type TooltipProps = HTMLProps<HTMLDivElement> & {
  initialOpen?: boolean
  boundary: 'app' | 'form'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showArrow?: boolean
  placement?: Placement
  hover?: boolean
}

const Tooltip = function FloatingTooltip({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  showArrow = false,
  style,
  boundary = 'app',
  placement = 'bottom',
  ...props
}: TooltipProps) {
  const arrowRef = useRef(null)

  const floatingContext = use(FloatingContext)

  const open = controlledOpen ?? floatingContext.rootContext.open
  const onOpenChange = setControlledOpen ?? floatingContext.rootContext.onOpenChange

  const appMain = document.getElementById('app-main')
  const formContent = document.getElementById('form-content')

  const { floatingStyles, context: tooltipContext } = useFloating({
    rootContext: floatingContext.rootContext,
    placement,
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange,
    middleware: [
      offset(10),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 5,
      }),
      shift({ padding: 5 }),
      arrow({ element: arrowRef }),
    ],
    elements: {
      reference: floatingContext.reference,
    },
  })

  const { getFloatingProps: tooltipFloatingProps } = useInteractions([useDismiss(floatingContext.rootContext)])

  if (!open) return null

  return (
    <FloatingPortal root={boundary === 'form' ? formContent ?? appMain : appMain}>
      <div
        ref={floatingContext.setFloating}
        style={{
          ...floatingStyles,
          ...style,
        }}
        {...tooltipFloatingProps()}
        className={clsx(floating_content, props.className)}
      >
        {props.children}
        {showArrow && (
          <FloatingArrow ref={arrowRef} context={tooltipContext} className={clsx(floating_arrow, props.className)} />
        )}
      </div>
    </FloatingPortal>
  )
}

type OptionProps = Omit<HTMLProps<HTMLDivElement>, 'onSelect'> & {
  option: { id: string; label: string | number | ReactNode; value: string; renderedLabel?: string | number | ReactNode }
  onSelect: (option: { id: string; label: string | number | ReactNode; value: string }) => void
  selected: boolean
}

const Option = function DropdownOption({ option, selected, onSelect, ref: propRef }: OptionProps) {
  const context = use(FloatingContext)
  const { ref: optionRef, index } = useListItem({
    label: String(option.label),
  })
  const ref = useMergeRefs([propRef, optionRef])

  const isActive = context.activeIndex === index

  return (
    <div
      className={floating_option}
      ref={ref}
      tabIndex={isActive ? 0 : -1}
      {...context.getItemProps({
        onClick() {
          onSelect?.(option)
        },
        onKeyDown(e) {
          if (e.key === 'Enter' || e.key === 'Space') {
            onSelect?.(option)
          }
        },
      })}
    >
      <span>{option?.renderedLabel || option.label}</span>
      <span className={floating_option_right_side}>{selected && <TbCheck />}</span>
    </div>
  )
}

Floating.Menu = Menu
Floating.Tooltip = Tooltip
Floating.Option = Option
Floating.Anchor = Anchor

export default Floating
