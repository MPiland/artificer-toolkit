import {
  Tabs,
  Group,
  Button,
  Popover,
  UnstyledButton,
  ScrollArea,
  CloseButton,
} from '@mantine/core'
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  RefObject,
  ReactNode,
  FC,
} from 'react'
import { camelCase } from 'lodash'
import { TbX } from 'react-icons/tb'
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import Spinner from './Spinner/Spinner'
import style from '../css/DraggableTabs.module.css'

type Item = {
  value: string
  content: ReactNode
}

type SetActiveTab = (arg: string) => void

interface Action {
  type?: string
  payload: {
    target: {
      name?: string | string[]
      value?: any
    }
  }
}

interface SortableTabProps {
  item: Item
  remove: (arg: number) => void
  index: number
  dynamic?: boolean
  reorder?: boolean
  value: String
}

interface SelectOption {
  item: Item
  index: number
  remove: (arg: number) => void
  tabListRef: RefObject<HTMLDivElement | null | undefined>
  setActiveTab: SetActiveTab
  setOpened: (arg: any) => void
}

interface SelectOptionComponentProps {
  tabState: any
  scrollAreaRef: RefObject<HTMLDivElement | null | undefined>
  tabListRef: RefObject<HTMLDivElement | null | undefined>
  setActiveTab: SetActiveTab
  scrollAreaWidth: number
  remove: (arg: number) => void
}

interface DraggableTabsProps {
  tabState: any[]
  setState: (arg: Action) => void
  name: string
  state?: any
  dynamic?: boolean
  addButtonOptions?: [
    {
      name: string
      label: string
    }
  ]
  reorder?: boolean
}

const SortableTab = ({
  item,
  remove,
  index,
  dynamic,
  reorder,
}: SortableTabProps) => {
  const { attributes, listeners, setNodeRef } = useSortable({
    id: camelCase(item.value),
    disabled: reorder === true ? false : true,
  })

  return (
    <Tabs.Tab
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      className={[style['tab'], `${camelCase(item.value)}`].join(' ')}
      value={camelCase(item.value)}
      key={index}
      rightSection={
        dynamic ? (
          <CloseButton
            component='span'
            size={'xs'}
            onClick={(e) => {
              e.stopPropagation()
              remove(index)
            }}
          />
        ) : null
      }
    >
      {item.value}
    </Tabs.Tab>
  )
}

const SelectOption = ({
  item,
  index,
  remove,
  tabListRef,
  setActiveTab,
  setOpened,
}: SelectOption) => {
  const scrollToTab = () => {
    const tabList = tabListRef.current
    if (tabList) {
      // Find the index of the item in the tabState based on its ID
      const tabIndex = Array.from(tabList.children).findIndex((child) =>
        child.classList.contains(camelCase(item.value))
      )
      if (tabIndex !== -1) {
        tabListRef.current?.children[tabIndex].scrollIntoView({
          behavior: 'smooth',
        })
      }

      // Set the active tab
      setActiveTab(camelCase(item.value))
    }
  }

  return (
    <Group preventGrowOverflow={false} justify='space-between' key={index}>
      <UnstyledButton
        className={style['select-option']}
        onClick={() => {
          scrollToTab()
          setOpened((o: boolean) => !o)
        }}
      >
        {item.value}
      </UnstyledButton>
      <CloseButton
        component='span'
        size={'xs'}
        onClick={(e) => {
          e.stopPropagation()
          remove(index)
        }}
      />
    </Group>
  )
}

const SelectOptionComponent = ({
  tabState,
  scrollAreaRef,
  tabListRef,
  setActiveTab,
  scrollAreaWidth,
  remove,
}: SelectOptionComponentProps) => {
  const [opened, setOpened] = useState<boolean>(false)
  const [filteredOptions, setFilteredOptions] = useState<any[]>()

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    const tabList = tabListRef.current
    if (scrollArea && tabList) {
      const filterOptions = () => {
        const scrollAreaRect = scrollArea.children[0].getBoundingClientRect()
        const renderedElements = Array.from(tabList?.children)
          .filter((child) => {
            const rect = child.getBoundingClientRect()
            return (
              rect.left >= scrollAreaRect.left &&
              rect.right <= scrollAreaRect.right
            )
          })
          .map((child) => child)

        const filtereditems: any[] = Array.from(
          tabState.filter((item: Item) => {
            const isRendered = renderedElements.some((element) => {
              return element.classList.contains(camelCase(item.value))
            })
            return !isRendered
          })
        )
        setFilteredOptions(filtereditems)
      }
      if (scrollAreaWidth > 0) {
        filterOptions()
      }

      scrollArea.children[0].addEventListener('scroll', filterOptions)

      return () =>
        scrollArea.children[0].removeEventListener('scroll', filterOptions)
    }
  }, [tabState, scrollAreaRef, scrollAreaWidth, tabListRef])

  const options = filteredOptions?.map((item: Item, index: number) => {
    return (
      <SelectOption
        item={item}
        index={index}
        key={index}
        tabListRef={tabListRef}
        setActiveTab={setActiveTab}
        setOpened={setOpened}
        remove={remove}
      />
    )
  })

  return (
    <Popover opened={opened} onChange={setOpened}>
      <Popover.Target>
        <UnstyledButton
          className={style['tab-select-button']}
          onClick={() => setOpened((o) => !o)}
        >
          ...
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown className={'dropdown'}>{options}</Popover.Dropdown>
    </Popover>
  )
}

