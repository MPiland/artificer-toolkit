import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  selectAllItems,
  useDeleteItemMutation,
  useGetItemsQuery,
} from './itemsApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/modalSlice'
import {
  selectItemsFilter,
  setItemsFilter,
  clearItemsFilter,
} from '../items/itemsSlice'
import Spinner from '../../components/Spinner/Spinner'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import Grid from '../../components/Grid/Grid'
import Button from '../../components/Button/Button'
import Collapse from '../../components/Collapse/Collapse'
import { RootState } from '../../app/store'
import {
  RowHeader,
  RowInput,
  ReducerActionType,
  DropdownOption,
} from '../../utils/types'
import Group from '../../components/Group/Group'
import Dropdown from '../../components/Dropdown/Dropdown'
import { useMediaQuery } from 'usehooks-ts'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'
import useIsLoading from '../../hooks/useIsLoading'

const ItemList = ({ scrollPosition }: { scrollPosition: number }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const filtersState = useSelector(selectItemsFilter)

  const deleteConfirmed = useSelector((state: RootState) => state.modal.delete.status)
  const itemToDelete = useSelector((state: RootState) => state.modal.delete.data)

  const [deleteItem] = useDeleteItemMutation()

  const { listFilter, filteredItems, setListFilter, setFilteredItems } =
    useFilteredList(items as any[], filtersState)

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const [tableColumns, setTableColumns] = useState<{
    headers: RowHeader[]
    inputs: RowInput[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState<string>()

  const tableWindow = document.getElementById('list_table')

  const handleShowDetail = (item: any) => {
    navigate(`/items/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        context: 'itemCard',
        data: item,
        size: 'lg',
        scrollPosition: tableWindow?.scrollTop,
      },
    })
  }

  const handleDelete = (item: any) => {
    navigate(`/delete/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        data: item,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const handleDeleteSubmit = useCallback(async () => {
    try {
      await deleteItem({ id: itemToDelete._id })
      setListFilter({ type: 'reset', target: { value: {} } })
    } catch (err: any) {
      setErrorMessage(err.data.message)
    }
    dispatch(clearConfirm())
  }, [itemToDelete, dispatch, deleteItem, setListFilter])

  useEffect(() => {
    if (deleteConfirmed) {
      handleDeleteSubmit()
    }
  }, [deleteConfirmed, handleDeleteSubmit])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setItemsFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', target: filtersState })
  }, [filtersState, setListFilter])

  useEffect(() => {
    const itemsJSON = JSON.stringify(items)
    const filteredItemsJSON = JSON.stringify(filteredItems)
    if (
      itemsJSON !== filteredItemsJSON &&
      Object.keys(filtersState).length === 0
    ) {
      setFilteredItems(items)
    }
  }, [items, setFilteredItems, filteredItems, filtersState])

  useEffect(() => {
    if (scrollPosition && !isLoading) {
      tableWindow?.scroll(0, scrollPosition)
    }
  })

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: { sortOn: 'value' },
          value: 'Name',
          breakpoint: false,
          defaultSort: true,
        },
        {
          name: { sortOn: 'category.value' },
          value: 'Category',
          breakpoint: false,
        },
        {
          name: { sortOn: 'property' },
          value: 'Properties',
          breakpoint: false,
        },
        {
          name: { sortOn: 'damage.damageType' },
          value: 'Damage Type',
          breakpoint: sm && true,
        },
        {
          name: { sortOn: 'armorClass' },
          value: 'AC',
          breakpoint: sm && true,
        },
        {
          name: { sortOn: 'weight.amount', orderKey: 'weight.unit.short' },
          value: 'Weight',
          breakpoint: (sm || md) && true,
        },
        {
          name: { sortOn: 'quantity' },
          value: 'Qty',
          breakpoint: sm && true,
        },
        {
          name: {
            sortOn: 'cost.amount',
            orderKey: 'cost.currency.name',
            order: [
              { 1: 'copper' },
              { 2: 'silver' },
              { 3: 'etherium' },
              { 4: 'gold' },
              { 5: 'platinum' },
            ],
          },
          value: 'Cost',
          breakpoint: (sm || md) && true,
        },
      ],
      inputs: [
        {
          name: 'value',
          breakpoint: false,
        },
        {
          name: 'category.value',
          breakpoint: false,
        },
        {
          name: 'property',
          breakpoint: false,
        },
        {
          name: [
            [
              'damageprimaryDice.diceShort',
              'damageprimaryDice.versatileDiceShort',
            ],
            'damage.damageType',
          ],
          breakpoint: sm && true,
        },
        {
          name: 'armorClass',
          breakpoint: sm && true,
        },
        {
          name: ['weight.amount', 'weight.unit.short'],
          breakpoint: (sm || md) && true,
        },
        {
          name: 'quantity',
          breakpoint: sm && true,
        },
        {
          name: ['cost.amount', 'cost.currency.short'],
          breakpoint: (sm || md) && true,
        },
      ],
    })
  }, [setTableColumns, sm, md])

  const onFilterChange = (e: ReducerActionType) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearItemsFilter())
    setListFilter({ type: 'reset', target: {} })
  }

  const filter = (
    <Collapse title='Filters' startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Item Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='category'
          label='Item Category'
          placeholder='Select...'
          options={items?.map((item: any) => item.category) as DropdownOption[]}
          value={listFilter?.category}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='property'
          label='Item Property'
          options={
            items?.flatMap((item: any) => {
              if (item.property && Array.isArray(item.property)) {
                return item.property
              } else {
                return []
              }
            }) as DropdownOption[]
          }
          value={listFilter?.property}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='damage.damageType'
          label='Damage Type'
          options={
            items?.flatMap((item: any) => {
              if (item.damage && Array.isArray(item.damage.damageType)) {
                return item.damage.damageType
              } else {
                return []
              }
            }) as DropdownOption[]
          }
          value={listFilter?.damage?.damageType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='armorClass'
          label='AC'
          options={
            items?.map((item: any) => ({
              value: item.armorClass,
            })) as DropdownOption[]
          }
          value={listFilter.armorClass}
          onChange={(e) => onFilterChange(e)}
        />
      </Grid>
    </Collapse>
  )

  return isLoading || !filteredItems ? (
    <Spinner />
  ) : (
    <Container className={sprinkles({ pt: 'size-3' })}>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1>Items</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button
            type='button'
            variant='default'
            onClick={() => navigate('/items/new')}
          >
            Create an Item
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id='list_table'
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        value={filteredItems as any[]}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        clickable={true}
        onClick={(item) => handleShowDetail(item)}
        deleteRow={(item) => handleDelete(item)}
      />
    </Container>
  )
}

export default ItemList
