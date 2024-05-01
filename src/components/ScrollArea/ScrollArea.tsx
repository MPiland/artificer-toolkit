import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  memo,
  useLayoutEffect,
  ComponentPropsWithoutRef,
  forwardRef,
  ForwardedRef,
} from 'react'
import clsx from 'clsx'
import {
  scroll_area,
  scroll_area_wrapper,
  scroll_arrow,
  scroll_bar_horizontal,
  scroll_bar_vertical,
  scroll_thumb_horizontal,
  scroll_thumb_vertical,
} from './ScrollArea.css'

interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  className?: string | number | symbol | any
  wrapperClassName?: string | number | symbol | any
  scrollDirection: 'horizontal' | 'vertical' | 'all' | 'none'
  visibility?: 'hidden' | 'visible' | 'always'
  arrows: boolean
  [key: string]: any
  scrollWrapperOverflow?: 'hidden' | 'off'
}

import { useEventListener, useMediaQuery } from 'usehooks-ts'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'

const SCROLL_BOX_MIN_HEIGHT = 20
const SCROLL_BOX_MIN_WIDTH = 20

const ScrollArea = memo(
  forwardRef(
    (
      {
        children,
        className,
        wrapperClassName,
        scrollDirection,
        visibility = 'visible',
        scrollWrapperOverflow = 'hidden',
        id,
        arrows = false,
        ...props
      }: ScrollAreaProps,
      ref: ForwardedRef<HTMLDivElement>
    ) => {
      const md = useMediaQuery('(max-width: 1023px)')

      const [vertScrollThumbHeight, setVertScrollThumbHeight] = useState<number>(SCROLL_BOX_MIN_HEIGHT)
      const [vertScrollThumbPosition, setVertScrollThumbPosition] = useState<number>(0)
      const [vertScrollThumbTop, setVertScrollThumbTop] = useState<number>(0)
      const [horzScrollThumbWidth, setHorzScrollThumbWidth] = useState<number>(SCROLL_BOX_MIN_WIDTH)
      const [horzScrollThumbPosition, setHorzScrollThumbPosition] = useState<number>(0)
      const [horzScrollThumbLeft, setHorzScrollThumbLeft] = useState<number>(0)
      const [isDragging, setIsDragging] = useState<boolean>(false)
      const [vertNoOverflow, setVertNoOverflow] = useState<boolean>(true)
      const [horzNoOverflow, setHorzNoOverflow] = useState<boolean>(true)
      const [active, setActive] = useState<boolean>()
      const [leftScroll, setLeftScroll] = useState<boolean>(false)
      const [rightScroll, setRightScroll] = useState<boolean>(false)
      const scrollAreaRef = useRef<HTMLDivElement | null>(null)
      const vertScrollThumbRef = useRef<HTMLDivElement>(null)
      const horzScrollThumbRef = useRef<HTMLDivElement>(null)
      const scrollWrapperRef = useRef<HTMLDivElement>(null)
      const documentRef = useRef<Document>(document)

      useLayoutEffect(() => {
        const scrollWrapper = scrollWrapperRef.current
        const scrollArea = scrollAreaRef.current
        if (scrollArea && scrollWrapper) {
          const handleResize = (entries: Array<ResizeObserverEntry>) => {
            entries.forEach((entry) => {
              const { scrollLeft, scrollWidth, clientWidth, scrollHeight, clientHeight } = entry.target
              const hasHorizontalOverflow = scrollWidth > clientWidth
              const hasVerticalOverflow = scrollHeight > clientHeight

              if (scrollDirection === 'all' || scrollDirection === 'vertical') {
                if (hasVerticalOverflow) {
                  setVertNoOverflow(!hasVerticalOverflow)
                  const scrollThumbPercentage = clientHeight / scrollHeight

                  const vertScrollThumbHeight = Math.max(scrollThumbPercentage * clientHeight, SCROLL_BOX_MIN_HEIGHT)

                  setVertScrollThumbHeight(vertScrollThumbHeight)
                }
              } else {
                setVertNoOverflow(true)
              }
              if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
                setHorzNoOverflow(!hasHorizontalOverflow)
                if (hasHorizontalOverflow) {
                  if (arrows) {
                    if (scrollLeft > 0 && !leftScroll) {
                      setLeftScroll(true)
                    }
                    if (Math.round(scrollLeft) + 1 < scrollWidth - clientWidth && !rightScroll) {
                      setRightScroll(true)
                    }
                  }
                  const scrollThumbPercentage = clientWidth / scrollWidth

                  const horzScrollThumbWidth = Math.max(scrollThumbPercentage * clientWidth, SCROLL_BOX_MIN_WIDTH)

                  setHorzScrollThumbWidth(horzScrollThumbWidth)
                }
              } else {
                setHorzNoOverflow(true)
              }
            })
          }

          const observer = new ResizeObserver(handleResize)

          if (scrollArea) {
            observer.observe(scrollArea)
          }

          return () => observer.disconnect()
        }
      }, [md, scrollDirection, children, arrows, leftScroll, rightScroll])

      const handleMouseOver = useCallback(() => {
        if (vertScrollThumbRef.current || horzScrollThumbRef.current) {
          setActive(true)
        }
      }, [])

      const handleMouseLeave = useCallback(() => {
        if (vertScrollThumbRef.current || horzScrollThumbRef.current) {
          setActive(false)
        }
      }, [])

      const handleMouseUp = useCallback(() => {
        setIsDragging(false)
      }, [])

      const handleMouseMove = useCallback(
        (e: MouseEvent) => {
          if (isDragging) {
            e.stopPropagation()
            const scrollArea = scrollAreaRef.current
            if (scrollArea) {
              if (scrollDirection === 'all' || scrollDirection === 'vertical') {
                const deltaY = e.clientY - vertScrollThumbPosition
                const vertPercentage = deltaY * (scrollArea.scrollHeight / scrollArea.offsetHeight)

                setVertScrollThumbPosition(e.clientY)
                setVertScrollThumbTop(
                  Math.min(Math.max(0, vertScrollThumbTop + deltaY), scrollArea.offsetHeight - vertScrollThumbHeight)
                )
                scrollArea.scrollTop = Math.min(
                  scrollArea.scrollTop + vertPercentage,
                  scrollArea.scrollHeight - scrollArea.offsetHeight
                )
              }
              if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
                const deltaX = e.clientX - horzScrollThumbPosition
                const horzPercentage = deltaX * (scrollArea.scrollWidth / scrollArea.offsetWidth)

                setHorzScrollThumbPosition(e.clientX)
                setHorzScrollThumbLeft(
                  Math.min(Math.max(0, horzScrollThumbLeft + deltaX), scrollArea.offsetWidth - horzScrollThumbWidth)
                )
                scrollArea.scrollLeft = Math.min(
                  scrollArea.scrollLeft + horzPercentage,
                  scrollArea.scrollWidth - scrollArea.offsetWidth
                )
              }
            }
          }
        },
        [
          isDragging,
          vertScrollThumbPosition,
          vertScrollThumbHeight,
          vertScrollThumbTop,
          horzScrollThumbPosition,
          horzScrollThumbWidth,
          horzScrollThumbLeft,
          scrollDirection,
        ]
      )

      const handleScrollThumbMouseDown = useCallback(
        (e: ReactMouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          if (scrollDirection === 'all' || scrollDirection === 'vertical') {
            setVertScrollThumbPosition(e.clientY)
          }
          if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
            setHorzScrollThumbPosition(e.clientX)
          }
          setIsDragging(true)
        },
        [scrollDirection]
      )

      const handleScrollEnd = () => {
        scrollTimer = setTimeout(() => {
          if (visibility !== 'always') setActive(false)
        }, 750)
      }

      let scrollTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
        null
      })

      const handleScroll = useCallback(() => {
        const scrollArea = scrollAreaRef.current
        if (scrollArea) {
          const { scrollTop, scrollLeft, scrollHeight, offsetHeight, offsetWidth, scrollWidth, clientWidth } =
            scrollArea
          clearTimeout(scrollTimer)
          setActive(true)
          if (scrollDirection === 'all' || scrollDirection === 'vertical') {
            let newTop = (parseInt(String(scrollTop), 10) / parseInt(String(scrollHeight), 10)) * offsetHeight
            newTop = Math.min(newTop, offsetHeight - vertScrollThumbHeight)
            setVertScrollThumbTop(newTop)
          }
          if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
            if (arrows) {
              setLeftScroll(scrollLeft > 0)
              setRightScroll(Math.round(scrollLeft) + 1 < scrollWidth - clientWidth)
            }
            let newLeft = (parseInt(String(scrollLeft), 10) / parseInt(String(scrollWidth), 10)) * offsetWidth
            newLeft = Math.min(newLeft, offsetWidth - horzScrollThumbWidth)
            setHorzScrollThumbLeft(newLeft)
          }
        }
      }, [arrows, scrollDirection, horzScrollThumbWidth, vertScrollThumbHeight, scrollTimer])

      const scrollByPercentage = useCallback(
        (percentage: number) => {
          const scrollArea = scrollAreaRef.current
          if (scrollArea) {
            const scrollAmount = scrollArea.scrollWidth * percentage
            scrollArea.scrollLeft += scrollAmount
            handleScroll()
          }
        },
        [handleScroll]
      )

      const handleLeftArrowClick = useCallback(() => {
        scrollByPercentage(-0.15) // Scroll left by 15%
      }, [scrollByPercentage])

      const handleRightArrowClick = useCallback(() => {
        scrollByPercentage(0.15) // Scroll right by 15%
      }, [scrollByPercentage])

      useEventListener('scroll', handleScroll, scrollAreaRef)
      useEventListener('scrollend', handleScrollEnd, scrollAreaRef)
      useEventListener('wheel', handleScroll, scrollAreaRef)
      useEventListener('mousemove', handleMouseMove, documentRef)
      useEventListener('mouseup', handleMouseUp, documentRef)
      useEventListener('mouseleave', handleMouseUp, documentRef)
      useEventListener('mouseover', handleMouseOver, scrollWrapperRef)
      useEventListener('mouseleave', handleMouseLeave, scrollWrapperRef)

      return (
        <div
          className={clsx(scroll_area_wrapper, {
            [wrapperClassName]: wrapperClassName,
            ['overflow_hidden']: scrollWrapperOverflow === 'hidden',
          })}
          ref={scrollWrapperRef}
        >
          {arrows && !horzNoOverflow && leftScroll && (
            <div className={clsx(scroll_arrow, 'left')} onClick={handleLeftArrowClick}>
              <TbChevronLeft />
            </div>
          )}
          <div
            ref={(el) => {
              scrollAreaRef.current = el
              if (ref) {
                if (typeof ref === 'function') {
                  ref(el)
                } else {
                  ref.current = el
                }
              }
            }}
            className={clsx({ [className]: className }, scroll_area[scrollDirection])}
            {...props}
            id={id}
          >
            {children}
          </div>
          {arrows && !horzNoOverflow && rightScroll && (
            <div className={clsx(scroll_arrow, 'right')} onClick={handleRightArrowClick}>
              <TbChevronRight />
            </div>
          )}
          {!vertNoOverflow && visibility !== 'hidden' && (
            <div
              className={clsx(scroll_bar_vertical, {
                ['active']: active || visibility === 'always',
              })}
            >
              <div
                ref={vertScrollThumbRef}
                className={scroll_thumb_vertical}
                style={{
                  height: `${vertScrollThumbHeight}px`,
                  top: vertScrollThumbTop,
                }}
                onMouseDown={handleScrollThumbMouseDown}
              />
            </div>
          )}
          {!horzNoOverflow && visibility !== 'hidden' && (
            <div
              className={clsx(scroll_bar_horizontal, {
                ['active']: active || visibility === 'always',
              })}
            >
              <div
                ref={horzScrollThumbRef}
                className={scroll_thumb_horizontal}
                style={{
                  width: `${horzScrollThumbWidth}px`,
                  left: horzScrollThumbLeft,
                }}
                onMouseDown={handleScrollThumbMouseDown}
              />
            </div>
          )}
        </div>
      )
    }
  )
)

ScrollArea.displayName = 'ScrollArea'

export default ScrollArea
