import { useDrag } from 'react-dnd'
import { useEffect, useState, useRef, memo } from 'react'
const Tab = ({
  id,
  tabIndex,
  tabItem,
  scrollTab,
  deleteTab,
  handleClick,
  setIsDragging,
  isScrolling,
  isDragging,
  dynamic,
  isMouseDown,
  setIsMouseDown,
  reorder,
}) => {
  const [isTabDragging, setIsTabDragging] = useState(false)

  const isMouseDownRef = useRef(isMouseDown)
  const isScrollingRef = useRef(isScrolling)
  const isDraggingRef = useRef(isDragging)

  useEffect(() => {
    isScrollingRef.current = isScrolling
  }, [isScrolling])

  useEffect(() => {
    isMouseDownRef.current = isMouseDown
  }, [isMouseDown])

  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  const [, drag] = useDrag({
    type: 'TAB',
    item: { index: tabIndex, name: tabItem.name },
    canDrag:
      isDraggingRef.current === true &&
      isScrollingRef.current === false &&
      reorder === true,
    end: (_, monitor) => {
      const didDrop = monitor.didDrop()

      if (didDrop) {
        const { index } = monitor.getDropResult()
        handleClick(id, index)
      }

      setIsMouseDown(false)
      setIsDragging(false)
      setIsTabDragging(false)
    },
  })

  const handleMouseDown = (e) => {
    setTimeout(() => {
      if (
        !isScrollingRef.current &&
        isMouseDownRef.current &&
        reorder === true
      ) {
        setIsDragging(true)
        setIsTabDragging(true)
        setIsMouseDown(true)
      }
    }, 500)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsMouseDown(false)
    setIsTabDragging(false)
  }

  const content = (
    <>
      <button
        ref={drag}
        className={`nav-link ${id}-nav-link category-nav-link ${
          isTabDragging ? 'dragging' : ''
        }`}
        role='tab'
        id={`${id}${tabIndex}Tab`}
        type='button'
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        onClick={() => {
          if (!isScrolling && !isDragging) {
            handleClick(id, tabIndex)
            scrollTab()
          }
        }}
      >
        {tabItem?.value}
        {dynamic && (
          <i
            className='bi bi-x delete-nav-link'
            onClick={(e) => {
              e.stopPropagation()
              deleteTab(tabItem?.name, tabIndex)
            }}
          />
        )}
      </button>
    </>
  )

  return content
}

const memoizedTab = memo(Tab)

export default memoizedTab
