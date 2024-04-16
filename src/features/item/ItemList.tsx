import {
  selectAllItems,
  useDeleteItemMutation,
  useGetItemsQuery,
} from './itemApiSlice'
import {
  selectFilter,
  setItem,
  clearFilter,
} from './itemSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

const ItemList = () => {
  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const [deleteItem] = useDeleteItemMutation()

  const tableColumns: { headers: RowHeader[]; inputs: RowInput[] } = {
    headers: [
      {
        name: { sortOn: 'value' },
        value: 'Name',
        defaultSort: true,
      },
      {
        name: { sortOn: 'category.value' },
        value: 'Category',
      },
      {
        name: { sortOn: 'property.type' },
        value: 'Properties',
      },
      {
        name: { sortOn: 'damage.primary.type' },
        value: 'Damage Type',
        breakpoint: ['sm'],
      },
      {
        name: { sortOn: 'armorClass' },
        value: 'AC',
        breakpoint: ['sm'],
      },
      {
        name: { sortOn: 'weight.amount', orderKey: 'weight.unit.short' },
        value: 'Weight',
        breakpoint: ['sm', 'md'],
      },
      {
        name: { sortOn: 'quantity' },
        value: 'Qty',
        breakpoint: ['sm'],
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
        breakpoint: ['sm', 'md'],
      },
    ],
    inputs: [
      {
        name: 'value',
      },
      {
        name: 'category.value',
      },
      {
        name: 'property.type',
      },
      {
        name: [
          ['damage.primary.diceShort', 'damage.versatile.diceShort'],
          'damage.primary.type',
        ],
        breakpoint: ['sm'],
      },
      {
        name: 'armorClass',
        breakpoint: ['sm'],
      },
      {
        name: ['weight.amount', 'weight.unit.short'],
        breakpoint: ['sm', 'md'],
      },
      {
        name: 'quantity',
        breakpoint: ['sm'],
      },
      {
        name: ['cost.amount', 'cost.currency.type.short'],
        breakpoint: ['sm', 'md'],
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ title: 'item' }}
      items={items}
      deleteItem={deleteItem}
      setFilter={setItem}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}

export default ItemList
