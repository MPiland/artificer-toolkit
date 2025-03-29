import {
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  useEffect,
  ReactElement,
  use,
  Fragment,
} from 'react'
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
import { useEventListener, useMediaQuery } from 'usehooks-ts'
import Scrollbar from '../Scrollbar/Scrollbar'
import { UseMutationResult, UseSuspenseQueryResult } from '@tanstack/react-query'
import { getValueFromState } from '../../utils/formatting'
import { useGetSystemQuery } from '../../apis/systemsApi'
import { useListClassesQuery } from '../../apis/classesApi'
import Card from '../Card/Card'
import { useLocation, Outlet, Navigate } from '@tanstack/react-router'
import { FormDataType } from '../../types/form'
import { useDebounceCallback } from 'usehooks-ts'
import { startCase } from 'lodash'
import Divider from '../Divider/Divider'
import Button from '../Button/Button'
import CopyIcon from '../../assets/Icons/ICopy'
import CreateIcon from '../../assets/Icons/ICreate'
import GridIcon from '../../assets/Icons/IGrid'
import ListIcon from '../../assets/Icons/IList'
import { Character } from '../../../amplify/gql/types'
import { AuthContext } from '../../pages/auth/AuthContext'
import { FormContext } from '../Form/FormContext'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Categories } from '../../types/enums'
import { FilterConfig } from '../../types/components'
import Filter from './Filter'
import useFilteredList from '../../hooks/useFilteredList'
import Group from '../Group/Group'
import { sprinkles } from '../../css/sprinkles.css'
import { createFormObject } from '../../utils/form'
import { ModalContext } from '../Modal/ModalContext'
import { navigatePath, FormType } from '../../utils/form'
import { StoreFormType } from '../../store/filterSlice'

interface ListProps<T extends FormDataType> {
  className?: string | symbol | number | any
  visibility?: 'hidden' | 'visible' | 'always'
  useListItems: () => UseSuspenseQueryResult<T[] | null | undefined, Error>
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  footerText?: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[]
  filterConfigs?: FilterConfig<T>[]
}

const SCROLL_BOX_MIN_SIZE = 20

