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
  const [activeTabIndex, setActiveTabIndex] = useState()

  const wrapperRef = useRef()
  const tabContainerRef = useRef()
  const paneContainerRef = useRef()
  const leftScrollerRef = useRef()
  const rightScrollerRef = useRef()
  
  const tabs = tabContainerRef.current && Array.from(tabContainerRef.current?.children)
  const panes = paneContainerRef.current && Array.from(paneContainerRef.current?.children)

  const getActive = useCallback(() => {
    if (tabs) {
      const activeIndex = tabs.findIndex((tab) => tab.classList.contains('active'));
  
      if (activeIndex !== -1) {
        setActiveTabIndex(activeIndex);
      }
    }
  }, [tabs])

  const handleClick = useCallback((id, tabIndex) => {
    getActive()

    const tab = tabs[tabIndex]
    const pane = panes[tabIndex]

    if (activeTabIndex !== tabIndex) {

      console.log('active tab', tabs[activeTabIndex])
      console.log('active pane', panes[activeTabIndex])

      tabs[activeTabIndex]?.classList.remove('active')
      tabs[activeTabIndex]?.setAttribute('aria-expanded', 'false')
      panes[activeTabIndex]?.classList.remove('active')
      panes[activeTabIndex]?.classList.remove('show')
      tab.classList.add('active')
      tab.setAttribute('aria-expanded', 'true')
      pane.classList.add('active')
      pane.classList.add('show')

      setActiveTabIndex(tabIndex)

      tab.focus()
    }

  }, [activeTabIndex, panes, tabs, getActive])

  const scrollTab = useCallback(() => {
    if (activeTabIndex && activeTabIndex !== -1) {
      const tabRight =
      tabs[activeTabIndex]?.getBoundingClientRect().right
      const wrapperRight = wrapperRef.current?.getBoundingClientRect().right
      const tabLeft =
      tabs[activeTabIndex]?.getBoundingClientRect().left
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
      tabs[activeTabIndex]?.scrollIntoView({
        behavior: 'smooth',
      })
    }
  }, [id, hiddenWidth, leftPosition, tabStateLength, activeTabIndex, tabs])

  useLayoutEffect(() => {
    if (tabs && !activeTabIndex) {
      tabs[0].setAttribute('aria-selected', 'true')
      tabs[0].classList.add('active')
      panes[0].classList.add('active')
      panes[0].classList.add('show')
      setActiveTabIndex(0)
    }

    if (id !== 'main') {
      getActive()
      if (
        tabState?.length !== tabStateLength ||
        (tabState?.length === 1 && !activeTabIndex)
      ) {
        if (id !== 'details' && id !== 'feature' && id !== 'specialization') {
          if (tabs) {
            for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
              const txt = tabs[tabIndex].textContent || tabs[tabIndex].innerText
              if (!sectionTabs.includes(txt)) {
                setSectionTabs((prev) => [...prev, txt])
                if (activeTabIndex) {
                  tabs[activeTabIndex]?.setAttribute('aria-selected', 'false')
                  tabs[activeTabIndex]?.classList.remove('active')
                  panes[activeTabIndex]?.classList.remove('active')
                  panes[activeTabIndex]?.classList.remove('show')
                }
                tabs[tabIndex].setAttribute('aria-selected', 'true')
                tabs[tabIndex].classList.add('active')
                if (panes[tabIndex]) {
                  panes[tabIndex].classList.add('active')
                  panes[tabIndex].classList.add('show')
                }
                setActiveTabIndex(tabIndex)
              }
            }
          }
        } else {
          if (tabs) {
            if (activeTabIndex) {
              tabs[activeTabIndex]?.setAttribute('aria-selected', 'false')
              tabs[activeTabIndex]?.classList.remove('active')
              panes[activeTabIndex]?.classList.remove('active')
              panes[activeTabIndex]?.classList.remove('show')
            }
            tabs[tabState.length - 1].setAttribute('aria-selected', 'true')
            tabs[tabState.length - 1].classList.add('active')
            setActiveTabIndex(tabState.length - 1)
            if (panes[tabState.length - 1]) {
              panes[tabState.length - 1].classList.add('active')
              panes[tabState.length - 1].classList.add('show')
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
    activeTabIndex,
    panes,
    tabs,
    getActive
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

  const scrollRight = useCallback(() => {
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
  }, [hiddenWidth, leftPosition, id])

  const scrollLeft = useCallback(() => {
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
  },[leftPosition])

  const deleteTab = useCallback(async (name, index) => {
    let activeIndex

    if (index === tabState.length - 1) {
      activeIndex = index - 1
    } else {
      activeIndex = index
    }

    tabs[activeIndex].classList.remove('active')
    tabs[activeIndex].setAttribute('aria-selected', 'false')
    panes[activeIndex].classList.remove('active')
    panes[activeIndex].classList.remove('show')
    const txt =
    tabs[activeIndex].textContent || tabs[activeIndex].innerText
    if (txt && sectionTabs.includes(txt)) {
      setSectionTabs((prev) => prev.filter((prevItem) => prevItem !== txt))
    }

    if (index !== 0) {
      const tab = tabs[activeIndex]
      const pane = panes[activeIndex]
      tab.classList.add('active')
      tab.setAttribute('aria-selected', 'true')
      if (pane) {
        pane.classList.add('show')
        pane.classList.add('active')
      }
      setActiveTabIndex(activeIndex)
    }
    try {
      await setState({
        type: 'removed',
        payload: { target: { name: `${name}` } },
      })
    } finally {
      if (index !== 0) {
        setTimeout(() => {
          panes[activeTabIndex]?.scrollIntoView()
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
  }, [leftPosition, sectionTabs, setState, tabState?.length, activeTabIndex, tabs, panes])

  let content

  if (!tabState) {
    return (content = <Spinner />)
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
