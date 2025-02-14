import {
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  ComponentPropsWithoutRef,
  useEffect,
  ReactElement,
  useLayoutEffect,
  Ref,
  use,
  Fragment,
} from 'react'
import clsx from 'clsx'
import {
  list,
  list_footer_group,
  list_footer_item,
  list_button_container,
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
import { useGetSystemQuery } from '../../features/systems/systemsApi'
import { useListClassesQuery } from '../../features/classes/classesApi'
import Card from '../Card/Card'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { FormDataType } from '../../types/form'
import { useDebounceCallback } from 'usehooks-ts'
import { set, startCase } from 'lodash'
import Divider from '../Divider/Divider'
import Button from '../Button/Button'
import FilterIcon from '../../assets/Icons/IFilter'
import CopyIcon from '../../assets/Icons/ICopy'
import CreateIcon from '../../assets/Icons/ICreate'
import GridIcon from '../../assets/Icons/IGrid'
import ListIcon from '../../assets/Icons/IList'
import { Character, Class, Equipment, Feat, Race, Scores, Spell } from '../../../amplify/gql/types'
import { AuthContext } from '../../features/auth/AuthContext'
import { FormContext } from '../Form/FormContext'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Categories } from '../../types/enums'

interface ListProps extends ComponentPropsWithoutRef<'div'> {
  className?: string
  visibility?: 'hidden' | 'visible' | 'always'
  useListItems: () => UseSuspenseQueryResult<any[]>
  useDeleteItem: () => UseMutationResult<any, Error, string, unknown>
  footerText?: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[]
  ref?: Ref<HTMLDivElement> | null | ((arg: Element) => void)
}

const SCROLL_BOX_MIN_SIZE = 20

const List = ({ className, visibility = 'visible', useListItems, useDeleteItem, footerText }: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { mutateAsync: deleteItem } = useDeleteItem()
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()
  const { data }: { data: FormDataType[] } = useListItems()
  const { updateFormData, resetForm } = use(FormContext)
  const { user } = use(AuthContext)

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')

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

  const form = location?.pathname?.split('/')[1]
  const deleteConfirmed = location.state?.delete
  const itemToDelete = location.state?.item

  const debouncedScrollEnd = useDebounceCallback(() => {
    if (!isDragging && visibility !== 'always') {
      setActive(false)
    }
  }, 750)

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
  }, [])

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
      resetForm()
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
            features: [],
            modifiers: [],
            proficiencies: [],
            equipment: [],
            feats: [],
            expertise: [],
            senses: [],
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

  const handleCopy = () => {
    navigate('copy', {
      state: {
        items: data,
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
    count: Math.ceil(data.length / (view === 'grid' ? 3 : 1)),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  useEventListener('wheel', handleScroll, parentRef, { passive: true })
  useEventListener('mouseenter', handleMouseOver, documentRef)
  useEventListener('mouseleave', handleMouseLeave, documentRef)
  useEventListener('mousemove', handleMouseMove, documentRef)
  useEventListener('mouseup', handleMouseUp, documentRef)

  const sub = data.filter((item) => {
    if (item.__typename === 'Class' || item.__typename === 'Race') {
      return item.category !== Categories.base
    }
    return false
  })

  return (
    <>
      <div className={list_title_container}>
        <h2>{startCase(`${form}`)}</h2>
        <div className={list_title_button_container}>
          <Button color='main' style='outline'>
            {<FilterIcon />} {md && ' Filter'}
          </Button>
          <Button color='main' style='outline' onClick={handleCopy}>
            {<CopyIcon />} {md && ' Copy'}
          </Button>
          <Button color='main' style='outline' onClick={() => handleCreate(form === 'classes' || form === 'races')}>
            {<CreateIcon />} {md && ' Create'}
          </Button>
        </div>
      </div>
      <Divider />
      {md && !(sub.length > 0) && (
        <div className={list_button_container}>
          <Button color='main' style='outline' onClick={() => setView('grid')}>
            {<GridIcon />}
          </Button>
          <Button color='main' style='outline' onClick={() => setView('list')}>
            {<ListIcon />}
          </Button>
        </div>
      )}
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
              const rowEndIndex = Math.min(rowStartIndex + (view === 'grid' ? 3 : 1), data.length)
              const itemsInRow = data
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
                            (item as Exclude<FormDataType, Character>).masterId !== null && '(M)'
                          }`}
                          open={(e) => handleOpen(e, item)}
                          remove={
                            (item as Exclude<FormDataType, Character>).masterId === null &&
                            ((e) => handleDelete(e, item))
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
                                if (((view && footerItem.display === view) || !footerItem.display) && text !== '---') {
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
                                  open={(e) => handleOpen(e, sItem)}
                                  remove={
                                    (sItem as Exclude<FormDataType, Character>).masterId === null &&
                                    ((e) => handleDelete(e, sItem))
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
                                          ((view && footerItem.display === view) || !footerItem.display) &&
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
