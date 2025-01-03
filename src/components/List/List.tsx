import {
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  ComponentPropsWithoutRef,
  useEffect,
  ReactElement,
  useLayoutEffect,
  useReducer,
  Ref,
  use,
} from 'react'
import clsx from 'clsx'
import {
  list,
  list_container,
  list_container_wrapper,
  list_footer_group,
  list_footer_item,
  list_button_container,
  list_title_button_container,
  list_title_container,
} from './List.css'
import { useEventListener } from 'usehooks-ts'
import Scrollbar from '../Scrollbar/Scrollbar'
import { UseMutationResult, UseSuspenseQueryResult } from '@tanstack/react-query'
import { getValueFromState } from '../../utils/formatting'
import { useGetSystemQuery } from '../../features/systems/systemsApi'
import { useListClassesQuery } from '../../features/classes/classesApi'
import Card from '../Card/Card'
import { useNavigate, useLocation } from 'react-router-dom'
import { Context as AppContext, FormDataType } from '../../types/form'
import { useDebounceCallback } from 'usehooks-ts'
import { scrollReducer } from '../../utils/virtualScroll'
import { set, startCase } from 'lodash'
import Divider from '../Divider/Divider'
import Button from '../Button/Button'
import FilterIcon from '../../assets/Icons/IFilter'
import CopyIcon from '../../assets/Icons/ICopy'
import CreateIcon from '../../assets/Icons/ICreate'
import GridIcon from '../../assets/Icons/IGrid'
import ListIcon from '../../assets/Icons/IList'
import { Character, Class, Equipment, Feat, Race, Scores, Spell } from '../../../amplify/API'
import { AuthContext } from '../../features/auth/AuthContext'
import { FormContext } from '../Form/FormContext'

/* TODO
  - Add drag functionality
  - Remember collapse, uncollapse state
*/

interface ListProps extends ComponentPropsWithoutRef<'div'> {
  className?: string
  visibility?: 'hidden' | 'visible' | 'always'
  useListItems: () => UseSuspenseQueryResult<any[]>
  useDeleteItem: () => UseMutationResult<any, Error, string, unknown>
  footerText?: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[]
  ref?: Ref<HTMLDivElement> | null | ((arg: Element) => void)
}

const SCROLL_BOX_MIN_SIZE = 20

type ThumbState = {
  size: number
  isDragging: boolean
  startPosition: number
}

