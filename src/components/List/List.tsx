import { useEffect, useState } from 'react'
import Group from '../Group/Group'
import Button from '../Button/Button'
import Table from '../Table/Table'
import { sprinkles } from '../../css/sprinkles.css'
import { isEqual, startCase } from 'lodash'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import useFilteredList from '../../hooks/useFilteredList'
import Spinner from '../Spinner/Spinner'
import { ActionCreatorWithPayload } from '@reduxjs/toolkit'
import Filter from './Filter'
import useIsLoading from '../../hooks/useIsLoading'
import Grid from '../Grid/Grid'
import { FormContext, RowHeader, RowInput } from '../../utils/types'

interface ListProps {
  tableColumns: {
    headers: RowHeader[]
    inputs: RowInput[]
  }
  context: FormContext
  items: any
  deleteItem: (arg: { id: number }) => Promise<any>
  setFilter: ActionCreatorWithPayload<any, string>
  subrow?: {
    collapse: boolean
    filter: string
    filterOn: string
    matchKey: string
  }
  filterReset: () => void
  selectFilter: (arg: any) => any
}

const List = ({
  tableColumns,
  context,
  items,
  deleteItem,
  setFilter,
  subrow,
  filterReset,
  selectFilter,
}: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const filterState = useSelector(selectFilter)

  const deleteConfirmed = location.state?.delete
  const itemToDelete = location.state?.item

  const { listFilter, filteredItems, setListFilter, setFilteredItems } = useFilteredList(items, filterState)

  const [errorMessage, setErrorMessage] = useState<string>()

  const onFilterReset = () => {
    filterReset()
    setListFilter({ type: 'reset', target: { value: {} } })
  }

  useEffect(() => {
    filterState != null && listFilter == null && setListFilter({ type: 'reset', target: { value: filterState } })
  }, [filterState, setListFilter, listFilter])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setFilter(listFilter))
  }, [dispatch, listFilter, setFilter])

  useEffect(() => {
    if (!isEqual(items, filteredItems) && Object.keys(filterState).length === 0) {
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
    }
    if (deleteConfirmed) {
      handleDeleteConfirmed()
    }
  }, [deleteConfirmed, itemToDelete, dispatch, deleteItem, setListFilter])

  const handleShowDetail = (item: any) => {
    navigate(`/${context.title}/${item.name}`, {
      state: {
        background: location,
        item: item,
        size: 'lg',
        form: context.title,
      },
    })
  }

  const handleCreate = (secondary?: boolean) => {
    if (secondary != null && secondary) {
      if (context.title === 'class') {
        return navigate(`/create/subclass`, {
          state: {
            background: location,
            formType: 'new',
            form: 'class',
            item: items.filter((item: any) => item.category.name === 'subclass'),
            defaultCategory: 'subclass',
          },
        })
      }
      if (context.title === 'race') {
        return navigate(`/create/subrace`, {
          state: {
            background: location,
            formType: 'new',
            form: 'race',
            item: items.filter((item: any) => item.category.name === 'subrace'),
            defaultCategory: 'subrace',
          },
        })
      }
    }
    navigate(`/create/${context.title}`, {
      state: {
        background: location,
        formType: 'new',
        form: context.title,
        item: items.filter((item: any) => (context.title === 'class' ? item.category.name === 'base' : item)),
        defaultCategory: context.title === 'class' || context.title === 'race' ? 'base' : null,
        items: items,
      },
    })
  }

  const handleDelete = (item: any) => {
    navigate(`/delete/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        item: item,
        size: 'sm',
        context: 'delete',
      },
    })
  }

  return isLoading || !filteredItems ? (
    <Spinner />
  ) : (
    <>
      <Group className={sprinkles({ my: 'size-3' })}>
        <h1>{startCase(`${context.title === 'class' ? 'classe' : context.title}s`)}</h1>
        <Grid
          cols={{
            lg: context.title === 'class' || context.title === 'race' ? 3 : 2,
            md: context.title === 'class' || context.title === 'race' ? 3 : 2,
            base: 2,
          }}
          className={sprinkles({ width: 'auto' })}
        >
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button type='button' variant='default' onClick={() => handleCreate()}>
            Create {context.title === 'item' ? 'an ' : 'a '}
            {startCase(context.title)}
          </Button>
          {(context.title === 'class' || context.title === 'race') && (
            <Button type='button' variant='default' onClick={() => handleCreate(true)}>
              Create a {context.title === 'class' ? 'Subclass' : 'Subrace'}
            </Button>
          )}
        </Grid>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      <Filter context={`${context.title}`} items={items} listFilter={listFilter} setListFilter={setListFilter} />
      <Table
        id={'list-table'}
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find((headerItem: any) => headerItem.defaultSort === true) ?? undefined}
        collapse={subrow?.collapse}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
          filters: subrow
            ? {
                filterOn: subrow?.filterOn as string,
                filterValue: subrow?.filter as string,
              }
            : undefined,
          subrow: subrow?.collapse && {
            data: items?.filter((item: any) => item.category.name === subrow.filter) as any[],
            matchKey: subrow.matchKey,
          },
        }}
        value={filteredItems as any[]}
        clickable={true}
        onClick={(item) => handleShowDetail(item)}
        deleteRow={(item) => handleDelete(item)}
        empty='---'
      />
    </>
  )
}

export default List
