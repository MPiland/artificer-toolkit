import List from '../../components/List/List'
import { useListEquipmentQuery, useDeleteEquipmentMutation } from './equipmentApi'
import IFlame from '../../assets/Icons/IFlame'
import ICategory from '../../assets/Icons/ICategory'
import IProps from '../../assets/Icons/IProps'
import IShield from '../../assets/Icons/IShield'
import IWeight from '../../assets/Icons/IWeight'
import IDollar from '../../assets/Icons/IDollar'
import { ReactElement, Suspense } from 'react'
import Loading from '../../components/Loading/Loading'

const ItemsList = () => {
  const footerText: { name: string | any | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: [{ path: 'category', source: { type: 'system', field: 'equipment.categories' } }],
      value: 'Category',
    },
    {
      icon: <IProps />,
      name: [{ path: 'properties', source: { type: 'system', field: 'equipment.properties' } }],
      value: 'Properties',
    },
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
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
      display: 'list',
    },
    {
      icon: <IShield />,
      value: 'Armor Class',
      name: 'armorClass',
      display: 'list',
    },
    {
      icon: <IWeight />,
      value: 'Weight',
      name: ['weight.amount', { path: 'weight.unit', source: { type: 'system', field: 'rules' } }],
      display: 'list',
    },
    {
      icon: <IDollar />,
      value: 'Cost',
      name: ['cost.amount', { path: 'cost.currency', source: { type: 'system', field: 'currencies' } }],
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListEquipmentQuery} useDeleteItem={useDeleteEquipmentMutation} footerText={footerText} />
    </Suspense>
  )
}

export default ItemsList
