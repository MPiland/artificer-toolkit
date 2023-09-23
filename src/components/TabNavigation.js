import '../css/tabNavigation.css'
import { useCallback, useEffect } from 'react'
import { startCase } from 'lodash'
const TabNavigation = ({
  tabState,
  tabContent,
  id,
  onDelete,
  onAdd,
  dynamic,
}) => {
  let tab
  let pane
  let currentTab
  let currentPane

  const leftPosition = useCallback(() => {
    const wrapper = document.getElementById(`${id}-nav-tabs-wrapper`)
    const tabContainer = document.getElementById(`${id}-nav-tabs`)
    if (!wrapper || !tabContainer) {
      return 0
    } else {
      const containerLeft = tabContainer.getBoundingClientRect().x
      const wrapperLeft = wrapper.getBoundingClientRect().x
      return containerLeft - wrapperLeft
    }
  }, [id])

  const widthOfHidden = useCallback(() => {
    const wrapper = document.getElementById(`${id}-nav-tabs-wrapper`)
    const tabContainer = document.getElementById(`${id}-nav-tabs`)
    if (!wrapper || !tabContainer) {
      return 0
    } else {
      const tabContainerWidth = tabContainer.getBoundingClientRect().width
      const wrapperWidth = wrapper.getBoundingClientRect().width
      if (tabContainerWidth > wrapperWidth) {
        return tabContainerWidth - wrapperWidth + leftPosition()
      } else {
        return 0
      }
    }
  }, [id, leftPosition])

  const scrollRight = () => {
    const tabContainer = document.getElementById(`${id}-nav-tabs`)
    if (widthOfHidden() - 90 < 0 && widthOfHidden() !== 0) {
      tabContainer.style.left = leftPosition() - widthOfHidden() + 'px'
      document.getElementById(`${id}-scroll-right`).hidden = true
    } else if (widthOfHidden() !== 0) {
      tabContainer.style.left = leftPosition() - 90 + 'px'
    }
    document.getElementById(`${id}-scroll-left`).hidden = false
  }

  const scrollLeft = () => {
    const tabContainer = document.getElementById(`${id}-nav-tabs`)
    if (leftPosition() + 90 > -1) {
      tabContainer.style.left = 0
      document.getElementById(`${id}-scroll-left`).hidden = true
    } else if (leftPosition() !== 0) {
      tabContainer.style.left = leftPosition() + 90 + 'px'
    }
    document.getElementById(`${id}-scroll-right`).hidden = false
  }

  useEffect(() => {
    const leftScroller = document.getElementById(`${id}-scroll-left`)
    const rightScroller = document.getElementById(`${id}-scroll-right`)
    if (leftScroller) {
      leftScroller.hidden = true
    }
    if (rightScroller) {
      rightScroller.hidden = false
      if (widthOfHidden() <= 0) {
        rightScroller.hidden = true
      }
    }
  }, [id, leftPosition, widthOfHidden])

  const activeTab = useCallback(() => {
    const tabs = document.getElementsByClassName(`${id}-nav-link`)
    for (let tab of tabs) {
      if (tab.classList.contains('active')) {
        return tab
      }
    }

    return null
  }, [id])

  const activePane = () => {
    const panes = document.getElementsByClassName(`${id}-tab-pane`)
    for (let pane of panes) {
      if (pane.classList.contains('active')) {
        return pane
      }
    }

    return null
  }

  useEffect(() => {
    let currentTab = activeTab()
    let currentPane
    if (tabState?.length > 0 && !currentTab) {
      currentTab = document.getElementById(`${id}${0}Tab`)
      currentPane = document.getElementById(`${id}${0}TabPane`)
      currentTab.classList.toggle('active')
      currentTab.setAttribute('aria-selected', 'true')
      currentPane.classList.toggle('active')
      currentPane.classList.toggle('show')
    }
  }, [activeTab, id, tabState])

  const addTab = async () => {
    await onAdd({ type: 'added', payload: { target: { name: id } } })

    let index
    if (tabState?.length > 0) {
      index = tabState?.length
    } else {
      index = 0
    }

    if (index !== 0) {
      currentTab = activeTab()
      currentPane = activePane()
      currentTab.classList.toggle('active')
      currentTab.setAttribute('aria-selected', 'false')
      currentPane.classList.toggle('active')
      currentPane.classList.toggle('show')
    }

    tab = document.getElementById(`${id}${index}Tab`)
    pane = document.getElementById(`${id}${index}TabPane`)

    tab.classList.add('active')
    tab.setAttribute('aria-selected', 'true')
    pane.classList.add('active')
    pane.classList.add('show')
    pane.focus()
  }

  const deleteTab = async (e, index) => {
    e.stopPropagation()
    currentTab = activeTab()
    currentPane = activePane()

    if (index === tabState?.length - 1 && tabState?.length !== 1) {
      tab = document.getElementById(`${id}${index - 1}Tab`)
      pane = document.getElementById(`${id}${index - 1}TabPane`)
      tab.classList.toggle('active')
      tab.setAttribute('aria-selected', 'true')
      pane.classList.toggle('show')
      pane.classList.toggle('active')
    }
    await onDelete({
      type: 'removed',
      payload: { target: { name: `${id}.${index}` } },
    })
  }

  const content = (
    <>
      {onAdd && (
        <div className='d-flex pb-3 justify-content-between'>
          <button
            className='btn btn-secondary me-2'
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
          <div className='nav-tabs-wrapper' id={`${id}-nav-tabs-wrapper`}>
            <div
              className='left-scroller'
              id={`${id}-scroll-left`}
              onClick={scrollLeft}
            >
              <i className='bi bi-chevron-left' />
            </div>
            <div
              className='right-scroller'
              id={`${id}-scroll-right`}
              onClick={scrollRight}
            >
              <i className='bi bi-chevron-right' />
            </div>
            <div className='nav nav-tabs' id={`${id}-nav-tabs`} role='tablist'>
              {tabState.map((tabItem, tabIndex) => (
                <button
                  className={`nav-link ${id}-nav-link section-nav-link`}
                  role='tab'
                  id={`${id}${tabIndex}Tab`}
                  key={`${id}${tabIndex}Tab`}
                  data-bs-toggle='tab'
                  data-bs-target={`#${id}${tabIndex}TabPane`}
                  type='button'
                  aria-selected='true'
                  aria-controls={`#${id}${tabIndex}TabPane`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {tabItem.value !== '' && !!tabItem.value
                    ? tabItem.value
                    : `${startCase(id)} ${tabIndex}`}
                  {dynamic && (
                    <i
                      className='bi bi-x delete-nav-link'
                      value={tabIndex}
                      onClick={(e) => {
                        deleteTab(e, tabIndex)
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className='tab-content' id='nav-tabContent'>
            <>
              {tabContent.map((pane, paneIndex) => (
                <div
                  className={`tab-pane ${id}-tab-pane section-tab-pane fade`}
                  id={`${id}${paneIndex}TabPane`}
                  aria-labelledby={`${id}${paneIndex}Tab`}
                  key={`${id}${paneIndex}Tab`}
                  role='tabpanel'
                  tabIndex='0'
                >
                  {pane}
                </div>
              ))}
            </>
          </div>
        </nav>
      )}
    </>
  )

  return content
}

export default TabNavigation
