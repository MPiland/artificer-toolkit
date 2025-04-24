import { useCallback, useRef, useState, MouseEvent as ReactMouseEvent, useEffect, use, Fragment } from 'react'
import clsx from 'clsx'
import {
  list,
  list_footer_group,
  list_footer_item,
  list_title_button_container,
  list_title_container,
  list_parent,
  list_wrapper,
  list_sub,
} from './List.css'
import type { FilterConfig, FilterDataType, FooterConfig } from './List.types'
import { useEventListener, useMediaQuery, useDebounceCallback } from 'usehooks-ts'
import Scrollbar from '@/components/Scrollbar'
import { type UseMutationResult } from '@tanstack/react-query'
import Card from '@/components/Card'
import { Outlet, useNavigate, Link, useMatches } from '@tanstack/react-router'
import { startCase } from 'lodash'
import Divider from '@/components/Divider'
import Button from '@/components/Button'
import CopyIcon from '@/assets/Icons/ICopy'
import CreateIcon from '@/assets/Icons/ICreate'
import GridIcon from '@/assets/Icons/IGrid'
import ListIcon from '@/assets/Icons/IList'
import type { Character, Maybe, FormDataType, FormType, ListItemType, MetaDataType } from '@/types'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Categories } from '@/enums'
import Filter from './Filter'
import Group from '@/components/Group'
import { sprinkles } from '@/css/sprinkles.css'
import { ModalContext } from '@/components/Modal'
import { type FilterState } from '@/store'
import { useMetaData, useRouteNavigation, useFilteredList } from '@/hooks'
import { MdEdit, MdLaunch } from 'react-icons/md'
import { FormContext } from '../Form/FormContext'

interface ListProps<T extends ListItemType, K extends MetaDataType, U extends FilterDataType> {
  className?: string | symbol | number | any
  visibility?: 'hidden' | 'visible' | 'always'
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  data: Maybe<T[]>
  metaData?: K
  footerConfigs?: FooterConfig<K>[]
  filterConfigs?: FilterConfig<U, K>[]
}

const SCROLL_BOX_MIN_SIZE = 20

