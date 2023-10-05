import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { startCase } from 'lodash'
const TabNavigation = ({ tabState, id, onDelete, onAdd, dynamic }) => {
  const [leftPosition, setLeftPosition] = useState(0)
  const [hiddenWidth, setHiddenWidth] = useState(0)
  const [tabContWidth, setTabContWidth] = useState()
  const [wrapperWidth, setWrapperWidth] = useState()
  const [tabContLeftPos, setTabContLeftPos] = useState()
  const [wrapperLeftPos, setWrapperLeftPos] = useState()
  const [tabStateLength, setTabStateLength] = useState(
    tabState ? tabState.length : 0
  )
  const [touchStartX, setTouchStartX] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const wrapperRef = useRef(null)
  const tabContainerRef = useRef(null)
  const paneContainerRef = useRef(null)
  const leftScrollerRef = useRef(null)
  const rightScrollerRef = useRef(null)
  const currentTabRef = useRef(null)
  const currentPaneRef = useRef(null)

  const getActive = () => {
    if (tabContainerRef.current) {
      const tabs = tabContainerRef.current.children
      const panes = paneContainerRef.current.children

      for (let tab of tabs) {
        if (tab.classList.contains('active')) {
          currentTabRef.current = tab
        }
      }

      for (let pane of panes) {
        if (pane.classList.contains('active')) {
          currentPaneRef.current = pane
        }
      }
    }
  }

  useLayoutEffect(() => {
    const minHiddenWidthThreshold = 0.1
    wrapperRef.current = document.getElementById(`${id}-nav-tabs-wrapper`)
    tabContainerRef.current = document.getElementById(`${id}-nav-tabs`)
    paneContainerRef.current = document.getElementById(`${id}-tabContent`)
    leftScrollerRef.current = document.getElementById(`${id}-scroll-left`)
    rightScrollerRef.current = document.getElementById(`${id}-scroll-right`)

    if (wrapperRef.current && tabContainerRef.current) {
      const wrapper = wrapperRef.current
      const tabContainer = tabContainerRef.current

      setWrapperWidth(wrapper.getBoundingClientRect().width)
      setWrapperLeftPos(wrapper.getBoundingClientRect().x)
      setTabContWidth(tabContainer.getBoundingClientRect().width)
      setTabContLeftPos(tabContainer.getBoundingClientRect().x)

      const newHiddenWidth = tabContWidth - wrapperWidth - leftPosition
      setHiddenWidth(newHiddenWidth)

      if (leftScrollerRef.current) {
        if (leftPosition > 0) {
          leftScrollerRef.current.classList.add('show')
          leftScrollerRef.current.classList.remove('hide')
        } else {
          leftScrollerRef.current.classList.add('hide')
          leftScrollerRef.current.classList.remove('show')
        }
      }

      if (rightScrollerRef.current) {
        if (hiddenWidth > 0) {
          if (hiddenWidth < minHiddenWidthThreshold) {
            rightScrollerRef.current.classList.remove('show')
            rightScrollerRef.current.classList.add('hide')
          } else {
            rightScrollerRef.current.classList.add('show')
            rightScrollerRef.current.classList.remove('hide')
          }
        } else {
          rightScrollerRef.current.classList.add('hide')
          rightScrollerRef.current.classList.remove('show')
        }
      }
    }

    if (tabContainerRef.current && !currentTabRef.current) {
      tabContainerRef.current.firstChild.setAttribute('aria-selected', 'true')
      tabContainerRef.current.firstChild.classList.add('active')
      paneContainerRef.current.firstChild.classList.add('active')
      paneContainerRef.current.firstChild.classList.add('show')
      currentTabRef.current = tabContainerRef.current.firstChild
      currentPaneRef.current = paneContainerRef.current.firstChild
    }

    if (id !== 'main' && id !== 'feature' && id !== 'details') {
      getActive()
      console.log('id', id)
      const tabs = tabContainerRef.current.children
      const panes = paneContainerRef.current.children
      if (tabs && currentTabRef.current) {
        if (tabs.item(tabState.length - 1) !== currentTabRef.current) {
          currentTabRef.current.setAttribute('aria-selected', 'false')
          currentTabRef.current.classList.remove('active')
          currentPaneRef.current.classList.remove('active')
          currentPaneRef.current.classList.remove('show')
          tabs.item(tabState.length - 1).setAttribute('aria-selected', 'true')
          tabs.item(tabState.length - 1).classList.add('active')
          panes.item(tabState.length - 1).classList.add('active')
          panes.item(tabState.length - 1).classList.add('show')
          currentTabRef.current = tabs.item(tabState.length - 1)
          currentPaneRef.current = panes.item(tabState.length - 1)
        }
      }
    }
    setTabStateLength(tabState ? tabState.length : 0)
  }, [
    id,
    tabStateLength,
    tabState,
    hiddenWidth,
    leftPosition,
    tabContWidth,
    wrapperWidth,
    tabContLeftPos,
    wrapperLeftPos,
  ])

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return

    const currentX = e.touches[0].clientX
    const deltaX = touchStartX - currentX

    // Calculate the maximum allowed position
    const maxLeftPosition = tabContWidth - wrapperWidth

    // Calculate the new left position
    let newLeftPosition = leftPosition + deltaX

    // Ensure it doesn't exceed the maximum or go below zero
    newLeftPosition = Math.max(0, Math.min(maxLeftPosition, newLeftPosition))

    // Adjust the scrolling based on the touch movement
    setLeftPosition(newLeftPosition)
    tabContainerRef.current.style.left = `-${newLeftPosition}px`

    // Update the touch start position for the next move event
    setTouchStartX(currentX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleMouseDown = (e) => {
    setTouchStartX(e.clientX)
    setIsDragging(true)
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return

    const currentX = e.clientX
    const deltaX = touchStartX - currentX

    // Calculate the maximum allowed position
    const maxLeftPosition = tabContWidth - wrapperWidth

    // Calculate the new left position
    let newLeftPosition = leftPosition + deltaX

    // Ensure it doesn't exceed the maximum or go below zero
    newLeftPosition = Math.max(0, Math.min(maxLeftPosition, newLeftPosition))

    // Adjust the scrolling based on the mouse movement
    setLeftPosition(newLeftPosition)
    tabContainerRef.current.style.left = `-${newLeftPosition}px`

    // Update the touch start position for the next move event
    setTouchStartX(currentX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const scrollRight = () => {
    let newLeftPosition

    if (hiddenWidth > 90) {
      newLeftPosition = leftPosition + 90
    } else if (hiddenWidth > 0) {
      newLeftPosition = leftPosition + hiddenWidth
    }

    if (newLeftPosition !== undefined) {
      setLeftPosition(newLeftPosition)
      tabContainerRef.current.style.left = `-${newLeftPosition}px`
    }
  }

  const scrollLeft = () => {
    let newLeftPosition

    if (leftPosition > 90) {
      newLeftPosition = leftPosition - 90
    } else if (leftPosition > 0) {
      newLeftPosition = 0
    }

    if (newLeftPosition !== undefined) {
      setLeftPosition(newLeftPosition)
      tabContainerRef.current.style.left = `-${newLeftPosition}px`
    }
  }

  const addTab = async () => {
    try {
      await onAdd({ type: 'added', payload: { target: { name: id } } })
    } catch (err) {
      console.log(err.message)
    } finally {
      getActive()

      if (currentTabRef.current) {
        currentTabRef.current.classList.remove('active')
        currentTabRef.current.setAttribute('aria-selected', 'false')
        currentPaneRef.current.classList.remove('active')
        currentPaneRef.current.classList.remove('show')
      }

      let index
      if (tabState?.length > 0) {
        index = tabState?.length
      } else {
        index = 0
      }
      const tab = tabContainerRef.current.children.item(index)
      const pane = paneContainerRef.current.children.item(index)
      tab.classList.add('active')
      tab.setAttribute('aria-selected', 'true')
      pane.classList.add('show')
      pane.classList.add('active')
      currentTabRef.current = tab
      currentPaneRef.current = pane

      scrollTab()
    }
  }

  const deleteTab = async (name, index) => {
    let activeIndex

    if (index === tabState.length - 1) {
      activeIndex = index - 1
    } else {
      activeIndex = index
    }

    currentTabRef.current.classList.remove('active')
    currentTabRef.current.setAttribute('aria-selected', 'false')
    currentPaneRef.current.classList.remove('active')
    currentPaneRef.current.classList.remove('show')

    if (index !== 0) {
      const tabs = tabContainerRef.current.children
      const panes = paneContainerRef.current.children
      const tab = tabs.item(activeIndex)
      const pane = panes.item(activeIndex)
      tab.classList.add('active')
      tab.setAttribute('aria-selected', 'true')
      pane.classList.add('show')
      pane.classList.add('active')
      currentTabRef.current = tab
      currentPaneRef.current = pane
    }
    try {
      await onDelete({
        type: 'removed',
        payload: { target: { name: `${name}` } },
      })
    } finally {
      if (index !== 0) {
        setTimeout(() => {
          currentPaneRef.current.scrollIntoView()
        }, 0)
        const tabContainerRight =
          tabContainerRef.current.getBoundingClientRect().right
        const wrapperRight = wrapperRef.current.getBoundingClientRect().right

        if (tabContainerRight < wrapperRight) {
          const newLeftPosition =
            leftPosition -
            (wrapperRight - tabContainerRight) +
            rightScrollerRef.current.getBoundingClientRect().width
          setLeftPosition(newLeftPosition)
          tabContainerRef.current.style.left = `-${newLeftPosition}px`
        }
      }
    }
  }

  const scrollTab = () => {
    const activeTabIndex = Array.from(
      tabContainerRef.current.children
    ).findIndex((tab) => tab.classList.contains('active'))

    if (activeTabIndex !== -1) {
      const tabRight =
        tabContainerRef.current.children[activeTabIndex].getBoundingClientRect()
          .right
      const wrapperRight = wrapperRef.current.getBoundingClientRect().right
      const tabLeft =
        tabContainerRef.current.children[activeTabIndex].getBoundingClientRect()
          .left
      const wrapperLeft = wrapperRef.current.getBoundingClientRect().left

      let newLeftPosition

      if (tabRight > wrapperRight) {
        if (activeTabIndex === tabStateLength - 1) {
          newLeftPosition = leftPosition + hiddenWidth
        } else {
          newLeftPosition =
            leftPosition +
            (tabRight - wrapperRight) +
            rightScrollerRef.current.getBoundingClientRect().width
        }
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`
      }
      if (
        tabLeft - leftScrollerRef.current.getBoundingClientRect().width <
        wrapperLeft
      ) {
        if (activeTabIndex === 0) {
          newLeftPosition = 0
        } else {
          newLeftPosition =
            leftPosition -
            (wrapperLeft - tabLeft) -
            leftScrollerRef.current.getBoundingClientRect().width
        }
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`
      }
    }
    tabContainerRef.current.children.item(activeTabIndex).scrollIntoView({
      behavior: 'smooth',
    })
  }

  const content = (
    <>
      {onAdd && (
        <div className='row g-2 px-3 pb-2 justify-content-between'>
          <button
            className='btn btn-secondary col-auto'
            name='feature'
            type='button'
            onClick={() => {
              addTab()
            }}
          >
            {`Add ${startCase(id)}`}
          </button>
        </div>
      )}
      {tabState?.length > 0 && (
        <nav className='tabMain mb-2' id={`${id}TabContent`}>
          <div
            className='nav-tabs-wrapper'
            id={`${id}-nav-tabs-wrapper`}
            ref={wrapperRef}
          >
            <div
              className='left-scroller hide'
              id={`${id}-scroll-left`}
              onClick={scrollLeft}
              ref={leftScrollerRef}
            >
              <span>
                <i className='bi bi-chevron-left' />
              </span>
            </div>
            <div
              className='right-scroller hide'
              id={`${id}-scroll-right`}
              onClick={scrollRight}
              ref={rightScrollerRef}
            >
              <span>
                <i className='bi bi-chevron-right' />
              </span>
            </div>
            <div
              className='nav nav-tabs'
              id={`${id}-nav-tabs`}
              role='tablist'
              ref={tabContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {tabState.map(
                (tabItem, tabIndex) =>
                  tabItem && (
                    <Fragment key={`${tabIndex}`}>
                      <button
                        className={`nav-link ${id}-nav-link category-nav-link`}
                        role='tab'
                        id={`${id}${tabIndex}Tab`}
                        data-bs-toggle='tab'
                        data-bs-target={`#${id}${tabIndex}TabPane`}
                        type='button'
                        aria-selected='false'
                        aria-controls={`${id}${tabIndex}TabPane`}
                        onClick={() => scrollTab()}
                      >
                        {startCase(tabItem?.value)}
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
                    </Fragment>
                  )
              )}
            </div>
          </div>
          <div
            className='tab-content'
            id={`${id}-tabContent`}
            ref={paneContainerRef}
          >
            {tabState.map(
              (tabItem, tabIndex) =>
                tabItem && (
                  <Fragment key={`${tabIndex}`}>
                    <div
                      className={`tab-pane ${id}-tab-pane category-tab-pane fade`}
                      id={`${id}${tabIndex}TabPane`}
                      aria-labelledby={`${id}${tabIndex}Tab`}
                      role='tabpanel'
                      tabIndex='0'
                    >
                      {tabItem?.content}
                    </div>
                  </Fragment>
                )
            )}
          </div>
        </nav>
      )}
    </>
  )

  return content
}

export default TabNavigation
