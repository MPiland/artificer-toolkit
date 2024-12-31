import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Equipment as EquipmentState } from '../../../amplify/API'

const Equipment = () => {
  const location = useLocation()

  const equipment: EquipmentState = location.state.equipment

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
  return (
    <Detail cols={cols} colsData={equipment} footerSpacing='end'>
      <div>{equipment?.desc && parse(equipment.desc)}</div>
    </Detail>
  )
}

export default Equipment
