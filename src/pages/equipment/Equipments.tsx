import { useDeleteEquipmentMutation } from '@/apis/equipment.api'
import IFlame from '@/assets/Icons/IFlame'
import ICategory from '@/assets/Icons/ICategory'
import IProps from '@/assets/Icons/IProps'
import IShield from '@/assets/Icons/IShield'
import IWeight from '@/assets/Icons/IWeight'
import IDollar from '@/assets/Icons/IDollar'
import type { EquipmentMeta } from '@/types'
import List, { type FooterConfig } from '@/components/List'
import { useEquipmentData } from '@/hooks'

const Equipments = () => {
  const { equipment, metaData } = useEquipmentData()
  const footerConfigs: FooterConfig<EquipmentMeta>[] = [
    {
      icon: <ICategory />,
      text: {
        metaObject: 'categories',
        paths: [
          {
            path: 'id',
            source: { type: 'system', sourcePath: 'equipment.categories' },
          },
        ],
      },
      value: 'Category',
    },
    {
      icon: <IProps />,
      text: {
        metaObject: 'properties',
        paths: [
          {
            path: 'id',
            source: { type: 'system', sourcePath: 'equipment.properties' },
          },
        ],
      },
      value: 'Properties',
    },
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
      text: [
        {
          metaObject: 'primaryDamages',
          paths: [
            {
              path: 'id',
              source: { type: 'system', sourcePath: 'damageTypes' },
            },
          ],
        },
        {
          metaObject: 'secondaryDamages',
          paths: [
            {
              path: 'id',
              source: { type: 'system', sourcePath: 'damageTypes' },
            },
          ],
        },
        {
          metaObject: 'versatileDamages',
          paths: [
            {
              path: 'id',
              source: { type: 'system', sourcePath: 'damageTypes' },
            },
          ],
        },
      ],
      display: 'list',
    },
    {
      icon: <IShield />,
      value: 'Armor Class',
      text: {
        metaObject: 'armorClasses',
        paths: [
          {
            path: 'id',
          },
        ],
      },
      display: 'list',
    },
    {
      icon: <IWeight />,
      value: 'Weight',
      text: {
        metaObject: 'weight',
        paths: [
          {
            path: 'amount',
            source: { type: 'system', sourcePath: 'rules.measurements.imperial.weight', labelKey: 'short' },
          },
        ],
      },
      display: 'list',
    },
    {
      icon: <IDollar />,
      value: 'Cost',
      text: {
        metaObject: 'cost',
        paths: [
          {
            path: 'amount',
            source: { type: 'system', sourcePath: 'currencies', labelKey: 'abbreviation' },
          },
        ],
      },
    },
  ]

  return (
    <List
      data={equipment}
      metaData={metaData}
      useDeleteItem={useDeleteEquipmentMutation}
      footerConfigs={footerConfigs}
    />
  )
}

export default Equipments
