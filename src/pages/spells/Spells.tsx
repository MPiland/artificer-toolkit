import List, { type FilterConfig, type FooterConfig } from '~/components/List'
import IFlame from '~/assets/Icons/IFlame'
import IClass from '~/assets/Icons/IClass'
import IBook from '~/assets/Icons/IBook'
import IClock from '~/assets/Icons/IClock'
import IRange from '~/assets/Icons/IRange'
import IMortPest from '~/assets/Icons/IMortPest'
import type { Spell, SpellMeta } from '~/types'
import { useListSpells, useDeleteSpell } from '~/apis'

const Spells = () => {
  const {
    data: { spells, metaData },
  } = useListSpells()
  const footerConfigs: FooterConfig<SpellMeta>[] = [
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
          metaObject: 'conditions',
          paths: [
            {
              path: 'id',
              source: { type: 'system', sourcePath: 'conditions' },
            },
          ],
        },
      ],
    },
    {
      icon: <IClass />,
      value: 'Classes',
      text: [{ metaObject: 'classes', paths: [{ path: 'id', source: { type: 'classes' } }] }],
    },
    {
      icon: <IBook />,
      text: [
        {
          metaObject: 'schools',
          paths: [{ path: 'id', source: { type: 'system', sourcePath: 'spells.schools' } }],
        },
      ],
      value: 'School',
    },
    {
      icon: <IClock />,
      value: 'Time',
      text: [
        {
          metaObject: 'primaryActions',
          paths: [
            {
              path: 'amount',
            },
            { path: 'id', source: { type: 'system', sourcePath: 'actions' }, dependents: true },
          ],
        },
        {
          metaObject: 'secondaryActions',
          paths: [
            {
              path: 'amount',
            },
            { path: 'id', source: { type: 'system', sourcePath: 'actions' }, dependents: true },
          ],
        },
        {
          metaObject: 'durations',
          paths: [
            { path: 'amount' },
            { path: 'id', source: { type: 'system', sourcePath: 'spells.durations' }, dependents: true },
          ],
        },
      ],
      display: 'list',
    },
    {
      icon: <IRange />,
      value: 'Range (ft)/Area (ft)',
      text: [
        {
          metaObject: 'ranges',
          paths: [
            {
              path: 'id',
              source: { type: 'system', sourcePath: 'spells.ranges' },
              dependents: true,
              subPaths: [
                [
                  {
                    path: 'minRange',
                    dependents: true,
                  },
                  {
                    path: 'unit',
                    source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
                  },
                ],
                [
                  {
                    path: 'maxRange',
                    dependents: true,
                  },
                  {
                    path: 'unit',
                    source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
                  },
                ],
                [
                  {
                    path: 'distance',
                    dependents: true,
                  },
                  {
                    path: 'unit',
                    source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
                  },
                ],
              ],
            },
          ],
        },
        {
          metaObject: 'shapes',
          paths: [
            { path: 'id', source: { type: 'system', sourcePath: 'spells.shapes' }, dependents: true },
            {
              path: 'size',
            },
            {
              path: 'unit',
              source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
            },
          ],
        },
      ],
      display: 'list',
    },
    {
      icon: <IMortPest />,
      value: 'Requirements',
      text: {
        metaObject: 'requirements',
        paths: [
          {
            path: 'id',
            source: { type: 'system', sourcePath: 'spells.requirements' },
          },
        ],
      },
      display: 'list',
    },
  ]

  const filterConfigs: FilterConfig<Partial<Spell>, SpellMeta>[] = [
    {
      type: 'text',
      path: 'label',
      label: 'Spell Name',
    },
    {
      type: 'multiSelect',
      path: 'level',
      label: 'Spell Level',
      options: {
        metaPath: 'levels',
      },
    },
    {
      type: 'multiSelect',
      path: 'school',
      label: 'Magic School',
      options: {
        metaPath: 'schools',
        source: { type: 'system', sourcePath: 'spells.schools' },
      },
    },
    {
      type: 'multiSelect',
      path: 'damage.primary.id',
      label: 'Prim. Damage',
      options: {
        metaPath: 'primaryDamages',
        source: { type: 'system', sourcePath: 'damageTypes' },
      },
    },
    {
      type: 'multiSelect',
      path: 'damage.secondary.id',
      label: 'Sec. Damage',
      options: {
        metaPath: 'secondaryDamages',
        source: { type: 'system', sourcePath: 'damageTypes' },
      },
    },
    {
      type: 'multiSelect',
      path: 'conditions',
      label: 'Condition',
      options: {
        metaPath: 'conditions',
        source: { type: 'system', sourcePath: 'conditions' },
      },
    },
  ]

  return (
    <List
      data={spells}
      metaData={metaData}
      useDeleteItem={useDeleteSpell}
      footerConfigs={footerConfigs}
      filterConfigs={filterConfigs}
    />
  )
}

export default Spells
