import { useRouterState } from '@tanstack/react-router'
import parse from 'html-react-parser'
import Detail from '../../components/Detail/Detail'
import { Equipment as EquipmentState } from '../../../amplify/gql/types'
import { FormDataType } from '../../types/form'

// Type guard function
function isEquipment(item: FormDataType | undefined): item is EquipmentState {
  return item?.__typename === 'Equipment'
}

const Equipment = () => {
  const equipment = useRouterState({ select: (s) => s.location.state.item })

  if (!equipment || !isEquipment(equipment)) return <div>Invalid or missing equipment data</div>

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
    <Detail cols={cols} colsData={equipment} footerSpacing='end' item={equipment}>
      <div>{equipment?.desc && parse(equipment.desc)}</div>
    </Detail>
  )
}

export default Equipment
