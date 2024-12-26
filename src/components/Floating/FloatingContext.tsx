import { createContext, useState, useMemo, useRef } from 'react'
import { useFloating, useInteractions, useTypeahead, useListNavigation } from '@floating-ui/react'

export interface FloatingOptionsProps {
  initialOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const FloatingOptions = () => {
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

export type FloatingOptionsType = ReturnType<typeof FloatingOptions> | null

export const FloatingContext = createContext<FloatingOptionsType>(null)