const List = <T extends FormDataType>({
  className,
  visibility = 'visible',
  useListItems,
  useDeleteItem,
  footerText,
  filterConfigs,
}: ListProps<T>) => {
  const location = useLocation()

  const { mutateAsync: deleteItem } = useDeleteItem()
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()
  const { data } = useListItems()

  const { updateFormData, fullReset } = use(FormContext)
  const { user, tokens } = use(AuthContext)
  const { showModal } = use(ModalContext)

  const sm = useMediaQuery('screen and (max-width: 567px)')

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

  const form = location?.pathname?.split('/')[1] as FormType

  const filteredData = useFilteredList({ data, context: form as StoreFormType })

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

  const handleDeleteConfirmed = async (item: FormDataType) => {
    try {
      await deleteItem(item.id)
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
    const data: FormDataType = {
      ...item,
      id: '',
      value: '',
      label: '',
    }
    fullReset()
    updateFormData({
      type: 'reset',
      value: data,
    })
    updateFormData({
      type: 'initialReset',
      value: data,
    })
    const pathOptions = navigatePath({ form, type: 'form', action: 'edit' })
    if (!pathOptions) return null // Handle the undefined case

    return <Navigate to={pathOptions.path} params={pathOptions.params} state={{ item: data }} />
  }

  const handleDelete = (item: FormDataType) => {
    showModal({
      type: 'delete',
      props: {
        item,
        onDelete: () => handleDeleteConfirmed(item),
      },
    })
  }

  const handleOpen = (item: FormDataType) => {
    const navigateOptions = navigatePath({ form, type: 'view', label: item.label })
    if (!navigateOptions) return null // Handle the undefined case

    return <Navigate to={navigateOptions.path} params={navigateOptions.params} state={{ item: item }} />
  }

  const handleCreate = async (secondary?: boolean) => {
    try {
      fullReset()

      const groups = tokens?.payload?.['cognito:groups'] as string[]
      const master = groups?.includes('Admins') || false

      const userId = master ? 'master' : user?.userId || ''

      const category =
        form === 'classes' ?
          system?.categories?.find((category) => (category?.classes && secondary ? 'subclass' : 'base'))?.id
        : form === 'races' &&
          system?.categories?.find((category) => (category?.races && secondary ? 'subrace' : 'base'))?.id

      const stateObject = createFormObject(form, userId, system?.id || '', category || '', system?.abilities)

      updateFormData({
        type: 'reset',
        value: stateObject,
      })
      updateFormData({
        type: 'initialReset',
        value: stateObject,
      })
      const pathOptions = navigatePath({ form, type: 'form', action: 'new' })
      if (!pathOptions) return null // Handle the undefined case

      return <Navigate to={pathOptions.path} params={pathOptions.params} />
    } catch (err) {
      console.error('error resetting state', err)
    }
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

  const handleEdit = (item: FormDataType) => {
    updateFormData({
      type: 'reset',
      value: item,
    })
    updateFormData({
      type: 'initialReset',
      value: item,
    })
    const pathOptions = navigatePath({ form, type: 'form', action: 'edit', label: item.label })
    if (!pathOptions) return null // Handle the undefined case

    return <Navigate to={pathOptions.path} params={pathOptions.params} state={{ item: item }} />
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

  const getSourceData = useCallback(
    (sourceType: string) => {
      switch (sourceType) {
        case 'system':
          return system
        case 'classes':
          return classes
        default:
          return null
      }
    },
    [classes, system]
  )

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

  const sub = filteredData?.filter((item) => {
    if (item.__typename === 'Class' || item.__typename === 'Race') {
      return item.category !== Categories.base
    }
    return false
  })

  return (
    <>
      <div className={list_title_container}>
        <h2>{startCase(form)}</h2>
        <div className={list_title_button_container}>
          <Button color='main' style='outline' onClick={handleCopy}>
            {<CopyIcon />} {!sm && ' Copy'}
          </Button>
          <Button color='main' style='outline' onClick={() => handleCreate(form === 'classes' || form === 'races')}>
            {<CreateIcon />} {!sm && ' Create'}
          </Button>
        </div>
      </div>
      <Divider />
      <Group alignItemsVariant='end' className={sprinkles({ mb: 'space-4' })}>
        {filterConfigs && (
          <Group className={sprinkles({ flex: '1', me: 'space-4' })}>
            <Filter context={form as FormType} data={data} filterConfigs={filterConfigs} />
          </Group>
        )}
        {!sm && !(sub.length > 0) && (
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
              const itemsInRow = filteredData
                .filter((item) => {
                  if (item.__typename === 'Class' || item.__typename === 'Race') {
                    return item.category === Categories.base
                  }
                  return true
                })
                .slice(rowStartIndex, rowEndIndex)

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
                  {itemsInRow.map((item) => (
                    <Fragment key={item.id}>
                      <Card ref={itemRef} itemId={item.id}>
                        <Card.Header
                          title={`${item.label} ${
                            (item as Exclude<FormDataType, Character>).masterId !== null ? '(M)' : ''
                          }`}
                          open={() => handleOpen(item)}
                          remove={
                            (item as Exclude<FormDataType, Character>).masterId === null ?
                              () => handleDelete(item)
                            : undefined
                          }
                          edit={
                            (item as Exclude<FormDataType, Character>).masterId === null ?
                              () => handleEdit(item)
                            : undefined
                          }
                          leftSide={'level' in item && (item.level || item.level === 0) && `(${item.level})`}
                          collapsible={view === 'list' && true}
                          collapsed={!collapsedCards.has(item.id)}
                          onCollapse={() => handleCollapse(item.id)}
                        />
                        <Card.Content>{item.desc}</Card.Content>
                        {footerText && (
                          <Card.Footer>
                            <div className={list_footer_group}>
                              {footerText.map((footerItem, footerIndex) => {
                                const text = getValueFromState({ input: footerItem, state: item, getSourceData })
                                if (((footerItem.display === view && !sm) || !footerItem.display) && text !== '---') {
                                  return (
                                    <div className={list_footer_item} key={footerIndex}>
                                      {footerItem.icon ?? footerItem.value}
                                      {text}
                                    </div>
                                  )
                                }
                              })}
                            </div>
                          </Card.Footer>
                        )}
                      </Card>
                      {sub.length > 0 &&
                        sub.map((sItem) => {
                          if (
                            ('parentClass' in sItem && sItem.parentClass === item.id) ||
                            ('lineages' in sItem && sItem.lineages?.includes(item.id))
                          ) {
                            return (
                              <Card key={sItem.id} className={list_sub} ref={itemRef} itemId={sItem.id}>
                                <Card.Header
                                  title={`${sItem.label} ${
                                    (sItem as Exclude<FormDataType, Character>).masterId !== null && '(M)'
                                  }`}
                                  open={() => handleOpen(sItem)}
                                  remove={
                                    (sItem as Exclude<FormDataType, Character>).masterId === null ?
                                      () => handleDelete(sItem)
                                    : undefined
                                  }
                                  edit={
                                    (sItem as Exclude<FormDataType, Character>).masterId === null ?
                                      () => handleEdit(sItem)
                                    : undefined
                                  }
                                  leftSide={
                                    'level' in sItem && (sItem.level || sItem.level === 0) && `(${sItem.level})`
                                  }
                                  collapsible={view === 'list' && true}
                                  collapsed={!collapsedCards.has(sItem.id)}
                                  onCollapse={() => handleCollapse(sItem.id)}
                                />
                                <Card.Content>{sItem.desc}</Card.Content>
                                {footerText && (
                                  <Card.Footer>
                                    <div className={list_footer_group}>
                                      {footerText.map((footerItem, footerIndex) => {
                                        const text = getValueFromState({
                                          input: footerItem,
                                          state: sItem,
                                          getSourceData,
                                        })
                                        if (
                                          ((footerItem.display === view && !sm) || !footerItem.display) &&
                                          text !== '---'
                                        ) {
                                          return (
                                            <div className={list_footer_item} key={footerIndex}>
                                              {footerItem.icon ?? footerItem.value}
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
                  ))}
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