const List = <T extends ListItemType, K extends MetaDataType, U extends FilterDataType>({
  className,
  visibility = 'visible',
  data,
  metaData,
  useDeleteItem,
  footerConfigs,
  filterConfigs,
}: ListProps<T, K, U>) => {
  const navigate = useNavigate()
  const sm = useMediaQuery('screen and (max-width: 567px)')
  const { mutateAsync: deleteItem } = useDeleteItem()
  const { getSourceText } = useMetaData({ metaData })
  const { showModal } = use(ModalContext)
  const {
    formStore: { reinitState },
  } = use(FormContext)

  const form = useMatches({ select: (m) => m[m.length - 1].context.form?.type }) as FormType

  const routeNav = useRouteNavigation(form)
  const filteredData = useFilteredList({ data, context: form as keyof FilterState })

  const listRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)
  const documentRef = useRef<Document>(document)

  const [view, setView] = useState<'list' | 'grid'>('list')
  const [active, setActive] = useState<boolean>(false)
  const [thumbState, setThumbState] = useState<{ size: number; pos: number }>({ size: 0, pos: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [mousePos, setMousePos] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [collapsedCards, setCollapsedCards] = useState(new Set<string>())
  const [scroll, setScroll] = useState<boolean>(false)

  const debouncedScrollEnd = useDebounceCallback(() => {
    if (!isDragging && visibility !== 'always') {
      setActive(false)
    }
  }, 750)

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return

    const updateThumbSize = () => {
      const ratio = parent.clientHeight / parent.scrollHeight
      const size = Math.max(SCROLL_BOX_MIN_SIZE, parent.clientHeight * ratio)
      setThumbState((prev) => ({ ...prev, size }))
      setScroll(parent.scrollHeight > parent.clientHeight)
    }

    const resizeObserver = new ResizeObserver(updateThumbSize)
    resizeObserver.observe(parent)
    updateThumbSize()

    return () => resizeObserver.disconnect()
  }, [filteredData])

  const handleCollapse = (itemId: string) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleDeleteConfirmed = async (id: ListItemType['id']) => {
    try {
      await deleteItem(id)
    } catch (err: any) {
      if ('data' in err) {
        if ('messasge' in err.data) {
          return setErrorMessage(err.data.message)
        }
      }
      return setErrorMessage('An unknown error occurred')
    }
  }

  const handleCopyConfirmed = (item: FormDataType) => {
    const data: Omit<FormDataType, 'id' | 'label' | 'value'> & {
      id: string | undefined
      label: string | undefined
      value: string | undefined
    } = {
      ...item,
      id: undefined,
      label: undefined,
      value: undefined,
    }
    const itemNav = routeNav.new
    reinitState(data as FormDataType)
    return navigate({ to: itemNav.to })
  }

  const handleDelete = (label: ListItemType['label'], id: ListItemType['id']) => {
    showModal({
      type: 'delete',
      props: {
        label: label,
        onDelete: () => handleDeleteConfirmed(id),
      },
    })
  }

  const handleCopy = () => {
    showModal({
      type: 'copy',
      props: {
        form: form,
        data: data?.map((item) => ({
          label: item.label,
          value: item.value,
          id: item.id,
        })),
        onCopy: (item: FormDataType) => handleCopyConfirmed(item),
      },
    })
  }

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      requestAnimationFrame(() => {
        const parent = parentRef.current
        if (!parent) return

        debouncedScrollEnd.cancel()
        setActive(true)

        parent.scrollTop += e.deltaY

        const newPosition =
          (parent.scrollTop / (parent.scrollHeight - parent.clientHeight)) * (parent.clientHeight - thumbState.size)

        setThumbState((prev) => ({
          ...prev,
          pos: newPosition,
        }))
      })
    },
    [debouncedScrollEnd, thumbState.size]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const parent = parentRef.current
        if (!parent) return

        const mouseDelta = e.clientY - mousePos
        const scrollRatio = (parent.scrollHeight - parent.clientHeight) / (parent.clientHeight - thumbState.size)
        const scrollDelta = mouseDelta * scrollRatio
        parent.scrollTop += scrollDelta

        const newPosition =
          (parent.scrollTop / (parent.scrollHeight - parent.clientHeight)) * (parent.clientHeight - thumbState.size)
        setThumbState((prev) => ({
          ...prev,
          pos: newPosition,
        }))
        setMousePos(e.clientY)
      }
    },
    [isDragging, mousePos, thumbState.size]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseOver = useCallback(() => {
    setActive(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setActive(false)
  }, [])

  const handleThumbMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setMousePos(e.clientY)
  }

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredData?.length / (view === 'grid' ? 3 : 1)),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  useEventListener('wheel', handleScroll, documentRef, { passive: true })
  useEventListener('mouseenter', handleMouseOver, documentRef)
  useEventListener('mouseleave', handleMouseLeave, documentRef)
  useEventListener('mousemove', handleMouseMove, documentRef)
  useEventListener('mouseup', handleMouseUp, documentRef)

  const isSub = (item: ListItemType, defaultCase: 'true' | 'false') => {
    if (item.__typename === 'ClassListItem' && metaData?.__typename === 'ClassMeta') {
      return metaData.categories?.some(
        (category) => category.id === Categories.SUBCLASS && category.classIds?.includes(item.id)
      )
    }
    if (item.__typename === 'RaceListItem' && metaData?.__typename === 'RaceMeta') {
      return metaData.categories?.some(
        (category) => category.id === Categories.SUBRACE && category.raceIds?.includes(item.id)
      )
    }
    return defaultCase === 'false' ? false : true
  }

  const filteredSub = filteredData.filter((item) => isSub(item, 'false'))

  return (
    <>
      <div className={list_title_container}>
        <h2>{startCase(form)}</h2>
        <div className={list_title_button_container}>
          <Button color='main' style='outline' onClick={handleCopy}>
            {<CopyIcon />} {!sm && ' Copy'}
          </Button>
          <Link {...routeNav.new}>
            {<CreateIcon />} {!sm && ' Create'}
          </Link>
        </div>
      </div>
      <Divider />
      <Group alignItemsVariant='end' className={sprinkles({ mb: 'space-4' })}>
        {filterConfigs && (
          <Group className={sprinkles({ flex: '1', me: 'space-4' })}>
            <Filter context={form as keyof FilterState} metaData={metaData} filterConfigs={filterConfigs} />
          </Group>
        )}
        {!sm && !(filteredSub.length > 0) && (
          <Group>
            <Button
              className={sprinkles({ me: 'space-2' })}
              color='main'
              style='outline'
              onClick={() => setView('grid')}
            >
              {<GridIcon />}
            </Button>
            <Button color='main' style='outline' onClick={() => setView('list')}>
              {<ListIcon />}
            </Button>
          </Group>
        )}
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      <div className={list_wrapper} ref={wrapperRef}>
        <div className={list_parent} ref={parentRef}>
          <div
            ref={listRef}
            className={clsx({ [className]: className }, list, view)}
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const rowStartIndex = virtualItem.index * (view === 'grid' ? 3 : 1)
              const rowEndIndex = Math.min(rowStartIndex + (view === 'grid' ? 3 : 1), filteredData.length)
              const itemsInRow = filteredData.filter((item) => isSub(item, 'true')).slice(rowStartIndex, rowEndIndex)

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    display: view === 'grid' ? 'grid' : 'block',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {itemsInRow.map((item) => {
                    const itemNav = routeNav.forItem(item.id, item.label)
                    return (
                      <Fragment key={item.id}>
                        <Card ref={itemRef} itemId={item.id}>
                          <Card.Header
                            title={`${item.label} ${
                              (item as Exclude<ListItemType, Character>).masterId !== null ? '(M)' : ''
                            }`}
                            titleRight={
                              <>
                                <Link {...itemNav.view} onClick={(e) => e.stopPropagation()}>
                                  <MdLaunch />
                                </Link>
                                {(item as Exclude<ListItemType, Character>).masterId === null && (
                                  <Link
                                    {...itemNav.edit}
                                    onClick={(e) => {
                                      reinitState()
                                      e.stopPropagation()
                                    }}
                                  >
                                    <MdEdit />
                                  </Link>
                                )}
                              </>
                            }
                            remove={
                              (item as Exclude<ListItemType, Character>).masterId === null ?
                                () => handleDelete(item.label, item.id)
                              : undefined
                            }
                            titleLeft={'level' in item && (item.level || item.level === 0) && `(${item.level})`}
                            collapsible={view === 'list' && true}
                            collapsed={!collapsedCards.has(item.id)}
                            onCollapse={() => handleCollapse(item.id)}
                          />
                          <Card.Content>{item.desc}</Card.Content>
                          {footerConfigs && (
                            <Card.Footer>
                              <div className={list_footer_group}>
                                {footerConfigs.map((footer, fIndex) => {
                                  const text = getSourceText({ footer, state: item })
                                  if (((footer.display === view && !sm) || !footer.display) && text !== '---') {
                                    return (
                                      <div className={list_footer_item} key={fIndex}>
                                        {footer.icon ?? footer.value}
                                        {text}
                                      </div>
                                    )
                                  }
                                })}
                              </div>
                            </Card.Footer>
                          )}
                        </Card>
                        {filteredSub.length > 0 &&
                          filteredSub.map((sItem) => {
                            if (
                              (metaData?.__typename === 'ClassMeta' &&
                                metaData.parentClasses?.some((parentClass) =>
                                  parentClass.classIds?.includes(item.id)
                                )) ||
                              (metaData?.__typename === 'RaceMeta' &&
                                metaData.lineages?.some((lineage) => lineage.raceIds?.includes(item.id)))
                            ) {
                              const sItemNav = routeNav.forItem(sItem.id, sItem.label)
                              return (
                                <Card key={sItem.id} className={list_sub} ref={itemRef} itemId={sItem.id}>
                                  <Card.Header
                                    title={`${sItem.label} ${
                                      (sItem as Exclude<ListItemType, Character>).masterId !== null && '(M)'
                                    }`}
                                    titleRight={
                                      <>
                                        <Link {...sItemNav.view} onClick={(e) => e.stopPropagation()}>
                                          <MdLaunch />
                                        </Link>
                                        {(item as Exclude<ListItemType, Character>).masterId === null && (
                                          <Link
                                            {...sItemNav.edit}
                                            onClick={(e) => {
                                              reinitState()
                                              e.stopPropagation()
                                            }}
                                          >
                                            <MdEdit />
                                          </Link>
                                        )}
                                      </>
                                    }
                                    remove={
                                      (sItem as Exclude<ListItemType, Character>).masterId === null ?
                                        () => handleDelete(sItem.label, sItem.id)
                                      : undefined
                                    }
                                    titleLeft={
                                      'level' in sItem && (sItem.level || sItem.level === 0) && `(${sItem.level})`
                                    }
                                    collapsible={view === 'list' && true}
                                    collapsed={!collapsedCards.has(sItem.id)}
                                    onCollapse={() => handleCollapse(sItem.id)}
                                  />
                                  <Card.Content>{sItem.desc}</Card.Content>
                                  {footerConfigs && (
                                    <Card.Footer>
                                      <div className={list_footer_group}>
                                        {footerConfigs.map((footer, fIndex) => {
                                          const text = getSourceText({
                                            footer,
                                            state: sItem,
                                          })
                                          if (((footer.display === view && !sm) || !footer.display) && text !== '---') {
                                            return (
                                              <div className={list_footer_item} key={fIndex}>
                                                {footer.icon ?? footer.value}
                                                {text}
                                              </div>
                                            )
                                          }
                                        })}
                                      </div>
                                    </Card.Footer>
                                  )}
                                </Card>
                              )
                            }
                          })}
                      </Fragment>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        {visibility !== 'hidden' && scroll && (
          <Scrollbar
            active={active || visibility === 'always'}
            size={thumbState.size}
            position={thumbState.pos}
            onMouseDown={handleThumbMouseDown}
            scrollDirection='vertical'
          />
        )}
      </div>
      <Outlet />
    </>
  )
}

export default List
