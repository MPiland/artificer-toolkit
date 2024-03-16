import { useEffect, useState } from 'react'
import Container from '../Container/Container'
import Group from '../Group/Group'
import Button from '../Button/Button'
import Table from '../Table/Table'
import { sprinkles } from '../../css/sprinkles.css'
import { isEqual, startCase } from 'lodash'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/modalSlice'
import { RootState } from '../../app/store'
import useFilteredList from '../../hooks/useFilteredList'
import Spinner from '../Spinner/Spinner'
import { ActionCreatorWithPayload } from '@reduxjs/toolkit'
import Filter from './Filter'
import useIsLoading from '../../hooks/useIsLoading'
import Grid from '../Grid/Grid'
import { FormContext } from '../../utils/types'

interface ListProps {
  tableColumns: {
    headers: any[]
    inputs: any[]
  }
  context: FormContext
  items: any
  deleteItem: (arg: { id: number }) => Promise<any>
  scrollPosition: number
  setFilter: ActionCreatorWithPayload<any, string>
  collapse?: boolean
  filterReset: () => void
  selectFilter: (arg: any) => any
}

const List = ({
  tableColumns,
  context,
  items,
  deleteItem,
  scrollPosition,
  setFilter,
  collapse,
  filterReset,
  selectFilter,
}: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const filterState = useSelector(selectFilter)

  const deleteConfirmed = useSelector(
    (state: RootState) => state.modal.delete.status
  )

  const itemToDelete = useSelector(
    (state: RootState) => state.modal.delete.data
  )

  const { listFilter, filteredItems, setListFilter, setFilteredItems } =
    useFilteredList(items, filterState)

  const [errorMessage, setErrorMessage] = useState<string>()

  const table = document.getElementById('list-table')

  const onFilterReset = () => {
    filterReset()
    setListFilter({ type: 'reset', target: { value: {} } })
  }

  useEffect(() => {
    filterState != null &&
      listFilter == null &&
      setListFilter({ type: 'reset', target: { value: filterState } })
  }, [filterState, setListFilter, listFilter])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setFilter(listFilter))
  }, [dispatch, listFilter, setFilter])

  useEffect(() => {
    if (scrollPosition && !isLoading) {
      table?.scroll(0, scrollPosition)
    }
  })

  useEffect(() => {
    if (
      !isEqual(items, filteredItems) &&
      Object.keys(filterState).length === 0
    ) {
      setFilteredItems(items)
    }
  }, [items, setFilteredItems, filteredItems, filterState])

  useEffect(() => {
    const handleDeleteConfirmed = async () => {
      try {
        await deleteItem({ id: itemToDelete.id })
        setListFilter({ type: 'reset', target: { value: {} } })
      } catch (err: any) {
        setErrorMessage(err.data.message)
      }
      dispatch(clearConfirm())
    }
    if (deleteConfirmed) {
      handleDeleteConfirmed()
    }
  }, [deleteConfirmed, itemToDelete, dispatch, deleteItem, setListFilter])

  const handleShowDetail = (item: any) => {
    navigate(
      `/${context.title === 'class' ? 'classe' : context.title}s/${item.name}`,
      {
        state: {
          background: location,
          form: `${context.title === 'class' ? 'classe' : context.title}s`,
          data: item,
          size: 'lg',
          scrollPosition: table?.scrollTop,
          title: item.value,
        },
      }
    )
  }

  const handleCreate = (secondary?: boolean) => {
    if (secondary != null && secondary) {
      return navigate(`/create/subclass`, {
        state: {
          background: location,
          context: context.type,
          form: `${context.title === 'class' ? 'classe' : context.title}s`,
          data: items.filter((item: any) =>
            context.title === 'class' ? item.category.name === 'subclass' : item
          ),
        },
      })
    }
    navigate(`/create/${context.title}`, {
      state: {
        background: location,
        context: context,
        form: `${context.title === 'class' ? 'classe' : context.title}s`,
        data: items.filter((item: any) =>
          context.title === 'class' ? item.category.name === 'base' : item
        ),
      },
    })
  }

  const handleDelete = (item: any) => {
    navigate(`/delete/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        data: item,
        size: 'sm',
        context: 'delete',
      },
    })
  }

  return isLoading || !filteredItems ? (
    <Spinner />
  ) : (
    <>
      <Container className={sprinkles({ pt: 'size-3' })}>
        <Group className={sprinkles({ mb: 'size-3' })}>
          <h1>
            {startCase(
              `${context.title === 'class' ? 'classe' : context.title}s`
            )}
          </h1>
          <Grid
            cols={{
              lg: context.title === 'class' ? 3 : 2,
              md: context.title === 'class' ? 3 : 2,
              base: context.title === 'class' ? 3 : 2,
            }}
            className={sprinkles({ width: 'auto' })}
          >
            <Button type='button' variant='default' onClick={onFilterReset}>
              Clear Filters
            </Button>
            <Button
              type='button'
              variant='default'
              onClick={() => handleCreate()}
            >
              Create {context.title === 'item' ? 'an ' : 'a '}
              {startCase(context.title)}
            </Button>
            {context.title === 'class' && (
              <Button
                type='button'
                variant='default'
                onClick={() => handleCreate(true)}
              >
                Create a Subclass
              </Button>
            )}
          </Grid>
        </Group>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        <Filter
          context={`${context.title === 'class' ? 'classe' : context.title}s`}
          items={items}
          listFilter={listFilter}
          setListFilter={setListFilter}
        />
        <Table
          id={'list-table'}
          addRow={false}
          readOnly={true}
          sortable={true}
          defaultSort={
            tableColumns.headers.find(
              (headerItem: any) => headerItem.defaultSort === true
            ) ?? undefined
          }
          collapse={collapse}
          rows={{
            inputs: tableColumns.inputs,
            headers: tableColumns.headers,
            filters:
              context.title === 'class'
                ? {
                    filterOn: 'category.name',
                    filterValue: 'subclass',
                  }
                : undefined,
            subrow: collapse && {
              data: items?.filter(
                (item: any) => item.category.name === 'subclass'
              ) as any[],
              matchKey: 'parentClass._id',
            },
          }}
          value={filteredItems as any[]}
          clickable={true}
          onClick={(item) => handleShowDetail(item)}
          deleteRow={(item) => handleDelete(item)}
          empty='---'
        />
      </Container>
    </>
  )
}

export default List
