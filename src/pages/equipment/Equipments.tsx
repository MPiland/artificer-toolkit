import List from '../../components/List/List'
import { useDeleteEquipmentMutation } from '../../apis/equipmentApi'
import IFlame from '../../assets/Icons/IFlame'
import ICategory from '../../assets/Icons/ICategory'
import IProps from '../../assets/Icons/IProps'
import IShield from '../../assets/Icons/IShield'
import IWeight from '../../assets/Icons/IWeight'
import IDollar from '../../assets/Icons/IDollar'
import { Suspense } from 'react'
import Loading from '../../components/Loading/Loading'
import type { EquipmentMeta } from '../../../amplify/gql/types'
import type { FooterConfig } from '../../types/components'
import useEquipmentData from '../../hooks/useEquipmentData'

const Equipments = () => {
  const { all: equipments, metaData } = useEquipmentData()
  const footerConfigs: FooterConfig<EquipmentMeta>[] = [
    {
      icon: <ICategory />,
      text: [{ metaPath: 'categories', source: { type: 'system', sourcePath: 'equipment.categories' } }],
      value: 'Category',
    },
    {
      icon: <IProps />,
      text: [{ metaPath: 'properties', source: { type: 'system', sourcePath: 'equipment.properties' } }],
      value: 'Properties',
    },
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
      text: [
        { metaPath: 'primaryDamages', source: { type: 'system', sourcePath: 'damageTypes' } },
        { metaPath: 'secondaryDamages', source: { type: 'system', sourcePath: 'damageTypes' } },
      ],
      display: 'list',
    },
    {
      icon: <IShield />,
      value: 'Armor Class',
      text: { metaPath: 'armorClasses' },
      display: 'list',
    },
    {
      icon: <IWeight />,
      value: 'Weight',
      text: [
        { metaPath: 'weight', subMetaPath: 'amount' },
        {
          metaPath: 'weight',
          source: { type: 'system', sourcePath: 'rules.measurements.imperial.weight', labelKey: 'short' },
        },
      ],
      display: 'list',
    },
    {
      icon: <IDollar />,
      value: 'Cost',
      text: [
        { metaPath: 'cost', subMetaPath: 'amount' },
        { metaPath: 'cost', source: { type: 'system', sourcePath: 'currencies', labelKey: 'abbreviation' } },
      ],
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List
        data={equipments}
        metaData={metaData}
        useDeleteItem={useDeleteEquipmentMutation}
        footerConfigs={footerConfigs}
      />
    </Suspense>
  )
}

export default Equipments
