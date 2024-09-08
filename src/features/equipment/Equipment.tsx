import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Item = () => {
  const location = useLocation()

  const item = location.state.item

  const cols = [
    { header: 'CATEGORY', name: 'category.value' },
    {
      header: 'PROPERTIES',
      name: 'properties.type',
    },
    {
      header: 'DAMAGE TYPE',
      name: [['damage.primary.diceShort', 'damage.versatile.diceShort'], 'damage.primary.type'],
    },
    { header: 'AC', name: 'armorClass' },
    {
      header: 'WEIGHT',
      name: ['weight.amount', 'weight.unit.short'],
    },
    { header: 'COST', name: ['cost.amount', 'cost.currency.type.short'] },
  ]
  return !item ? (
    <Spinner />
  ) : (
    <Detail cols={cols} colsData={item} footerSpacing='end'>
      <div>{item?.desc && parse(item.desc)}</div>
    </Detail>
  )
}

export default Item
