import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  memo,
} from 'react'
import Spinner from '../Spinner'
import PaneContainer from './PaneContainer'
import TabWrapper from './TabWrapper'
import TabContainer from './TabContainer'
import Tab from './Tab'
import Pane from './Pane'

const TabNavigation = ({
  tabState,
  contentState,
  id,
  setState,
  dynamic,
  reorder,
}) => {
  const [leftPosition, setLeftPosition] = useState(0)
  const [hiddenWidth, setHiddenWidth] = useState(0)
  const [tabContWidth, setTabContWidth] = useState()
  const [wrapperWidth, setWrapperWidth] = useState()
  const [tabStateLength, setTabStateLength] = useState({
    [id]: tabState?.length,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [sectionTabs, setSectionTabs] = useState([{}])

  const wrapperRef = useRef()
  const tabContainerRef = useRef()
  const paneContainerRef = useRef()
  const leftScrollerRef = useRef()
  const rightScrollerRef = useRef()
  const activeTabRef = useRef()
  const activePaneRef = useRef()

  const getActive = () => {
    if (tabContainerRef.current) {
      const tabs = tabContainerRef.current?.children
      const panes = paneContainerRef.current?.children

      for (let tab of tabs) {
        if (tab.classList.contains('active')) {
          activeTabRef.current = tab
        }
      }

      for (let pane of panes) {
        if (pane.classList.contains('active')) {
          activePaneRef.current = pane
        }
      }
    }
  }

  const handleClick = (id, tabIndex) => {
    getActive()

    const tab = document.getElementById(`${id}${tabIndex}Tab`)
    const pane = document.getElementById(`${id}${tabIndex}Pane`)

    if (activeTabRef.current !== tab) {
      activeTabRef.current.classList.remove('active')
      activeTabRef.current.setAttribute('aria-expanded', 'false')
      activePaneRef.current.classList.remove('active')
      activePaneRef.current.classList.remove('show')
      tab.classList.add('active')
      tab.setAttribute('aria-expanded', 'true')
      pane.classList.add('active')
      pane.classList.add('show')
      activeTabRef.current = tab
      activePaneRef.current = pane
      tab.focus()
    }
  }

  const scrollTab = useCallback(() => {
    let activeTabIndex
    if (tabContainerRef.current) {
      activeTabIndex = Array.from(tabContainerRef.current?.children).findIndex(
        (tab) => tab.classList.contains('active')
      )
    }

    if (activeTabIndex !== -1) {
      const tabRight =
        tabContainerRef.current?.children[
          activeTabIndex
        ].getBoundingClientRect().right
      const wrapperRight = wrapperRef.current?.getBoundingClientRect().right
      const tabLeft =
        tabContainerRef.current?.children[
          activeTabIndex
        ].getBoundingClientRect().left
      const wrapperLeft = wrapperRef.current?.getBoundingClientRect().left

      let newLeftPosition

      if (tabRight > wrapperRight) {
        if (activeTabIndex === tabStateLength - 1) {
          newLeftPosition = leftPosition + hiddenWidth[id]
        } else {
          newLeftPosition =
            leftPosition +
            (tabRight - wrapperRight) +
            rightScrollerRef.current?.getBoundingClientRect().width
        }
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`
      }
      if (
        tabLeft - leftScrollerRef.current?.getBoundingClientRect().width <
        wrapperLeft
      ) {
        if (activeTabIndex === 0) {
          newLeftPosition = 0
        } else {
          newLeftPosition =
            leftPosition -
            (wrapperLeft - tabLeft) -
            leftScrollerRef.current?.getBoundingClientRect().width
        }
        setLeftPosition(newLeftPosition)
        tabContainerRef.current.style.left = `-${newLeftPosition}px`
      }
    }
    if (tabContainerRef.current && activeTabIndex) {
      tabContainerRef.current?.children?.item(activeTabIndex)?.scrollIntoView({
        behavior: 'smooth',
      })
    }
  }, [id, hiddenWidth, leftPosition, tabStateLength])

  useLayoutEffect(() => {
    if (tabContainerRef.current && !activeTabRef.current) {
      tabContainerRef.current?.firstChild.setAttribute('aria-selected', 'true')
      tabContainerRef.current?.firstChild.classList.add('active')
      paneContainerRef.current?.firstChild.classList.add('active')
      paneContainerRef.current?.firstChild.classList.add('show')
      activeTabRef.current = tabContainerRef.current?.firstChild
      activePaneRef.current = paneContainerRef.current?.firstChild
    }

    if (id !== 'main') {
      getActive()
      const tabs = tabContainerRef.current?.children
      const panes = paneContainerRef.current?.children
      if (
        tabState?.length !== tabStateLength ||
        (tabState?.length === 1 && !activeTabRef.current)
      ) {
        if (id !== 'details' && id !== 'feature' && id !== 'specialization') {
          if (tabs) {
            for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
              const tab = tabs[tabIndex]
              const pane = panes[tabIndex]
              const txt = tab.textContent || tab.innerText
              if (!sectionTabs.includes(txt)) {
                setSectionTabs((prev) => [...prev, txt])
                if (activeTabRef.current) {
                  activeTabRef.current?.setAttribute('aria-selected', 'false')
                  activeTabRef.current?.classList.remove('active')
                  activePaneRef.current?.classList.remove('active')
                  activePaneRef.current?.classList.remove('show')
                }
                tab.setAttribute('aria-selected', 'true')
                tab.classList.add('active')
                activeTabRef.current = tab
                if (pane) {
                  pane.classList.add('active')
                  pane.classList.add('show')
                  activePaneRef.current = pane
                }
              }
            }
          }
        } else {
          if (tabs) {
            const tab = tabs[tabState.length - 1]
            const pane = panes[tabState.length - 1]
            if (activeTabRef.current) {
              activeTabRef.current?.setAttribute('aria-selected', 'false')
              activeTabRef.current?.classList.remove('active')
              activePaneRef.current?.classList.remove('active')
              activePaneRef.current?.classList.remove('show')
            }
            tab.setAttribute('aria-selected', 'true')
            tab.classList.add('active')
            activeTabRef.current = tab
            if (pane) {
              pane.classList.add('active')
              pane.classList.add('show')
              activePaneRef.current = pane
            }
          }
        }
      }
    }

    if (paneContainerRef.current) {
      if (tabStateLength !== tabState.length) {
        scrollTab()
      }
    }
    setTabStateLength(tabState ? tabState.length : 0)
  }, [
    id,
    tabStateLength,
    tabState,
    leftPosition,
    tabContWidth,
    wrapperWidth,
    sectionTabs,
    scrollTab,
  ])

  useEffect(() => {
    const minHiddenWidthThreshold = 0.1

    if (wrapperRef.current && tabContainerRef.current) {
      const wrapper = wrapperRef.current
      const tabContainer = tabContainerRef.current

      if (tabState.length > 0) {
        setWrapperWidth(wrapper.getBoundingClientRect().width)
        setTabContWidth(tabContainer.getBoundingClientRect().width)
      }

      if (leftScrollerRef.current) {
        if (leftPosition > 0) {
          leftScrollerRef.current?.classList.add('show')
          leftScrollerRef.current?.classList.remove('hide')
        } else {
          leftScrollerRef.current?.classList.add('hide')
          leftScrollerRef.current?.classList.remove('show')
        }
      }

      if (rightScrollerRef.current) {
        if (hiddenWidth[id] > 0) {
          if (hiddenWidth[id] < minHiddenWidthThreshold) {
            rightScrollerRef.current?.classList.remove('show')
            rightScrollerRef.current?.classList.add('hide')
          } else {
            rightScrollerRef.current?.classList.add('show')
            rightScrollerRef.current?.classList.remove('hide')
          }
        } else {
          rightScrollerRef.current?.classList.add('hide')
          rightScrollerRef.current?.classList.remove('show')
        }
      }
    }

    const newHiddenWidth = tabContWidth - wrapperWidth - leftPosition
    setHiddenWidth((prevHiddenWidth) => ({
      ...prevHiddenWidth,
      [id]: newHiddenWidth,
    }))
  }, [
    tabContWidth,
    wrapperWidth,
    leftPosition,
    id,
    hiddenWidth,
    tabState?.length,
  ])

  const scrollRight = () => {
    let newLeftPosition

    if (hiddenWidth[id] > 90) {
      newLeftPosition = leftPosition + 90
    } else if (hiddenWidth[id] > 0) {
      newLeftPosition = leftPosition + hiddenWidth[id]
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

  const deleteTab = async (name, index) => {
    let activeIndex

    if (index === tabState.length - 1) {
      activeIndex = index - 1
    } else {
      activeIndex = index
    }

    activeTabRef.current?.classList.remove('active')
    activeTabRef.current?.setAttribute('aria-selected', 'false')
    activePaneRef.current?.classList.remove('active')
    activePaneRef.current?.classList.remove('show')
    const txt =
      activeTabRef.current?.textContent || activeTabRef.current?.innerText
    if (txt && sectionTabs.includes(txt)) {
      setSectionTabs((prev) => prev.filter((prevItem) => prevItem !== txt))
    }

    if (index !== 0) {
      const tabs = tabContainerRef.current?.children
      const panes = paneContainerRef.current?.children
      const tab = tabs.item(activeIndex)
      const pane = panes.item(activeIndex)
      tab.classList.add('active')
      tab.setAttribute('aria-selected', 'true')
      if (pane) {
        pane.classList.add('show')
        pane.classList.add('active')
        activeTabRef.current = tab
        activePaneRef.current = pane
      }
    }
    try {
      await setState({
        type: 'removed',
        payload: { target: { name: `${name}` } },
      })
    } finally {
      if (index !== 0) {
        setTimeout(() => {
          activePaneRef.current?.scrollIntoView()
        }, 0)
        const tabContainerRight =
          tabContainerRef.current?.getBoundingClientRect().right
        const wrapperRight = wrapperRef.current?.getBoundingClientRect().right

        if (tabContainerRight < wrapperRight) {
          const newLeftPosition =
            leftPosition -
            (wrapperRight - tabContainerRight) +
            rightScrollerRef.current?.getBoundingClientRect().width
          setLeftPosition(newLeftPosition)
          tabContainerRef.current.style.left = `-${newLeftPosition}px`
        }
      }
    }
  }

  let content

  if (!tabState) {
    content = <Spinner />
  }

  content = (
    <>
      {tabState?.length > 0 && (
        <nav className='tabMain mb-2' id={`${id}TabContent`}>
          <TabWrapper
            wrapperRef={wrapperRef}
            leftScrollerRef={leftScrollerRef}
            rightScrollerRef={rightScrollerRef}
            id={id}
            scrollLeft={scrollLeft}
            scrollRight={scrollRight}
          >
            <TabContainer
              id={id}
              tabState={tabState}
              tabContainerRef={tabContainerRef}
              setIsScrolling={setIsScrolling}
              isDragging={isDragging}
              tabContWidth={tabContWidth}
              wrapperWidth={wrapperWidth}
              leftPosition={leftPosition}
              setLeftPosition={setLeftPosition}
              isMouseDown={isMouseDown}
              setIsMouseDown={setIsMouseDown}
              setState={setState}
              contentState={contentState}
            >
              {tabState.map(
                (tabItem, tabIndex) =>
                  tabItem && (
                    <Fragment key={`${tabIndex}`}>
                      <Tab
                        key={tabIndex}
                        id={id}
                        tabIndex={tabIndex}
                        tabItem={tabItem}
                        scrollTab={scrollTab}
                        deleteTab={deleteTab}
                        handleClick={handleClick}
                        isScrolling={isScrolling}
                        isDragging={isDragging}
                        setIsScrolling={setIsScrolling}
                        setIsDragging={setIsDragging}
                        dynamic={dynamic}
                        isMouseDown={isMouseDown}
                        setIsMouseDown={setIsMouseDown}
                        reorder={reorder}
                      />
                    </Fragment>
                  )
              )}
            </TabContainer>
          </TabWrapper>
          <PaneContainer
            id={id}
            tabState={tabState}
            paneContainerRef={paneContainerRef}
          >
            {tabState.map(
              (tabItem, tabIndex) =>
                tabItem && (
                  <Fragment key={`${tabIndex}`}>
                    <Pane id={id} tabIndex={tabIndex} tabItem={tabItem} />
                  </Fragment>
                )
            )}
          </PaneContainer>
        </nav>
      )}
    </>
  )

  return content
}

const memoizedTabNavigation = memo(TabNavigation)

export default memoizedTabNavigation
