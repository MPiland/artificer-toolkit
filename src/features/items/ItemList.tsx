import {
  selectAllItems,
  useDeleteItemMutation,
  useGetItemsQuery,
} from './itemsApiSlice'
import {
  selectItemsFilter,
  setItemsFilter,
  clearItemsFilter,
} from '../items/itemsSlice'
import List from '../../components/List/List'

interface ItemListProps {
  scrollPosition: number
}

const ItemList = ({ scrollPosition }: ItemListProps) => {
  const { items } = useGetItemsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteItem] = useDeleteItemMutation()

  const tableColumns = {
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
        name: { sortOn: 'property' },
        value: 'Properties',
      },
      {
        name: { sortOn: 'damage.damageType' },
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
        name: 'property',
      },
      {
        name: [
          [
            'damage.dice.diceShort',
            'damage.dice.versatileDiceShort',
          ],
          'damage.damageType',
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
        name: ['cost.amount', 'cost.currency.short'],
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
      scrollPosition={scrollPosition}
      setFilter={setItemsFilter}
      filterReset={clearItemsFilter}
      selectFilter={selectItemsFilter}
    />
  )
}

export default ItemList
