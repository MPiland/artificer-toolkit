import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  memo,
  ComponentPropsWithoutRef,
  forwardRef,
  ForwardedRef,
  useEffect,
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
import { useEventListener } from 'usehooks-ts'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'

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

const SCROLL_BOX_MIN_SIZE = 20

const ScrollArea = memo(
  forwardRef(
    (
      {
        children,
        className,
        wrapperClassName,
        scrollDirection = 'vertical',
        visibility = 'visible',
        scrollWrapperOverflow = 'hidden',
        id,
        wrapperId,
        arrows = false,
        ...props
      }: ScrollAreaProps,
      ref: ForwardedRef<HTMLDivElement>
    ) => {
      const scrollAreaRef = useRef<HTMLDivElement | null>(null)
      const vertThumbRef = useRef<HTMLDivElement>(null)
      const horzThumbRef = useRef<HTMLDivElement>(null)
      const documentRef = useRef<Document>(document)
      const scrollWrapperRef = useRef<HTMLDivElement | null>(null)

      const [vertThumbHeight, setVertThumbHeight] = useState<number>(SCROLL_BOX_MIN_SIZE)
      const [vertThumbTop, setVertThumbTop] = useState<number>(0)
      const [vertThumbPosition, setVertThumbPosition] = useState<number>(0)
      const [horzThumbWidth, setHorzThumbWidth] = useState<number>(SCROLL_BOX_MIN_SIZE)
      const [horzThumbLeft, setHorzThumbLeft] = useState<number>(0)
      const [horzThumbPosition, setHorzThumbPosition] = useState<number>(0)
      const [isDragging, setIsDragging] = useState<boolean>(false)
      const [active, setActive] = useState<boolean>(false)
      const [leftScroll, setLeftScroll] = useState<boolean>(false)
      const [rightScroll, setRightScroll] = useState<boolean>(false)

      let scrollTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
        null
      })

      const updateThumbSizes = useCallback(() => {
        const scrollArea = scrollAreaRef.current
        if (!scrollArea) return

        const { scrollWidth, clientWidth, scrollHeight, clientHeight } = scrollArea

        if (scrollDirection === 'all' || scrollDirection === 'vertical') {
          const scrollThumbPercentage = clientHeight / scrollHeight
          const newVertScrollThumbHeight =
            scrollHeight > clientHeight ? Math.max(scrollThumbPercentage * clientHeight, SCROLL_BOX_MIN_SIZE) : 0
          setVertThumbHeight(newVertScrollThumbHeight)
        }

        if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
          const scrollThumbPercentage = clientWidth / scrollWidth
          const newHorzScrollThumbWidth =
            scrollWidth > clientWidth ? Math.max(scrollThumbPercentage * clientWidth, SCROLL_BOX_MIN_SIZE) : 0
          setHorzThumbWidth(newHorzScrollThumbWidth)
        }
      }, [scrollDirection])

      useEffect(() => {
        const scrollArea = scrollAreaRef.current
        if (scrollArea) {
          const handleResize = () => {
            updateThumbSizes()
          }

          const observer = new ResizeObserver(handleResize)
          observer.observe(scrollArea)

          // Observe children for changes
          Array.from(scrollArea.children).forEach((child) => {
            observer.observe(child)
          })

          return () => {
            observer.disconnect()
          }
        }
      }, [updateThumbSizes])

      useEffect(() => {
        updateThumbSizes()
      }, [updateThumbSizes])

      const handleScroll = useCallback(() => {
        const scrollArea = scrollAreaRef.current
        if (!scrollArea) return

        const { scrollLeft, scrollWidth, clientWidth, scrollTop, scrollHeight, clientHeight } = scrollArea

        clearTimeout(scrollTimer)
        setActive(true)
        if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
          if (arrows) {
            setLeftScroll(scrollLeft > 0)
            setRightScroll(Math.round(scrollLeft) + clientWidth < scrollWidth)
          }
          const newHorzScrollThumbLeft =
            scrollWidth > clientWidth ? (scrollLeft / (scrollWidth - clientWidth)) * (clientWidth - horzThumbWidth) : 0
          setHorzThumbLeft(newHorzScrollThumbLeft)
        }
        if (scrollDirection === 'all' || scrollDirection === 'vertical') {
          const newVertScrollThumbTop =
            scrollHeight > clientHeight
              ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - vertThumbHeight)
              : 0
          setVertThumbTop(newVertScrollThumbTop)
        }
      }, [arrows, scrollDirection, horzThumbWidth, vertThumbHeight, scrollTimer])

      const handleScrollEnd = () => {
        if (!isDragging) {
          scrollTimer = setTimeout(() => {
            if (visibility !== 'always') {
              setActive(false)
            }
          }, 750)
        }
      }

      const handleMouseOver = () => {
        updateThumbSizes()
        setActive(true)
      }

      const handleMouseLeave = () => {
        if (visibility !== 'always' && !isDragging) {
          setActive(false)
        }
      }

      const handleMouseMove = useCallback(
        (e: MouseEvent) => {
          if (isDragging) {
            const scrollArea = scrollAreaRef.current
            if (!scrollArea) return

            const { offsetHeight, scrollHeight, offsetWidth, scrollWidth } = scrollArea

            clearTimeout(scrollTimer)
            if (scrollDirection === 'all' || scrollDirection === 'vertical') {
              const deltaY = e.clientY - vertThumbPosition
              const scrollPercentage = deltaY * (scrollHeight / offsetHeight)
              setVertThumbPosition(e.clientY)
              setVertThumbTop(Math.min(Math.max(0, vertThumbTop + deltaY), offsetHeight - vertThumbHeight))
              scrollArea.scrollTop = Math.min(scrollArea.scrollTop + scrollPercentage, scrollHeight - offsetHeight)
            }

            if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
              const deltaX = e.clientX - horzThumbPosition
              const scrollPercentage = deltaX * (scrollWidth / offsetWidth)
              setHorzThumbPosition(e.clientX)
              setHorzThumbLeft(Math.min(Math.max(0, horzThumbLeft + deltaX), offsetWidth - horzThumbWidth))
              scrollArea.scrollLeft = Math.min(scrollArea.scrollLeft + scrollPercentage, scrollWidth - offsetWidth)
            }
          }
        },
        [
          isDragging,
          scrollDirection,
          vertThumbPosition,
          horzThumbPosition,
          horzThumbLeft,
          vertThumbTop,
          horzThumbWidth,
          vertThumbHeight,
          scrollTimer,
        ]
      )

      const handleMouseUp = () => {
        setIsDragging(false)
      }

      const handleThumbMouseDown = (e: ReactMouseEvent) => {
        e.preventDefault()
        if (scrollDirection === 'all' || scrollDirection === 'vertical') {
          setVertThumbPosition(e.clientY)
        }
        if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
          setHorzThumbPosition(e.clientX)
        }
        setIsDragging(true)
      }

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
          ref={(el) => (scrollWrapperRef.current = el)}
          id={wrapperId}
        >
          {arrows && horzThumbWidth > 0 && leftScroll && (
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
          {arrows && horzThumbWidth > 0 && rightScroll && (
            <div className={clsx(scroll_arrow, 'right')} onClick={handleRightArrowClick}>
              <TbChevronRight />
            </div>
          )}
          {visibility !== 'hidden' &&
            scrollDirection !== 'horizontal' &&
            scrollDirection !== 'none' &&
            vertThumbHeight > 0 && (
              <div
                className={clsx(scroll_bar_vertical, {
                  ['active']: active || visibility === 'always',
                })}
              >
                <div
                  ref={vertThumbRef}
                  className={scroll_thumb_vertical}
                  style={{
                    height: `${vertThumbHeight}px`,
                    top: `${vertThumbTop}px`,
                  }}
                  onMouseDown={handleThumbMouseDown}
                />
              </div>
            )}
          {visibility !== 'hidden' &&
            scrollDirection !== 'vertical' &&
            scrollDirection !== 'none' &&
            horzThumbWidth > 0 && (
              <div
                className={clsx(scroll_bar_horizontal, {
                  ['active']: active || visibility === 'always',
                })}
              >
                <div
                  ref={horzThumbRef}
                  className={scroll_thumb_horizontal}
                  style={{
                    width: `${horzThumbWidth}px`,
                    left: `${horzThumbLeft}px`,
                  }}
                  onMouseDown={handleThumbMouseDown}
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