const List = ({
  className,
  visibility = 'visible',
  useListItems,
  useDeleteItem,
  footerText,
  ref,
  ...props
}: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { mutateAsync: deleteItem } = useDeleteItem()
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()
  const { data }: { data: FormDataType[] } = useListItems()
  const { updateFormData, stateReset } = use(FormContext)
  const { user } = use(AuthContext)

  const containerRef = useRef<HTMLDivElement>(null)
  const containerWrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)
  const documentRef = useRef<Document>(document)

  const [view, setView] = useState<'list' | 'grid'>('list')
  const [scrollState, dispatch] = useReducer(scrollReducer, {
    scrollTop: 0,
    startIndex: 0,
    thumbPosition: 0,
    scrollHeight: 0,
    renderedNodesCount: 0,
  })
  const [itemHeight, setItemHeight] = useState<number>(0)
  const [active, setActive] = useState<boolean>(false)
  const [thumbState, setThumbState] = useState<ThumbState>({
    size: SCROLL_BOX_MIN_SIZE,
    isDragging: false,
    startPosition: 0,
  })
  const [errorMessage, setErrorMessage] = useState<string>()

  const form = location?.pathname?.split('/')[1] as AppContext['title']
  const deleteConfirmed = location.state?.delete
  const itemToDelete = location.state?.item

  const debouncedScrollEnd = useDebounceCallback(() => {
    if (!thumbState.isDragging && visibility !== 'always') {
      setActive(false)
    }
  }, 750)

  const updateSizes = useCallback(() => {
    const wrapper = containerWrapperRef.current
    if (!wrapper || !itemHeight || itemHeight === 0) return

    const itemsPerRow = view === 'grid' ? 3 : 1
    const totalRows = Math.ceil((data?.length || 0) / itemsPerRow)

    dispatch({
      type: 'UPDATE_LAYOUT',
      itemHeight,
      totalItems: totalRows,
      clientHeight: wrapper.clientHeight,
    })
  }, [data?.length, itemHeight, view])

  useEffect(() => {
    const handleDeleteConfirmed = async () => {
      try {
        await deleteItem(itemToDelete.id)
      } catch (err) {
        setErrorMessage(err.data.message)
      }
    }
    if (deleteConfirmed) {
      handleDeleteConfirmed()
    }
  }, [deleteConfirmed, itemToDelete, deleteItem])

  useLayoutEffect(() => {
    const item = itemRef?.current
    const wrapper = containerWrapperRef?.current
    if (wrapper && item && data?.length > 0 && (itemHeight === 0 || !itemHeight)) {
      const itemRect = item.getBoundingClientRect()
      setItemHeight(itemRect.height)
      const itemsPerRow = view === 'grid' ? 3 : 1
      const totalRows = Math.ceil((data?.length || 0) / itemsPerRow)
      dispatch({
        type: 'UPDATE_LAYOUT',
        itemHeight: item.clientHeight,
        totalItems: totalRows,
        clientHeight: wrapper.clientHeight,
      })
    }
  }, [data?.length, itemHeight, itemRef, view])

  const handleDelete = useCallback(
    (e: Event, item: FormDataType) => {
      e.stopPropagation()
      navigate(`delete/${item.value}`, {
        state: {
          title: item.label,
          item: item,
          size: 'sm',
        },
      })
    },
    [navigate]
  )

  const handleOpen = (e: Event, item: FormDataType) => {
    e.stopPropagation()
    navigate(`${item.value}`, {
      state: {
        item: item,
      },
    })
  }

  const handleCreate = async (secondary?: boolean) => {
    let stateObject: FormDataType
    try {
      await stateReset()
      switch (form) {
        case 'classes': {
          const category = system?.categories.find((category) =>
            category.classes && secondary ? 'subclass' : 'base'
          ).id

          const classObject: Class = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            category: category,
            __typename: 'Class',
          }
          stateObject = classObject
          break
        }
        case 'spells': {
          const spellObject: Spell = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            school: undefined,
            level: undefined,
            classes: undefined,
            range: undefined,
            duration: undefined,
            __typename: 'Spell',
          }
          stateObject = spellObject
          break
        }
        case 'equipment': {
          const equipmentObject: Equipment = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            category: undefined,
            __typename: 'Equipment',
          }
          stateObject = equipmentObject
          break
        }
        case 'feats': {
          const featObject: Feat = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            category: undefined,
            __typename: 'Feat',
          }
          stateObject = featObject
          break
        }
        case 'backgrounds':
          set(stateObject, '__typename', 'Background')
          break
        case 'characters': {
          const abilityScores: Array<Scores> = []
          system.abilities.forEach((ability) =>
            abilityScores.push({
              __typename: 'Scores',
              ability: ability.id,
              baseScore: 0,
              calculatedScore: 0,
              raceScore: 0,
              classScore: 0,
            })
          )
          const characterObject: Character = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            abilities: {
              __typename: 'CharacterAbilities',
              scores: abilityScores,
            },
            __typename: 'Character',
          }
          stateObject = characterObject
          break
        }
        case 'races': {
          const category = system?.categories.find((category) => (category.races && secondary ? 'subrace' : 'base')).id
          const raceObject: Race = {
            id: undefined,
            ownerId: user?.userId,
            systemId: system.id,
            label: undefined,
            value: undefined,
            category: category,
            playable: undefined,
            __typename: 'Race',
          }
          stateObject = raceObject
          break
        }
      }
      updateFormData({
        type: 'reset',
        value: stateObject,
      })
      updateFormData({
        type: 'initialReset',
        value: stateObject,
      })
      navigate('new')
    } catch {
      console.error('error resetting state')
    }
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

  const generateRows = useCallback(() => {
    if (!(data?.length > 0)) return

    if (itemHeight === 0) {
      return [data[0]]
    }

    const itemsPerRow = view === 'grid' ? 3 : 1
    const startRow = scrollState.startIndex
    const endRow = scrollState.startIndex + scrollState.renderedNodesCount

    const startIndex = startRow * itemsPerRow
    const endIndex = Math.min(endRow * itemsPerRow, data.length)

    return data.slice(startIndex, endIndex)
  }, [data, scrollState.startIndex, scrollState.renderedNodesCount, itemHeight, view])

  const debouncedUpdateSizes = useDebounceCallback(updateSizes, 16)

  useEffect(() => {
    const wrapper = containerWrapperRef.current
    if (wrapper) {
      const observer = new ResizeObserver(debouncedUpdateSizes)
      observer.observe(wrapper)
      return () => observer.disconnect()
    }
  }, [debouncedUpdateSizes])

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      requestAnimationFrame(() => {
        const wrapper = containerWrapperRef.current
        if (!wrapper) return

        debouncedScrollEnd.cancel()
        setActive(true)

        dispatch({
          type: 'SCROLL',
          deltaY: e.deltaY,
          clientHeight: wrapper.clientHeight,
          itemHeight,
          thumbSize: thumbState.size,
        })
      })
    },
    [debouncedScrollEnd, itemHeight, thumbState.size]
  )

  const handleScrollEnd = () => {
    if (!thumbState.isDragging) {
      debouncedScrollEnd()
    }
  }

  const handleMouseOver = () => {
    setActive(true)
  }

  const handleMouseLeave = () => {
    if (visibility !== 'always' && !thumbState.isDragging) {
      setActive(false)
    }
  }

  // const handleMouseMove = useCallback(
  //   (e: MouseEvent) => {
  //     if (thumbState.isDragging) {
  //       const wrapper = containerWrapperRef.current
  //       if (!wrapper) return

  //       console.log({ thumbState })

  //       const { clientHeight } = wrapper
  //       const deltaY = e.clientY - thumbState.startPosition
  //       const scrollPercentage = deltaY / (clientHeight - thumbState.size)
  //       const newScrollTop = Math.max(
  //         0,
  //         Math.min(scrollPercentage * scrollState.scrollHeight, scrollState.scrollHeight - clientHeight)
  //       )

  //       dispatch({
  //         type: 'DRAG',
  //         newScrollTop,
  //         clientHeight: clientHeight,
  //         itemHeight,
  //         thumbSize: thumbState.size,
  //       })
  //     }
  //   },
  //   [thumbState, scrollState.scrollHeight, itemHeight]
  // )

  const handleMouseUp = () => {
    setThumbState((prev) => ({ ...prev, isDragging: false }))
  }

  const handleThumbMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    setThumbState((prev) => ({
      ...prev,
      isDragging: true,
      startPosition: e.clientY,
    }))
  }

  useEventListener('scroll', handleScroll, listRef)
  useEventListener('scrollend', handleScrollEnd, listRef)
  useEventListener('wheel', handleScroll, listRef, { passive: true })
  // useEventListener('mousemove', handleMouseMove, documentRef)
  useEventListener('mouseup', handleMouseUp, documentRef)
  useEventListener('mouseover', handleMouseOver, listRef)
  useEventListener('mouseleave', handleMouseLeave, listRef)

  return (
    <>
      <div className={list_title_container}>
        <h2>{startCase(`${form}`)}</h2>
        <div className={list_title_button_container}>
          <Button color='main' style='outline'>
            {<FilterIcon />} Filter
          </Button>
          <Button color='main' style='outline'>
            {<CopyIcon />} Copy
          </Button>
          <Button color='main' style='outline' onClick={() => handleCreate(form === 'classes' || form === 'races')}>
            {<CreateIcon />} Create
          </Button>
        </div>
      </div>
      <Divider />
      <div className={list_button_container}>
        <Button color='main' style='outline' onClick={() => setView('grid')}>
          {<GridIcon />}
        </Button>
        <Button color='main' style='outline' onClick={() => setView('list')}>
          {<ListIcon />}
        </Button>
      </div>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      <div className={list} ref={listRef}>
        <div
          className={list_container_wrapper}
          ref={containerWrapperRef}
          style={{ height: `${scrollState.scrollHeight}px` }}
        >
          <div
            ref={(el) => {
              containerRef.current = el
              if (ref) {
                if (typeof ref === 'function') {
                  ref(el)
                } else {
                  ref.current = el
                }
              }
            }}
            className={clsx({ [className]: className }, list_container, view)}
            style={{
              transform: `translateY(${scrollState.startIndex * itemHeight}px)`,
            }}
            {...props}
          >
            {generateRows()?.map((item, index) => (
              <Card className='card' key={index + scrollState.startIndex} ref={itemRef} itemId={item.id}>
                <Card.Header
                  title={`${item.label} ${(item as Exclude<FormDataType, Character>).masterId !== null && '(M)'}`}
                  open={(e) => handleOpen(e, item)}
                  remove={
                    (item as Exclude<FormDataType, Character>).masterId === null && ((e) => handleDelete(e, item))
                  }
                  leftSide={'level' in item && (item.level || item.level === 0) && `(${item.level})`}
                  collapsible={view === 'list' && true}
                />
                <Card.Content>{item.desc}</Card.Content>
                {footerText && (
                  <Card.Footer>
                    <div className={list_footer_group}>
                      {footerText.map((footerItem, footerIndex) => {
                        if ((view && footerItem.display === view) || !footerItem.display) {
                          return (
                            <div className={list_footer_item} key={footerIndex}>
                              {footerItem.icon ?? footerItem.value}
                              {getValueFromState({ input: footerItem, state: item, getSourceData })}
                            </div>
                          )
                        }
                      })}
                    </div>
                  </Card.Footer>
                )}
              </Card>
            ))}
          </div>
        </div>
        {visibility !== 'hidden' && (
          <Scrollbar
            active={active || visibility === 'always'}
            size={thumbState.size}
            position={scrollState.thumbPosition}
            onMouseDown={handleThumbMouseDown}
            scrollDirection='vertical'
          />
        )}
      </div>
    </>
  )
}

export default List
