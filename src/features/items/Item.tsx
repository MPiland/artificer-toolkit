import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectItemById, useGetItemsQuery } from './itemsApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Item = () => {
  const location = useLocation()

  const { item, isLoading, isFetching } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      item: data && selectItemById(data, location.state.data.id),
      isLoading,
      isFetching,
    }),
  })

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

  let content

  if (isLoading || !item || isFetching) {
    return (content = <Spinner />)
  }

  const detail = <div>{(item as any)?.desc && parse((item as any).desc)}</div>

  content = (
    <Detail
      cols={cols}
      location={location}
      colsData={item}
      detail={detail}
      footerSpacing='end'
    />
  )

  return content
}

export default Item
