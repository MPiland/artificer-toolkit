import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectItemById, useGetItemsQuery } from './itemApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Item = () => {
  const location = useLocation()

  const {
    item,
    isLoading,
    isFetching,
  }: { item: any; isFetching: boolean; isLoading: boolean } = useGetItemsQuery(
    'itemsList',
    {
      selectFromResult: ({ data, isLoading, isFetching }) => ({
        item: data && selectItemById(data, location.state.data.id),
        isLoading,
        isFetching,
      }),
    }
  )

  const cols = [
    { header: 'CATEGORY', name: 'category.value' },
    {
      header: 'PROPERTIES',
      name: 'property',
    },
    {
      header: 'DAMAGE TYPE',
      name: [
        ['damageprimaryDice.diceShort', 'damageprimaryDice.versatileDiceShort'],
        'damage.damageType',
      ],
    },
    { header: 'AC', name: 'armorClass' },
    {
      header: 'WEIGHT',
      name: ['weight.amount', 'weight.unit.short'],
    },
    { header: 'COST', name: ['cost.amount', 'cost.currency.short'] },
  ]

  const detail = <div>{item?.desc && parse(item.desc)}</div>

  return isLoading || !item || isFetching ? (
    <Spinner />
  ) : (
    <Detail
      cols={cols}
      location={location}
      colsData={item}
      detail={detail}
      footerSpacing='end'
    />
  )
}

export default Item
