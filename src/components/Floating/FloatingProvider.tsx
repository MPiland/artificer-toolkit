import { useState, useMemo, useRef, ReactNode } from 'react'
import { useFloating, useInteractions, useTypeahead, useListNavigation } from '@floating-ui/react'
import { FloatingContext } from './FloatingContext'

export interface FloatingOptionsProps {
  initialOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const useFloatingOptions = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [reference, setReference] = useState<HTMLElement | null>(null)

  const elementsRef = useRef([])
  const labelsRef = useRef([])

  const { refs, context, floatingStyles, ...rest } = useFloating({
    elements: {
      reference,
    },
  })

  const { getReferenceProps, getItemProps } = useInteractions([
    useListNavigation(context, {
      listRef: elementsRef,
      activeIndex,
      onNavigate: setActiveIndex,
      loop: true,
    }),
    useTypeahead(context, {
      listRef: labelsRef,
      activeIndex,
      onMatch: setActiveIndex,
    }),
  ])

  return useMemo(
    () => ({
      refs,
      context,
      activeIndex,
      elementsRef,
      labelsRef,
      floatingStyles,
      getReferenceProps,
      getItemProps,
      reference,
      setReference,
      ...rest,
    }),
    [refs, context, floatingStyles, activeIndex, getReferenceProps, getItemProps, rest, reference, setReference]
  )
}

const FloatingProvider = ({ children }: { children: ReactNode }) => {
  const options = useFloatingOptions()
  return <FloatingContext value={options}>{children}</FloatingContext>
}

export default FloatingProvider

export type FloatingOptionsType = ReturnType<typeof useFloatingOptions> | null
