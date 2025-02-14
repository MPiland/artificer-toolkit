import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Equipment as EquipmentState } from '../../../amplify/gql/types'

const Equipment = () => {
  const location = useLocation()

  const equipment: EquipmentState = location.state.item

  const cols = [
    { header: 'CATEGORY', name: [{ path: 'category', source: { type: 'system', field: 'equipment.categories' } }] },
    {
      header: 'PROPERTIES',
      name: [{ path: 'properties', source: { type: 'system', field: 'equipment.properties' } }],
    },
    {
      header: 'DAMAGE/EFFECT',
      name: [
        [
          'damage.primary.diceShort',
          'damage.primary.setAmount',
          'damage.primary.pool.setAmount',
          { path: 'damage.primary.id', source: { type: 'system', field: 'damageTypes' } },
        ],
        [
          'damage.versatile.diceShort',
          'damage.versatile.setAmount',
          'damage.versatile.pool.setAmount',
          { path: 'damage.versatile.id', source: { type: 'system', field: 'damageTypes' } },
        ],
        { path: 'conditions', source: { type: 'system', field: 'conditions' } },
      ],
    },
    { header: 'AC', name: 'armorClass' },
    {
      header: 'WEIGHT',
      name: ['weight.amount', { path: 'weight.unit', source: { type: 'system', field: 'rules' } }],
    },
    {
      header: 'COST',
      name: ['cost.amount', { path: 'cost.currency', source: { type: 'system', field: 'currencies' } }],
    },
  ]

  return (
    <Detail cols={cols} colsData={equipment} footerSpacing='end'>
      <div>{equipment?.desc && parse(equipment.desc)}</div>
    </Detail>
  )
}

export default Equipment
