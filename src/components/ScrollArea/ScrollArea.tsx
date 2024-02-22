import {
  FC,
  ReactNode,
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  memo,
  useLayoutEffect,
  useEffect,
} from 'react'
import clsx from 'clsx'
import {
  scroll_area,
  scroll_area_wrapper,
  scroll_bar_vertical,
  scroll_thumb,
} from './ScrollArea.css'

interface ScrollAreaProps {
  children: ReactNode
  className?: string | number | symbol | any
  scrollDirection: 'horizontal' | 'vertical' | 'all'
  visibility?: 'hidden' | 'visible'
}
import { useEventListener, useMediaQuery } from 'usehooks-ts'

const SCROLL_BOX_MIN_HEIGHT = 20

const ScrollArea: FC<ScrollAreaProps> = memo(
  ({ children, className, scrollDirection = 'all', visibility = 'hidden' }) => {
    const md = useMediaQuery('(max-width: 1023px)')

    const [scrollThumbHeight, setScrollThumbHeight] = useState<number>(
      SCROLL_BOX_MIN_HEIGHT
    )
    const [scrollThumbPosition, setScrollThumbPosition] = useState<number>(0)
    const [scrollThumbTop, setScrollThumbTop] = useState<number>(0)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [isScrolling, setIsScrolling] = useState<boolean>(false)
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

    useEffect(() => {
      if (
        (isScrolling || visibility === 'visible' || mouseOver || md) &&
        noOverflow === false
      ) {
        setActive(true)
      } else {
        setActive(false)
      }
    }, [md, isScrolling, visibility, mouseOver, noOverflow])

    const handleMouseOver = useCallback(() => {
      if (scrollThumbRef.current) {
        setMouseOver(true)
      }
    }, [])

    const handleMouseLeave = useCallback(() => {
      if (scrollThumbRef.current) {
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

    const handleScroll = useCallback(() => {
      if (!scrollAreaRef) {
        return
      }
      const scrollArea = scrollAreaRef.current
      if (scrollArea) {
        let newTop =
          (parseInt(String(scrollArea.scrollTop), 10) /
            parseInt(String(scrollArea.scrollHeight), 10)) *
          scrollArea.offsetHeight
        // newTop = newTop + parseInt(scrollTop, 10);
        newTop = Math.min(newTop, scrollArea.offsetHeight - scrollThumbHeight)
        setScrollThumbTop(newTop)
      }
    }, [scrollThumbHeight])

    const handleScrollStart = () => {
      const scrollArea = scrollAreaRef.current
      if (
        scrollArea &&
        (scrollArea.scrollTop === 0 ||
          scrollArea.scrollTop + scrollArea.clientHeight >=
            scrollArea.scrollHeight)
      ) {
        return setIsScrolling(false)
      }
      setIsScrolling(true)
      clearTimeout(scrollTimer)
    }

    const handleScrollEnd = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        setIsScrolling(false)
      }, 100) // Adjust the delay as needed
    }

    useEventListener('scroll', handleScroll, scrollAreaRef)
    useEventListener('scroll', handleScrollStart, scrollAreaRef)
    useEventListener('wheel', handleScrollStart, scrollAreaRef)
    useEventListener('scrollend', handleScrollEnd, scrollAreaRef)
    useEventListener('scroll', handleScrollEnd, scrollAreaRef)
    useEventListener('mousemove', handleMouseMove, documentRef)
    useEventListener('mouseup', handleMouseUp, documentRef)
    useEventListener('mouseleave', handleMouseUp, documentRef)
    useEventListener('mouseover', handleMouseOver, scrollWrapperRef)
    useEventListener('mouseleave', handleMouseLeave, scrollWrapperRef)

    return (
      <div className={scroll_area_wrapper} ref={scrollWrapperRef}>
        <div
          ref={scrollAreaRef}
          className={clsx(
            { [className]: className },
            scroll_area[scrollDirection]
          )}
        >
          {children}
        </div>
        <div
          className={clsx(scroll_bar_vertical, {
            ['active']: active,
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
