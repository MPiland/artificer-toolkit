import { useReducer } from 'react'
import {
  selectAllItems,
  useDeleteItemMutation,
  useGetItemsQuery,
} from './itemsApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectItemsFilter,
  setItemsFilter,
  clearItemsFilter,
} from '../items/itemsSlice'
import Input from '../../components/Input/Input'
import Grid from '../../components/Grid/Grid'
import Collapse from '../../components/Collapse/Collapse'
import { DropdownOption } from '../../utils/types'
import Dropdown from '../../components/Dropdown/Dropdown'
import { useMediaQuery } from 'usehooks-ts'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import formReducer from '../../hooks/useReducer'
import List from '../../components/List/List'

interface ItemListProps {
  scrollPosition: number
}

const ItemList = ({ scrollPosition }: ItemListProps) => {
  const isLoading = useIsLoading()
  const dispatch = useDispatch()

  const filterState = useSelector(selectItemsFilter)

  const [listFilter, setListFilter] = useReducer(formReducer, filterState)

  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteItem] = useDeleteItemMutation()

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const tableColumns = {
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
  }

  const clearFilters = () => {
    setListFilter({ type: 'reset', target: { value: {} } })
    dispatch(clearItemsFilter())
  }

  const filter = (
    <Collapse title='Filters' startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Item Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='category'
          label='Item Category'
          placeholder='Select...'
          options={items?.map((item: any) => item.category) as DropdownOption[]}
          value={listFilter?.category}
          onChange={setListFilter}
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
          onChange={setListFilter}
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
          onChange={setListFilter}
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
          onChange={setListFilter}
        />
      </Grid>
    </Collapse>
  )

  return (
    <List
      filter={filter}
      tableColumns={tableColumns}
      context={{ type: 'item', form: 'items' }}
      items={items}
      deleteItem={deleteItem}
      scrollPosition={scrollPosition}
      isLoading={isLoading}
      setFilter={setItemsFilter}
      listFilterState={listFilter}
      selectFilter={selectItemsFilter}
      filterReset={clearFilters}
    />
  )
}

export default ItemList
