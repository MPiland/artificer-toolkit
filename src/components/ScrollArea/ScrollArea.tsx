import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  ComponentPropsWithoutRef,
  RefObject,
  useReducer,
  useLayoutEffect,
} from 'react'
import clsx from 'clsx'
import { scroll_area, scroll_area_wrapper, scroll_arrow } from './ScrollArea.css'
import { useDebounceCallback, useEventListener } from 'usehooks-ts'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import Scrollbar from '../Scrollbar/Scrollbar'
import { scrollReducer } from '../../reducers/scrollReducer'

interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  children?: ReactNode | ReactNode[]
  className?: string | number | symbol | any
  wrapperClassName?: string | number | symbol | any
  scrollDirection: 'horizontal' | 'vertical' | 'all' | 'none'
  visibility?: 'hidden' | 'visible' | 'always'
  arrows?: boolean
  [key: string]: any
  scrollWrapperOverflow?: 'hidden' | 'off'
  ref?: RefObject<HTMLDivElement>
}

const SCROLL_BOX_MIN_SIZE = 20

const ScrollArea = ({
  children,
  className,
  wrapperClassName,
  scrollDirection = 'vertical',
  visibility = 'visible',
  scrollWrapperOverflow = 'hidden',
  id,
  wrapperId,
  arrows = false,
  ref,
  ...props
}: ScrollAreaProps) => {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<Document>(document)
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null)

  const [scrollState, dispatch] = useReducer(scrollReducer, {
    verticalThumbSize: SCROLL_BOX_MIN_SIZE,
    horizontalThumbSize: SCROLL_BOX_MIN_SIZE,
    verticalThumbPosition: 0,
    horizontalThumbPosition: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    isDragging: false,
    dragDirection: null,
    active: false,
    mousePos: { x: 0, y: 0 },
  })

  const [leftArrowVisible, setLeftArrowVisible] = useState<boolean>(false)
  const [rightArrowVisible, setRightArrowVisible] = useState<boolean>(false)

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      const updateSizes = () => {
        const scrollArea = scrollAreaRef.current
        if (scrollArea) {
          const { clientHeight, scrollHeight, scrollWidth, clientWidth } = scrollArea
          const needsVerticalScroll = scrollHeight > clientHeight
          const needsHorizontalScroll = scrollWidth > clientWidth

          const verticalRatio = needsVerticalScroll ? clientHeight / scrollHeight : 1
          const horizontalRatio = needsHorizontalScroll ? clientWidth / scrollWidth : 1

          const verticalThumbSize = needsVerticalScroll
            ? Math.max(SCROLL_BOX_MIN_SIZE, clientHeight * verticalRatio)
            : 0
          const horizontalThumbSize = needsHorizontalScroll
            ? Math.max(SCROLL_BOX_MIN_SIZE, clientWidth * horizontalRatio)
            : 0

          dispatch({
            type: 'UPDATE_DIMENSIONS',
            scrollHeight,
            scrollWidth,
            verticalThumbSize,
            horizontalThumbSize,
          })

          dispatch({
            type: 'SET_ACTIVE',
            value: needsVerticalScroll || needsHorizontalScroll,
          })
        }
      }

      const resizeObserver = new ResizeObserver(updateSizes)
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes)
            addedNodes.forEach((node) => {
              if (node instanceof Element) {
                resizeObserver.observe(node)
                const collapseElements = node.querySelectorAll('[data-component="collapse"]')
                collapseElements.forEach((el) => resizeObserver.observe(el))
              }
            })
          }
        })
        updateSizes()
      })

      resizeObserver.observe(scrollArea)
      mutationObserver.observe(scrollArea, {
        childList: true,
        subtree: true,
      })

      updateSizes()

      return () => {
        resizeObserver.disconnect()
        mutationObserver.disconnect()
      }
    }
  }, [])

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea && arrows) {
      setLeftArrowVisible(scrollArea.scrollLeft > 0)
      setRightArrowVisible(scrollArea.scrollLeft < scrollArea.scrollWidth - scrollArea.clientWidth)
    }
  }, [arrows, scrollState.horizontalThumbPosition])

  const debouncedScrollEnd = useDebounceCallback(() => {
    if (!scrollState.isDragging && visibility !== 'always') {
      dispatch({ type: 'SET_ACTIVE', value: false })
    }
  }, 750)

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      const scrollArea = scrollAreaRef.current
      if (!scrollArea || !e.deltaY) return

      debouncedScrollEnd.cancel()
      dispatch({ type: 'SET_ACTIVE', value: true })

      const delta = e.deltaY

      if (scrollDirection === 'vertical' || scrollDirection === 'all') {
        scrollArea.scrollTop += delta
        dispatch({
          type: 'UPDATE_SCROLL',
          verticalDelta: delta,
          clientHeight: scrollArea.clientHeight,
          clientWidth: scrollArea.clientWidth,
        })
      }
      if (scrollDirection === 'horizontal' || scrollDirection === 'all') {
        scrollArea.scrollLeft += delta
        dispatch({
          type: 'UPDATE_SCROLL',
          horizontalDelta: delta,
          clientHeight: scrollArea.clientHeight,
          clientWidth: scrollArea.clientWidth,
        })
      }
    },
    [scrollDirection, debouncedScrollEnd]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (scrollState.isDragging && scrollState.dragDirection) {
        const wrapper = scrollWrapperRef.current
        const scrollArea = scrollAreaRef.current
        if (!wrapper || !scrollArea) return

        if (scrollDirection === 'vertical' || scrollDirection === 'all') {
          const delta = e.clientY - scrollState.mousePos.y
          scrollArea.scrollTop += delta
          dispatch({
            type: 'UPDATE_SCROLL',
            verticalDelta: delta,
            clientHeight: scrollArea.clientHeight,
            clientWidth: scrollArea.clientWidth,
          })
        }
        if (scrollDirection === 'horizontal' || scrollDirection === 'all') {
          const delta = e.clientX - scrollState.mousePos.x
          scrollArea.scrollLeft += delta
          dispatch({
            type: 'UPDATE_SCROLL',
            horizontalDelta: delta,
            clientHeight: scrollArea.clientHeight,
            clientWidth: scrollArea.clientWidth,
          })
        }
      }
    },
    [scrollState, scrollDirection]
  )

  const handleThumbMouseDown = (e: ReactMouseEvent, direction: 'vertical' | 'horizontal') => {
    e.preventDefault()
    dispatch({
      type: 'SET_DRAG',
      isDragging: true,
      dragDirection: direction,
      mousePos: { x: e.clientX, y: e.clientY },
    })
  }

  const handleMouseUp = () => {
    dispatch({
      type: 'SET_DRAG',
      isDragging: false,
      dragDirection: null,
    })
  }

  const handleMouseOver = () => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const needsVerticalScroll = scrollArea.scrollHeight > scrollArea.clientHeight
    const needsHorizontalScroll = scrollArea.scrollWidth > scrollArea.clientWidth

    if (needsVerticalScroll || needsHorizontalScroll) {
      dispatch({ type: 'SET_ACTIVE', value: true })
    }
  }

  const handleMouseLeave = () => {
    if (visibility !== 'always' && !scrollState.isDragging) {
      dispatch({ type: 'SET_ACTIVE', value: false })
    }
  }

  const scrollByPercentage = useCallback((percentage: number) => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      const scrollAmount = scrollArea.scrollWidth * percentage
      scrollArea.scrollLeft += scrollAmount

      dispatch({
        type: 'UPDATE_SCROLL',
        horizontalDelta: scrollArea.scrollLeft,
        clientHeight: scrollArea.clientHeight,
        clientWidth: scrollArea.clientWidth,
      })
    }
  }, [])

  const handleLeftArrowClick = useCallback(() => {
    scrollByPercentage(-0.15)
  }, [scrollByPercentage])

  const handleRightArrowClick = useCallback(() => {
    scrollByPercentage(0.15)
  }, [scrollByPercentage])

  useEventListener('scroll', handleScroll, scrollAreaRef)
  useEventListener('scrollend', debouncedScrollEnd, scrollAreaRef)
  useEventListener('wheel', handleScroll, scrollAreaRef, { passive: true })
  useEventListener('mousemove', handleMouseMove, documentRef)
  useEventListener('mouseup', handleMouseUp, documentRef)
  useEventListener('mouseover', handleMouseOver, scrollWrapperRef)
  useEventListener('mouseleave', handleMouseLeave, scrollWrapperRef)

  return (
    <div
      className={clsx(scroll_area_wrapper, {
        [wrapperClassName]: wrapperClassName,
        ['overflow_hidden']: scrollWrapperOverflow === 'hidden',
      })}
      ref={scrollWrapperRef}
      id={wrapperId}
    >
      {arrows && scrollDirection !== 'vertical' && leftArrowVisible && (
        <div className={clsx(scroll_arrow, 'left')} onClick={handleLeftArrowClick}>
          <TbChevronLeft />
        </div>
      )}

      <div
        ref={(el) => {
          scrollAreaRef.current = el
          if (ref) {
            ref.current = el
          }
        }}
        className={clsx({ [className]: className }, scroll_area[scrollDirection])}
        {...props}
        id={id}
      >
        {children}
      </div>

      {arrows && scrollDirection !== 'vertical' && rightArrowVisible && (
        <div className={clsx(scroll_arrow, 'right')} onClick={handleRightArrowClick}>
          <TbChevronRight />
        </div>
      )}

      {visibility !== 'hidden' && (scrollDirection === 'vertical' || scrollDirection === 'all') && (
        <Scrollbar
          active={scrollState.active || visibility === 'always'}
          size={scrollState.verticalThumbSize}
          position={scrollState.verticalThumbPosition}
          onMouseDown={(e) => handleThumbMouseDown(e, 'vertical')}
          scrollDirection='vertical'
        />
      )}

      {visibility !== 'hidden' && (scrollDirection === 'horizontal' || scrollDirection === 'all') && (
        <Scrollbar
          active={scrollState.active || visibility === 'always'}
          size={scrollState.horizontalThumbSize}
          position={scrollState.horizontalThumbPosition}
          onMouseDown={(e) => handleThumbMouseDown(e, 'horizontal')}
          scrollDirection='horizontal'
        />
      )}
    </div>
  )
}

export default ScrollArea
