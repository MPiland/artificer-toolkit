import { useDrop } from 'react-dnd'
import { useState, useRef, useEffect, useCallback } from 'react'

const DRAG_THRESHOLD = 5

const TabContainer = ({
  id,
  tabState,
  tabContainerRef,
  isDragging,
  setIsScrolling,
  tabContWidth,
  wrapperWidth,
  leftPosition,
  setLeftPosition,
  children,
  isMouseDown,
  setIsMouseDown,
  setState,
  contentState,
}) => {
  const [touchStartX, setTouchStartX] = useState(null)

  const isMouseDownRef = useRef(isMouseDown)
  const isDraggingRef = useRef(isDragging)

  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  const handleDrop = (item, monitor) => {
    const reorderedTabs = [...contentState]
    const dragIndex = item.index
    const dropIndex = monitor.getClientOffset() // Client coordinates of the drop
    const name = item.name.split('.')

    name.pop()

    // Calculate the drop index based on the position within the container
    const boundingBox = tabContainerRef.current.getBoundingClientRect()
    const relativeDropIndex = dropIndex.x - boundingBox.left

    // Calculate the index based on the position within the container
    const newIndex = calculateDropIndex(relativeDropIndex)

    // Ensure the newIndex is within bounds
    const finalIndex = Math.max(0, Math.min(newIndex, tabState.length))

    // Remove the tab from its original index
    const [draggedTab] = reorderedTabs.splice(dragIndex, 1)

    // Insert the tab at the new index
    reorderedTabs.splice(finalIndex, 0, draggedTab)

    setState({ payload: { target: { name: name, value: reorderedTabs } } })

    return { index: finalIndex }
  }

  // Helper function to calculate the drop index based on the position
  const calculateDropIndex = (dropPosition) => {
    let cumulativeWidth = 0

    for (let i = 0; i < tabState.length; i++) {
      const tabWidth =
        tabContainerRef.current.children[i].getBoundingClientRect().width

      cumulativeWidth += tabWidth

      if (cumulativeWidth > dropPosition) {
        return i
      }
    }

    // If the drop position is beyond the last tab, return the last index
    return tabState.length - 1
  }

  const [, drop] = useDrop({
    accept: 'TAB',
    drop: handleDrop,
  })

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
    setIsMouseDown(true)
  }

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) {
      if (touchStartX !== null) {
        const currentX = e.touches[0].clientX
        const deltaX = touchStartX - currentX

        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          setIsScrolling(true)
        }

        // Calculate the maximum allowed position
        const maxLeftPosition = tabContWidth - wrapperWidth

        // Calculate the new left position
        let newLeftPosition = leftPosition + deltaX

        // Ensure it doesn't exceed the maximum or go below zero
        newLeftPosition = Math.max(
          0,
          Math.min(maxLeftPosition, newLeftPosition)
        )

        // Adjust the scrolling based on the touch movement
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`

        // Update the touch start position for the next move event
        setTouchStartX(currentX)
      }
    }
  }

  const handleTouchEnd = useCallback(() => {
    setIsScrolling(false)
    setTouchStartX(null)
    setIsMouseDown(false)
  }, [setIsMouseDown, setIsScrolling])

  const handleMouseDown = (e) => {
    setTouchStartX(e.clientX)
    setIsMouseDown(true)
  }

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) {
      if (touchStartX !== null) {
        const currentX = e.clientX
        const deltaX = touchStartX - currentX

        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          setIsScrolling(true)
        }

        // Calculate the maximum allowed position
        const maxLeftPosition = tabContWidth - wrapperWidth

        // Calculate the new left position
        let newLeftPosition = leftPosition + deltaX

        // Ensure it doesn't exceed the maximum or go below zero
        newLeftPosition = Math.max(
          0,
          Math.min(maxLeftPosition, newLeftPosition)
        )

        // Adjust the scrolling based on the mouse movement
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`

        // Update the touch start position for the next move event
        setTouchStartX(currentX)
      }
    }
  }

  const handleMouseUp = useCallback(() => {
    setIsScrolling(false)
    setTouchStartX(null)
    setIsMouseDown(false)
  }, [setIsMouseDown, setIsScrolling])

  useEffect(() => {
    isMouseDownRef.current = isMouseDown

    if (isMouseDownRef.current === false) {
      handleMouseUp()
    }
  }, [isMouseDown, handleMouseUp])

  const content = (
    <div
      className='nav nav-tabs'
      id={`${id}TabContainer`}
      role='tablist'
      ref={(node) => {
        tabContainerRef.current = node
        drop(node)
      }}
      onTouchStart={(e) => handleTouchStart(e)}
      onTouchMove={(e) => handleTouchMove(e)}
      onTouchEnd={(e) => handleTouchEnd(e)}
      onMouseDown={(e) => handleMouseDown(e)}
      onMouseMove={(e) => handleMouseMove(e)}
      onMouseUp={(e) => handleMouseUp(e)}
    >
      {children}
    </div>
  )

  return content
}

export default TabContainer
