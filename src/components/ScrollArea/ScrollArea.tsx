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
  scroll_bar_vertical,
  scroll_thumb,
} from './ScrollArea.css'

interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  className?: string | number | symbol | any
  wrapperClassName?: string | number | symbol | any
  scrollDirection: 'horizontal' | 'vertical' | 'all'
  visibility?: 'hidden' | 'visible'
  [key: string]: any
}

import { useEventListener, useMediaQuery } from 'usehooks-ts'

const SCROLL_BOX_MIN_HEIGHT = 20

const ScrollArea = memo(
  ({
    children,
    className,
    wrapperClassName,
    scrollDirection,
    visibility = 'hidden',
    ...props
  }: ScrollAreaProps) => {
    const md = useMediaQuery('(max-width: 1023px)')

    const [scrollThumbHeight, setScrollThumbHeight] = useState<number>(
      SCROLL_BOX_MIN_HEIGHT
    )
    const [scrollThumbPosition, setScrollThumbPosition] = useState<number>(0)
    const [scrollThumbTop, setScrollThumbTop] = useState<number>(0)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [noOverflow, setNoOverflow] = useState<boolean>(true)
    const [mouseOver, setMouseOver] = useState<boolean>(false)
    const [active, setActive] = useState<boolean>()
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const scrollThumbRef = useRef<HTMLDivElement>(null)
    const scrollWrapperRef = useRef<HTMLDivElement>(null)
    const documentRef = useRef<Document>(document)

    let scrollTimer: ReturnType<typeof setTimeout>

    useLayoutEffect(() => {
      const scrollArea = scrollAreaRef.current
      const handleResize = (entries: Array<ResizeObserverEntry>) => {
        entries.forEach(() => {
          if (scrollArea) {
            if (scrollArea?.scrollHeight > scrollArea?.clientHeight) {
              setNoOverflow(false)
              const scrollThumbPercentage =
                scrollArea.clientHeight / scrollArea.scrollHeight

              const scrollThumbHeight = Math.max(
                scrollThumbPercentage * scrollArea.clientHeight,
                SCROLL_BOX_MIN_HEIGHT
              )
              setScrollThumbHeight(scrollThumbHeight)
            } else {
              setNoOverflow(true)
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
    }, [md])

    const handleMouseOver = useCallback(() => {
      if (scrollThumbRef.current) {
        setActive(true)
        setMouseOver(true)
      }
    }, [])

    const handleMouseLeave = useCallback(() => {
      if (scrollThumbRef.current) {
        setActive(false)
        setMouseOver(false)
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
            const deltaY = e.clientY - scrollThumbPosition
            const percentage =
              deltaY * (scrollArea.scrollHeight / scrollArea.offsetHeight)

            setScrollThumbPosition(e.clientY)
            setScrollThumbTop(
              Math.min(
                Math.max(0, scrollThumbTop + deltaY),
                scrollArea.offsetHeight - scrollThumbHeight
              )
            )
            scrollArea.scrollTop = Math.min(
              scrollArea.scrollTop + percentage,
              scrollArea.scrollHeight - scrollArea.offsetHeight
            )
          }
        }
      },
      [isDragging, scrollThumbPosition, scrollThumbHeight, scrollThumbTop]
    )

    const handleScrollThumbMouseDown = useCallback((e: ReactMouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setScrollThumbPosition(e.clientY)
      setIsDragging(true)
    }, [])

    const handleScroll = () => {
      const scrollArea = scrollAreaRef.current
      if (scrollArea) {
        if (mouseOver && noOverflow === false) {
          setActive(true)
        }
        clearTimeout(scrollTimer)
        let newTop =
          (parseInt(String(scrollArea.scrollTop), 10) /
            parseInt(String(scrollArea.scrollHeight), 10)) *
          scrollArea.offsetHeight
        newTop = Math.min(newTop, scrollArea.offsetHeight - scrollThumbHeight)
        setScrollThumbTop(newTop)
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
        <div
          className={clsx(scroll_bar_vertical, {
            ['active']: (active || visibility === 'visible') && !noOverflow,
          })}
        >
          <div
            ref={scrollThumbRef}
            className={scroll_thumb}
            style={{
              height: `${scrollThumbHeight}px`,
              top: scrollThumbTop,
            }}
            onMouseDown={handleScrollThumbMouseDown}
          />
        </div>
      </div>
    )
  }
)

ScrollArea.displayName = 'ScrollArea'

export default ScrollArea