const DraggableTabs: FC<DraggableTabsProps> = ({
  tabState,
  setState,
  name,
  state,
  dynamic,
  addButtonOptions,
  reorder,
}) => {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(
    tabState && camelCase(tabState[0]?.value)
  )
  const [itemsLength, setitemsLength] = useState(
    tabState ? tabState?.length : 0
  )
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [startXState, setStartXState] = useState<number | null>(null)
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const [scrollAreaClass, setScrollAreaClass] = useState<string | null>(null)
  const [tabListWidth, setTabListWidth] = useState<number>(0)
  const [scrollAreaWidth, setScrollAreaWidth] = useState<number>(0)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const tabListRef = useRef<HTMLDivElement>(null)

  const sensor = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 0,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 0,
      },
    })
  )

  useEffect(() => {
    if (tabState?.length > 0 && activeTab == null) {
      setActiveTab(camelCase(tabState[0].value))
    }

    if (tabState?.length > itemsLength && name !== 'main') {
      const newActiveTab = camelCase(tabState[tabState?.length - 1]?.value)
      setActiveTab(newActiveTab)

      const tabIndex = tabState.findIndex(
        (item: Item) => camelCase(item.value) === newActiveTab
      )
      tabListRef.current?.children[tabIndex].scrollIntoView({
        behavior: 'smooth',
      })

      setitemsLength(tabState?.length)
    }
  }, [tabState, itemsLength, activeTab, name])

  useEffect(() => {
    if (tabState?.length > itemsLength && name !== 'main') {
      tabListRef.current?.children[tabState?.length - 1].scrollIntoView({
        behavior: 'smooth',
      })
      setActiveTab(camelCase(tabState[tabState?.length - 1].value))
      setitemsLength(tabState?.length)
    }
  }, [itemsLength, tabState, name])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current?.children[0]
      const observer = new ResizeObserver((entries) => {
        setScrollAreaWidth(entries[0].contentRect.width)
      })
      observer.observe(scrollArea)
      return () => scrollArea && observer.unobserve(scrollArea)
    }
  }, [])

  useEffect(() => {
    if (tabListRef.current) {
      const tabList = tabListRef.current
      const observer = new ResizeObserver((entries) => {
        setTabListWidth(entries[0].contentRect.width)
      })
      observer.observe(tabList)
      return () => tabList && observer.unobserve(tabList)
    }
  }, [])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current?.children[0]
      const isStart = scrollArea.scrollLeft === 0
      const isEnd =
        scrollArea &&
        scrollArea.scrollWidth - scrollAreaWidth - Math.round(scrollPosition) <
          1
      setScrollAreaClass(
        isStart && !isEnd ? 'start' : isEnd && !isStart ? 'end' : ''
      )
    }
  }, [scrollPosition, scrollAreaWidth, tabListWidth])

  const handleMouseWheel = (e: WheelEvent) => {
    if (e.deltaY === 0 && e.deltaX === 0) return
    const el = scrollAreaRef.current?.children[0]
    if (el) {
      const isAtStart = el.scrollLeft === 0 && e.deltaY < 0
      const isAtEnd =
        el.scrollWidth - el.clientWidth - Math.round(el.scrollLeft) === 0 &&
        e.deltaY > 0

      if (!isAtStart && !isAtEnd) {
        e.preventDefault()
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        el.scrollLeft += e.deltaX
        setScrollPosition(el.scrollLeft)
      } else {
        el.scrollLeft += e.deltaY
        setScrollPosition(el.scrollLeft)
      }
    }
  }

  const handleMouseDown = useCallback((e: MouseEvent) => {
    setStartXState(e.clientX)
    setIsScrolling(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isScrolling) {
        const el = scrollAreaRef.current?.children[0]
        if (el && startXState) {
          el.scrollTo({
            left: (el.scrollLeft += startXState - e.clientX),
            behavior: 'smooth',
          })
          setScrollPosition(el.scrollLeft)
          setStartXState(e.clientX)
        }
      }
    },
    [isScrolling, startXState]
  )

  const handleMouseUp = useCallback(() => {
    setIsScrolling(false)
    setStartXState(null)
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    setStartXState(e.touches[0].clientX)
    setIsScrolling(true)
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isScrolling) {
        const el = scrollAreaRef.current?.children[0]
        if (el && startXState) {
          el.scrollTo({
            left: (el.scrollLeft += startXState - e.touches[0].clientX),
            behavior: 'smooth',
          })
          setScrollPosition(el.scrollLeft)
          setStartXState(e.touches[0].clientX)
        }
      }
    },
    [isScrolling, startXState]
  )

  const handleTouchEnd = useCallback(() => {
    setIsScrolling(false)
    setStartXState(null)
  }, [])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current
      scrollArea.addEventListener('mousedown', handleMouseDown)
      scrollArea.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      scrollArea.addEventListener('touchstart', handleTouchStart)
      scrollArea.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)
      scrollArea.addEventListener('wheel', handleMouseWheel)

      return () => {
        scrollArea.removeEventListener('mousedown', handleMouseDown)
        scrollArea.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        scrollArea.removeEventListener('touchstart', handleTouchStart)
        scrollArea.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
        scrollArea.removeEventListener('wheel', handleMouseWheel)
      }
    }
  }, [
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    tabState,
  ])

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (isDragging) {
      setIsScrolling(false)
      document.removeEventListener('mouseup', handleMouseUp)
      scrollArea?.removeEventListener('mousemove', handleMouseMove)
    }
  }, [handleMouseMove, handleMouseUp, isDragging, tabState])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id === over?.id) {
      return
    }

    const oldIndex = tabState.findIndex(
      (item: Item) => camelCase(item.value) === active.id
    )
    const newIndex = tabState.findIndex(
      (item: Item) => camelCase(item.value) === over?.id
    )
    const newState = arrayMove(state, oldIndex, newIndex)
    setState({ payload: { target: { name: name, value: newState } } })
    setIsDragging(false)
    setActiveDragId(null)
  }

  const onDragStart = (event: DragEndEvent) => {
    setIsDragging(true)
    const { active } = event
    setActiveDragId(active.id as string)
  }

  // Add new tab
  const add = async (name: string) => {
    try {
      await setState({
        type: 'added',
        payload: { target: { name: name } },
      })
    } catch (err: any) {
      console.log(err.message)
    }
  }

  // Remove tab
  const remove = async (index: number) => {
    try {
      await setState({
        type: 'removed',
        payload: { target: { name: `${name}.${index}` } },
      })
      if (activeTab === camelCase(tabState[index].value)) {
        if (index === tabState.length - 1) {
          setActiveTab(camelCase(tabState[index - 1].value))
        } else {
          setActiveTab(camelCase(tabState[index + 1].value))
        }
      }
    } catch (err: any) {
      console.log(err.message)
    }
  }

  let content

  if (!tabState) {
    return (content = <Spinner />)
  }

  content = (
    <>
      {addButtonOptions &&
        addButtonOptions.length > 0 &&
        addButtonOptions.length === 1 && (
          <Button
            variant='outline'
            onClick={() => add(addButtonOptions[0].name)}
            className={style['tab-add-button']}
          >
            {`Add ${addButtonOptions[0].label}`}
          </Button>
        )}
      {tabState?.length > 0 && (
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          radius='md'
          className={style['tab-navigation']}
          keepMounted={true}
        >
          <div className={style[`tab-bar`]}>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              sensors={sensor}
            >
              <ScrollArea
                ref={scrollAreaRef}
                type='never'
                className={`${style['tab-scroll-area']} ${
                  style[scrollAreaClass as string]
                }`}
              >
                <Tabs.List className={style[`tab-list`]} ref={tabListRef}>
                  <SortableContext
                    items={tabState}
                    strategy={horizontalListSortingStrategy}
                  >
                    {tabState?.length > 0 &&
                      tabState.map((item: Item, index: number) => {
                        return (
                          <SortableTab
                            key={camelCase(item.value)}
                            index={index}
                            value={camelCase(item.value)}
                            item={item}
                            remove={remove}
                            addRow={dynamic}
                            reorder={reorder}
                          />
                        )
                      })}
                  </SortableContext>
                </Tabs.List>
              </ScrollArea>
              {reorder && (
                <DragOverlay>
                  {activeDragId ? (
                    <Tabs.Tab
                      className={style['tab']}
                      value={activeDragId}
                      rightSection={
                        dynamic ? <TbX style={{ color: 'inherit' }} /> : null
                      }
                    >
                      {
                        tabState[
                          tabState.findIndex(
                            (item: Item) =>
                              camelCase(item.value) === activeDragId
                          )
                        ]?.value
                      }
                    </Tabs.Tab>
                  ) : null}
                </DragOverlay>
              )}
            </DndContext>
            {tabListWidth !== scrollAreaWidth && (
              <SelectOptionComponent
                tabState={tabState}
                scrollAreaRef={scrollAreaRef}
                scrollAreaWidth={scrollAreaWidth}
                setActiveTab={setActiveTab}
                tabListRef={tabListRef}
                remove={remove}
              />
            )}
          </div>
          {tabState?.length > 0 &&
            tabState.map((item: Item, index: number) => {
              camelCase(item.value) === '' &&
                console.log('activePanel', camelCase(item.value))
              return (
                <Tabs.Panel
                  value={camelCase(item.value)}
                  key={index}
                  className={style['pane']}
                  data-active={activeTab === camelCase(item.value)}
                >
                  {item.content}
                </Tabs.Panel>
              )
            })}
        </Tabs>
      )}
    </>
  )

  return content
}

const memoizedDraggableTabs = memo(DraggableTabs)

export default memoizedDraggableTabs
