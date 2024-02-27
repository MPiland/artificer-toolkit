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

interface ListProps {
  filter: any
  tableColumns: {
    headers: any[]
    inputs: any[]
  }
  context: {
    type: string
    form: string
  }
  items: any
  deleteItem: (arg: { id: number }) => Promise<any>
  scrollPosition: number
  isLoading: boolean
  setFilter: ActionCreatorWithPayload<any, string>
  listFilterState: any
  collapse?: boolean
  selectFilter: (arg: any) => any
  filterReset: () => void
}

const List = ({
  filter,
  tableColumns,
  context,
  items,
  deleteItem,
  scrollPosition,
  isLoading,
  setFilter,
  listFilterState,
  collapse,
  selectFilter,
  filterReset,
}: ListProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()

  const filterState = useSelector(selectFilter)

  const deleteConfirmed = useSelector(
    (state: RootState) => state.modal.delete.status
  )

  const itemToDelete = useSelector(
    (state: RootState) => state.modal.delete.data
  )

  const { listFilter, filteredItems, setListFilter, setFilteredItems } =
    useFilteredList(items, listFilterState)

  const [errorMessage, setErrorMessage] = useState<string>()

  const table = document.getElementById('list-table')

  const onFilterReset = () => {
    filterReset()
    setListFilter({ type: 'reset', target: { value: {} } })
  }

  useEffect(() => {
    filterState != null &&
      setListFilter({ type: 'reset', target: { value: filterState } })
  }, [filterState, setListFilter])

  useEffect(() => {
    setListFilter({ type: 'reset', target: { value: listFilterState } })
  }, [listFilterState, setListFilter])

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

  const handleShowDetail = (spell: any) => {
    navigate(`/${context.form}/${spell.name}`, {
      state: {
        background: location,
        context: context.type,
        form: context.form,
        data: spell,
        size: 'lg',
        scrollPosition: table?.scrollTop,
      },
    })
  }

  const handleCreate = () => {
    navigate(`/create/${context.type}`, {
      state: {
        background: location,
        context: context.type,
        form: context.form,
        data: items,
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
    <Container className={sprinkles({ pt: 'size-3' })}>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1>{startCase(context.form)}</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button type='button' variant='default' onClick={handleCreate}>
            Create {context.type === 'item' ? 'an' : 'a'}{' '}
            {startCase(context.type)}
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id={'list-table'}
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem: any) => headerItem.defaultSort === true
        )}
        collapse={collapse}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
          filters: { filterOn: 'category.name', filterValue: 'subclass' },
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
  )
}

export default List
