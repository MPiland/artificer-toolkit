import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  memo,
  useLayoutEffect,
  ComponentPropsWithoutRef,
} from 'react'
import clsx from 'clsx'
import {
  scroll_area,
  scroll_area_wrapper,
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
  visibility?: 'hidden' | 'visible'
  [key: string]: any
  scrollWrapperOverflow?: 'hidden' | 'off'
}

import { useEventListener, useMediaQuery } from 'usehooks-ts'

const SCROLL_BOX_MIN_HEIGHT = 20
const SCROLL_BOX_MIN_WIDTH = 20

const ScrollArea = memo(
  ({
    children,
    className,
    wrapperClassName,
    scrollDirection,
    visibility = 'hidden',
    scrollWrapperOverflow = 'hidden',
    ...props
  }: ScrollAreaProps) => {
    const md = useMediaQuery('(max-width: 1023px)')

    const [vertScrollThumbHeight, setVertScrollThumbHeight] = useState<number>(
      SCROLL_BOX_MIN_HEIGHT
    )
    const [vertScrollThumbPosition, setVertScrollThumbPosition] =
      useState<number>(0)
    const [vertScrollThumbTop, setVertScrollThumbTop] = useState<number>(0)
    const [horzScrollThumbWidth, setHorzScrollThumbWidth] =
      useState<number>(SCROLL_BOX_MIN_WIDTH)
    const [horzScrollThumbPosition, setHorzScrollThumbPosition] =
      useState<number>(0)
    const [horzScrollThumbLeft, setHorzScrollThumbLeft] = useState<number>(0)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [vertNoOverflow, setVertNoOverflow] = useState<boolean>(true)
    const [horzNoOverflow, setHorzNoOverflow] = useState<boolean>(true)
    const [active, setActive] = useState<boolean>()
    const scrollAreaRef = useRef<HTMLDivElement | null>(null)
    const vertScrollThumbRef = useRef<HTMLDivElement>(null)
    const horzScrollThumbRef = useRef<HTMLDivElement>(null)
    const scrollWrapperRef = useRef<HTMLDivElement>(null)
    const documentRef = useRef<Document>(document)

    let scrollTimer: ReturnType<typeof setTimeout>

    useLayoutEffect(() => {
      const scrollArea = scrollAreaRef.current
      const handleResize = (entries: Array<ResizeObserverEntry>) => {
        entries.forEach(() => {
          if (scrollArea) {
            if (
              (scrollDirection === 'all' || scrollDirection === 'vertical') &&
              scrollArea.scrollHeight > scrollArea.clientHeight
            ) {
              setVertNoOverflow(false)
              const scrollThumbPercentage =
                scrollArea.clientHeight / scrollArea.scrollHeight

              const vertScrollThumbHeight = Math.max(
                scrollThumbPercentage * scrollArea.clientHeight,
                SCROLL_BOX_MIN_HEIGHT
              )

              setVertScrollThumbHeight(vertScrollThumbHeight)
            } else {
              setVertNoOverflow(true)
            }
            if (
              (scrollDirection === 'all' || scrollDirection === 'horizontal') &&
              scrollArea.scrollWidth > scrollArea.clientWidth
            ) {
              setHorzNoOverflow(false)
              const scrollThumbPercentage =
                scrollArea.clientWidth / scrollArea.scrollWidth

              const horzScrollThumbWidth = Math.max(
                scrollThumbPercentage * scrollArea.clientWidth,
                SCROLL_BOX_MIN_WIDTH
              )

              setHorzScrollThumbWidth(horzScrollThumbWidth)
            } else {
              setHorzNoOverflow(true)
            }
          }
        })
      }
      const observer = new ResizeObserver(handleResize)

      if (scrollArea) {
        observer.observe(scrollArea)
        const scrollChildren = Array.from(scrollArea.children)
        scrollChildren.forEach((child) => {
          observer.observe(child)
        })
      }

      return () => observer.disconnect()
    }, [md, scrollDirection])

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
              const vertPercentage =
                deltaY * (scrollArea.scrollHeight / scrollArea.offsetHeight)

              setVertScrollThumbPosition(e.clientY)
              setVertScrollThumbTop(
                Math.min(
                  Math.max(0, vertScrollThumbTop + deltaY),
                  scrollArea.offsetHeight - vertScrollThumbHeight
                )
              )
              scrollArea.scrollTop = Math.min(
                scrollArea.scrollTop + vertPercentage,
                scrollArea.scrollHeight - scrollArea.offsetHeight
              )
            }
            if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
              const deltaX = e.clientX - horzScrollThumbPosition
              const horzPercentage =
                deltaX * (scrollArea.scrollWidth / scrollArea.offsetWidth)

              setHorzScrollThumbPosition(e.clientX)
              setHorzScrollThumbLeft(
                Math.min(
                  Math.max(0, horzScrollThumbLeft + deltaX),
                  scrollArea.offsetWidth - horzScrollThumbWidth
                )
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

    const handleScroll = () => {
      const scrollArea = scrollAreaRef.current
      if (scrollArea) {
        clearTimeout(scrollTimer)
        setActive(true)
        if (scrollDirection === 'all' || scrollDirection === 'vertical') {
          let newTop =
            (parseInt(String(scrollArea.scrollTop), 10) /
              parseInt(String(scrollArea.scrollHeight), 10)) *
            scrollArea.offsetHeight
          newTop = Math.min(
            newTop,
            scrollArea.offsetHeight - vertScrollThumbHeight
          )
          setVertScrollThumbTop(newTop)
        }
        if (scrollDirection === 'all' || scrollDirection === 'horizontal') {
          let newLeft =
            (parseInt(String(scrollArea.scrollLeft), 10) /
              parseInt(String(scrollArea.scrollWidth), 10)) *
            scrollArea.offsetWidth
          newLeft = Math.min(
            newLeft,
            scrollArea.offsetWidth - horzScrollThumbWidth
          )
          setHorzScrollThumbLeft(newLeft)
        }
      }
    }

    const handleScrollEnd = () => {
      scrollTimer = setTimeout(() => {
        setActive(false)
      }, 750)
    }

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
        <div
          ref={scrollAreaRef}
          className={clsx(
            { [className]: className },
            scroll_area[scrollDirection]
          )}
          {...props}
        >
          {children}
        </div>
        {!vertNoOverflow && (
          <div
            className={clsx(scroll_bar_vertical, {
              ['active']: active || visibility === 'visible',
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
        {!horzNoOverflow && (
          <div
            className={clsx(scroll_bar_horizontal, {
              ['active']: active || visibility === 'visible',
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

ScrollArea.displayName = 'ScrollArea'

export default ScrollArea
