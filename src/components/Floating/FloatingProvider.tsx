import { useState, useMemo, useRef, ReactNode } from 'react'
import {
  useInteractions,
  useTypeahead,
  useListNavigation,
  useFloatingRootContext,
  useDismiss,
} from '@floating-ui/react'
import { FloatingContext } from './FloatingContext'

export interface FloatingOptionsProps {
  initialOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const useFloatingOptions = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [reference, setReference] = useState<HTMLElement | null>(null)
  const [floating, setFloating] = useState<HTMLElement | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const elementsRef = useRef([])
  const labelsRef = useRef([])

  const rootContext = useFloatingRootContext({
    open: isOpen,
    onOpenChange: setIsOpen,
    elements: {
      reference,
      floating,
    },
  })

  const { getReferenceProps, getItemProps, getFloatingProps } = useInteractions([
    useListNavigation(rootContext, {
      listRef: elementsRef,
      activeIndex,
      onNavigate: setActiveIndex,
      loop: true,
    }),
    useTypeahead(rootContext, {
      listRef: labelsRef,
      activeIndex,
      onMatch: setActiveIndex,
    }),
    useDismiss(rootContext),
  ])

  return useMemo(
    () => ({
      rootContext,
      activeIndex,
      elementsRef,
      labelsRef,
      getReferenceProps,
      getItemProps,
      getFloatingProps,
      reference,
      setReference,
      setFloating,
    }),
    [
      rootContext,
      activeIndex,
      elementsRef,
      labelsRef,
      getReferenceProps,
      getItemProps,
      reference,
      setReference,
      getFloatingProps,
    ]
  )
}

const FloatingProvider = ({ children }: { children: ReactNode }) => {
  const options = useFloatingOptions()
  return <FloatingContext value={options}>{children}</FloatingContext>
}

export default FloatingProvider

export type FloatingOptionsType = ReturnType<typeof useFloatingOptions> | null
