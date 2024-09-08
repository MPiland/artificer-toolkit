import List from '../../components/List/List'
import { useGetEquipmentQuery, useDeleteEquipmentMutation } from './equipmentApi'
import IFlame from '../../assets/Icons/IFlame'
import ICategory from '../../assets/Icons/ICategory'
import IProps from '../../assets/Icons/IProps'
import IShield from '../../assets/Icons/IShield'
import IWeight from '../../assets/Icons/IWeight'
import IDollar from '../../assets/Icons/IDollar'
import { ReactElement } from 'react'

const ItemsList = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: 'category.value',
      value: 'Category',
    },
    {
      icon: <IProps />,
      name: 'properties.type',
      value: 'Properties',
    },
    {
      icon: <IFlame />,
      value: 'Damage',
      name: [['damage.primary.diceShort', 'damage.versatile.diceShort'], 'damage.primary.type'],
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
      name: ['weight.amount', 'weight.unit.short'],
      display: 'list',
    },
    {
      icon: <IDollar />,
      value: 'Cost',
      name: ['cost.amount', 'cost.currency.type.short'],
    },
  ]

  return <List useGetItems={useGetEquipmentQuery} useDeleteItem={useDeleteEquipmentMutation} footerText={footerText} />
}

export default ItemsList
