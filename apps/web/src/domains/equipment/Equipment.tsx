import parse from 'html-react-parser'
import Detail from '~components/Detail'
import { Route } from '~routes/_authed/equipment/$equipmentId'
import type { DetailConfig } from '~components/Detail'
import type { Equipment } from '~types'
import {useGetEquipment} from '~apis'

const Equipment = () => {
  const equipmentId = Route.useParams({ select: (r) => r.equipmentId })

  const { data: equipment } = useGetEquipment(equipmentId)

  if (!equipment) return <div>Invalid or missing equipment data</div>

  const detailConfigs: DetailConfig<Equipment>[] = [
    { header: 'CATEGORY', text: [{ path: 'category', source: { type: 'system', path: 'equipment.categories' } }] },
    {
      header: 'PROPERTIES',
      text: [{ path: 'properties', source: { type: 'system', path: 'equipment.properties' } }],
    },
    {
      header: 'DAMAGE/EFFECT',
      text: [
        [
          { path: 'damage.primary.dieConfig' },
          { path: 'damage.primary.setAmount' },
          { path: 'damage.primary.pool.setAmount' },
          { path: 'damage.primary.id', source: { type: 'system', path: 'damageTypes' } },
        ],
        [
          { path: 'damage.versatile.dieConfig' },
          { path: 'damage.versatile.setAmount' },
          { path: 'damage.versatile.pool.setAmount' },
          { path: 'damage.versatile.id', source: { type: 'system', path: 'damageTypes' } },
        ],
      ],
    },
    { header: 'AC', text: { path: 'armorClass' } },
    {
      header: 'WEIGHT',
      text: [{ path: 'weight.amount' }, { path: 'weight.unit', source: { type: 'system', path: 'rules' } }],
    },
    {
      header: 'COST',
      text: [{ path: 'cost.amount' }, { path: 'cost.currency', source: { type: 'system', path: 'currencies' } }],
    },
  ]

  return (
    <Detail detailConfigs={detailConfigs} item={equipment}>
      <div>{equipment?.desc && parse(equipment.desc)}</div>
    </Detail>
  )
}

export default Equipment
