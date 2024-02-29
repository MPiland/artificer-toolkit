import { FC, useState, useRef } from 'react'
import {
  select,
  select_label,
  select_wrapper,
  select_container,
  select_input,
  select_menu,
  select_option,
} from './Select.css'
import { startCase } from 'lodash'
import {
  autoUpdate,
  offset,
  useFloating,
  FloatingPortal,
  useInteractions,
  useClick,
  useListNavigation,
  useTypeahead,
  useDismiss,
  FloatingFocusManager,
  flip,
} from '@floating-ui/react'
import ScrollArea from '../ScrollArea/ScrollArea'

interface SelectProps {
  label: string
  options: Array<string>
  handleChange: (arg: string) => void
  placeholder: string
}

const Select: FC<SelectProps> = ({
  label,
  options,
  handleChange,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const appMain = document.getElementById('app-main')

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip()],
  })

  const click = useClick(context)

  const dismiss = useDismiss(context)

  const listItemsRef = useRef<Array<HTMLDivElement | null>>([])
  const listContentRef = useRef<Array<string | null>>([])

  const typeahead = useTypeahead(context, {
    listRef: listContentRef,
    activeIndex,
    onMatch: setActiveIndex,
  })

  const listNavigation = useListNavigation(context, {
    listRef: listItemsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  })

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [click, listNavigation, typeahead, dismiss]
  )

  return (
    <div className={select}>
      <div className={select_wrapper}>
        {label && <label className={select_label}>{label}</label>}
        <div
          className={select_container}
          ref={refs.setReference}
          {...getReferenceProps()}
          tabIndex={0}
        >
          <span className={select_input}>{placeholder}</span>
        </div>
      </div>
      {isOpen && (
        <FloatingPortal root={appMain} preserveTabOrder={true}>
          <FloatingFocusManager
            context={context}
            closeOnFocusOut={true}
            modal={false}
          >
            <div
              className={select_menu}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <ScrollArea scrollDirection='vertical'>
                {options.map((optionItem: string, optionIndex: number) => (
                  <div
                    className={select_option}
                    key={optionIndex}
                    {...getItemProps({
                      onClick() {
                        handleChange(optionItem)
                      },
                      onKeyDown(e) {
                        if (e.key === 'Enter' || e.key === 'Space') {
                          handleChange(optionItem)
                        }
                      },
                    })}
                    tabIndex={activeIndex === optionIndex ? 0 : -1}
                    ref={(node) => {
                      listItemsRef.current[optionIndex] = node
                      listContentRef.current[optionIndex] =
                        node?.textContent ?? null
                    }}
                  >
                    {startCase(optionItem as string)}
                  </div>
                ))}
              </ScrollArea>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  )
}

export default Select
