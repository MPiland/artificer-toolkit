import { isValidElement, cloneElement, ReactNode, HTMLProps, ElementType, useState, useRef, use } from 'react'
import {
  useMergeRefs,
  FloatingPortal,
  FloatingArrow,
  FloatingFocusManager,
  FloatingList,
  useListItem,
  useFloating as useFloatingUI,
  useRole,
  useClick,
  useHover,
  useFocus,
  useDismiss,
  useInteractions,
  flip,
  offset,
  shift,
  autoUpdate,
  Placement,
  arrow,
} from '@floating-ui/react'
import { FloatingContext } from './FloatingContext'
import { FloatingOptions, FloatingOptionsProps } from './FloatingContext'
import { floating_arrow, floating_content, floating_option, floating_option_right_side } from './Floating.css'
import clsx from 'clsx'
import { TbCheck } from 'react-icons/tb'

const Floating = ({ children }: { children: ReactNode } & FloatingOptionsProps) => {
  // This can accept any props as options, e.g. `placement`,
  // or other positioning options.
  const floatingOptions = FloatingOptions()
  return <FloatingContext value={floatingOptions}>{children}</FloatingContext>
}

const Anchor = function FloatingAnchor({
  children,
  asChild = false,
  className,
  ref: propRef,
  ...props
}: HTMLProps<HTMLElement> & {
  asChild?: boolean
  as?: ElementType
  ref?: React.Ref<HTMLElement>
}) {
  const context = use(FloatingContext)
  const childrenRef = (children as any).ref
  const ref = useMergeRefs([context.setReference, propRef, childrenRef])

  if (asChild && isValidElement(children)) {
    const childProps = typeof children.props === 'object' ? children.props : {}
    return cloneElement(
      children,
      context?.getReferenceProps({
        ref,
        ...props,
        ...childProps,
        className,
      })
    )
  }

  return (
    <div ref={ref} className={className} {...context.getReferenceProps(props)}>
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
  initialOpen = false,
  style,
  boundary = 'app',
  placement = 'bottom-start',
  ...props
}: MenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen)

  const arrowRef = useRef(null)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const appMain = document.getElementById('app-main')
  const formContent = document.getElementById('form-content')

  const context = use(FloatingContext)

  const {
    refs,
    floatingStyles,
    context: menuContext,
  } = useFloatingUI({
    placement,
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange: setOpen,
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
      reference: context.reference,
    },
  })

  const role = useRole(menuContext, { role: 'menu' })
  const click = useClick(menuContext, {
    enabled: controlledOpen == null,
  })
  const hover = useHover(menuContext, {
    move: false,
    enabled: controlledOpen == null,
  })
  const focus = useFocus(menuContext, {
    enabled: controlledOpen == null,
  })
  const dismiss = useDismiss(menuContext)

  const { getFloatingProps } = useInteractions([click, hover, focus, dismiss, role])

  if (!open) return null

  return (
    <FloatingPortal root={boundary === 'form' ? formContent ?? appMain : appMain}>
      <FloatingFocusManager context={menuContext} closeOnFocusOut={true} modal={false}>
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            ...style,
          }}
          {...getFloatingProps()}
          className={clsx(floating_content, props.className)}
        >
          <FloatingList elementsRef={context.elementsRef} labelsRef={context.labelsRef}>
            {props.children}
          </FloatingList>
          {showArrow && (
            <FloatingArrow ref={arrowRef} context={menuContext} className={clsx(floating_arrow, props.className)} />
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
}

const Tooltip = function FloatingTooltip({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  showArrow = false,
  initialOpen = false,
  style,
  boundary = 'app',
  placement = 'bottom',
  ...props
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen)

  const arrowRef = useRef(null)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const appMain = document.getElementById('app-main')
  const formContent = document.getElementById('form-content')

  const context = use(FloatingContext)

  const {
    refs,
    floatingStyles,
    context: tooltipContext,
  } = useFloatingUI({
    placement,
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange: setOpen,
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
      reference: context.reference,
    },
  })

  if (!open) return null

  return (
    <FloatingPortal root={boundary === 'form' ? formContent ?? appMain : appMain}>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          ...style,
        }}
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
  option: { id: string; label: string; value: string }
  onSelect: (option: { id: string; label: string; value: string }) => void
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
      <span>{option.label}</span>
      <span className={floating_option_right_side}>{selected && <TbCheck />}</span>
    </div>
  )
}

Floating.Menu = Menu
Floating.Tooltip = Tooltip
Floating.Option = Option
Floating.Anchor = Anchor

export default Floating
