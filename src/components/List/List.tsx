import { useEffect, useState, ReactElement } from 'react'
import Button from '../Button/Button'
import { startCase } from 'lodash'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../Spinner/Spinner'
import {
  list_button_container,
  list_container,
  list_footer_group,
  list_footer_item,
  list_loading,
  list_title_button_container,
  list_title_container,
} from './List.css'
import { useForm } from '../../hooks/UseForm'
import Card from '../Card/Card'
import ScrollArea from '../ScrollArea/ScrollArea'
import Divider from '../Divider/Divider'
import FilterIcon from '../../assets/Icons/IFilter'
import CopyIcon from '../../assets/Icons/ICopy'
import CreateIcon from '../../assets/Icons/ICreate'
import GridIcon from '../../assets/Icons/IGrid'
import ListIcon from '../../assets/Icons/IList'
import { UseInfiniteQueryResult, UseMutationResult } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { set } from 'lodash'
import { ContextType } from '../../utils/types'
import { getValueFromState } from '../../utils/formatting'
import { useGetBuildersQuery } from '../../features/systems/systemsApi'
import { useInView } from 'react-intersection-observer'
import { CustomError } from '../../app/api/api'

interface ListProps {
  useGetItems: (arg?: { limit: number }) => UseInfiniteQueryResult
  useDeleteItem: () => UseMutationResult<any, CustomError, string, unknown>
  footerText?: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[]
}

const List = ({ useGetItems, useDeleteItem, footerText }: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { ref: nextRef, inView: nextInView } = useInView()
  const { ref: prevRef, inView: prevInView } = useInView()

  const {
    data,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
    hasPreviousPage,
    fetchPreviousPage,
    isFetchingPreviousPage,
  } = useGetItems({ limit: 21 })

  const { mutateAsync: deleteItem } = useDeleteItem()

  const { data: builders } = useGetBuildersQuery()

  const { setFormState, setOldFormState, setContext, stateReset, setStepIndex } = useForm()

  const [view, setView] = useState<'list' | 'grid'>('list')
  const [errorMessage, setErrorMessage] = useState<string>()

  const form = location?.pathname?.split('/')[1] as ContextType['title']

  const deleteConfirmed = location.state?.delete
  const itemToDelete = location.state?.item

  useEffect(() => {
    if (nextInView && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [fetchNextPage, nextInView, isFetchingNextPage])

  useEffect(() => {
    if (prevInView && !isFetchingPreviousPage) {
      fetchPreviousPage()
    }
  }, [fetchPreviousPage, prevInView, isFetchingPreviousPage])

  useEffect(() => {
    const handleDeleteConfirmed = async () => {
      try {
        await deleteItem(itemToDelete.id)
      } catch (err: any) {
        setErrorMessage(err.data.message)
      }
    }
    if (deleteConfirmed) {
      handleDeleteConfirmed()
    }
  }, [deleteConfirmed, itemToDelete, deleteItem])

  const handleCreate = async (secondary?: boolean) => {
    try {
      await stateReset()
    } catch {
      console.error('error resetting state')
    } finally {
      const stateObject: any = {}
      if (form === 'classes' || form === 'races') {
        const category = builders?.[form]?.category.find((category: any) =>
          category.name === 'classes'
            ? secondary
              ? 'subclass'
              : 'base'
            : form === 'races' && secondary
              ? 'subrace'
              : 'base'
        )
        set(stateObject, 'category', category)
      }
      if (form === 'characters') {
        const abilityScores: any[] = []
        builders.abilities.type
          .filter((ability: any) => ability.name !== 'spellAbility')
          .forEach((ability: any) =>
            abilityScores.push({
              name: ability.name,
              value: ability.value,
              _id: ability._id,
              baseScore: 0,
              calculatedScore: 0,
              raceScore: 0,
              classScore: 0,
            })
          )
        set(stateObject, 'abilities.scores', abilityScores)
      }
      setContext({ title: form, type: 'new' as string })
      setFormState({
        type: 'reset',
        target: { value: stateObject },
      })
      setOldFormState(stateObject)
      navigate('new')
    }
  }

  const handleDelete = (e: Event, item: any) => {
    e.stopPropagation()
    navigate(`delete/${item.name}`, {
      state: {
        title: item.value,
        item: item,
        size: 'sm',
      },
    })
  }

  const handleEdit = async (e: Event, item: any) => {
    e.stopPropagation()
    const title = form
    try {
      await stateReset()
    } catch {
      console.log('error resetting state')
    } finally {
      setStepIndex(0)
      setContext({ title: title, type: 'edit' as string })
      setFormState({
        type: 'reset',
        target: { value: item },
      })
      setOldFormState(item)
      navigate(`edit/${item.name}`, {
        state: {
          previous: location,
        },
      })
    }
  }

  return (
    <>
      <div className={list_title_container}>
        <h2>{startCase(`${form}`)}</h2>
        <div className={list_title_button_container}>
          <Button color='default' style='outline'>
            {<FilterIcon />} Filter
          </Button>
          <Button color='default' style='outline'>
            {<CopyIcon />} Copy
          </Button>
          <Button color='default' style='outline' onClick={() => handleCreate(form === 'classes' || form === 'races')}>
            {<CreateIcon />} Create
          </Button>
        </div>
      </div>
      <Divider />
      <div className={list_button_container}>
        <Button color='default' style='outline' onClick={() => setView('grid')}>
          {<GridIcon />}
        </Button>
        <Button color='default' style='outline' onClick={() => setView('list')}>
          {<ListIcon />}
        </Button>
      </div>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {!data || typeof useGetItems !== 'function' ? (
        <Spinner />
      ) : (
        <ScrollArea>
          {hasPreviousPage && (
            <div ref={prevRef} className={list_loading}>
              Loading more...
            </div>
          )}
          {(data as any).pages.map((group: { currentPage: number; data: any[]; totalPages: number }, index: number) => (
            <div className={clsx(list_container, view)} key={index}>
              {group.data.map((item: any) => (
                <Card key={item.id}>
                  <Card.Header
                    title={item.value}
                    editable={(e) => handleEdit(e, item)}
                    removable={(e) => handleDelete(e, item)}
                    leftSide={item.level && `(${item.level})`}
                    collapsible={true}
                  />
                  <Card.Content>{item.desc}</Card.Content>
                  {footerText && footerText.length > 0 && (
                    <Card.Footer>
                      <div className={list_footer_group}>
                        {footerText?.map(
                          (footerItem, footerIndex) =>
                            (!footerItem.display || footerItem.display === view) && (
                              <div className={list_footer_item} key={footerIndex}>
                                {footerItem.icon ?? footerItem.value} {getValueFromState(footerItem, item)}
                              </div>
                            )
                        )}
                      </div>
                    </Card.Footer>
                  )}
                </Card>
              ))}
            </div>
          ))}
          {hasNextPage && (
            <div ref={nextRef} className={list_loading}>
              Loading more...
            </div>
          )}
        </ScrollArea>
      )}
      <Outlet />
    </>
  )
}

export default List
