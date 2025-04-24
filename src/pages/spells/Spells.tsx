import { useDeleteSpellMutation } from '@/apis/spellsApi'
import List, { type FilterConfig, type FooterConfig } from '@/components/List'
import { Suspense } from 'react'
import IFlame from '@/assets/Icons/IFlame'
import IClass from '@/assets/Icons/IClass'
import IBook from '@/assets/Icons/IBook'
import IClock from '@/assets/Icons/IClock'
import IRange from '@/assets/Icons/IRange'
import IMortPest from '@/assets/Icons/IMortPest'
import Loading from '@/components/Loading'
import type { Spell, SpellMeta } from '@/types'
import { useSpellData } from '@/hooks'

const Spells = () => {
  const { spells, metaData } = useSpellData()
  const footerConfigs: FooterConfig<SpellMeta>[] = [
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
      text: [
        [{ metaPath: 'primaryDamages', source: { type: 'system', sourcePath: 'damageTypes' } }],
        [{ metaPath: 'secondaryDamages', source: { type: 'system', sourcePath: 'damageTypes' } }],
        [{ metaPath: 'conditions', source: { type: 'system', sourcePath: 'conditions' } }],
      ],
    },
    {
      icon: <IClass />,
      value: 'Classes',
      text: [{ metaPath: 'classes', source: { type: 'classes' } }],
    },
    {
      icon: <IBook />,
      text: [{ metaPath: 'schools', source: { type: 'system', sourcePath: 'spells.schools' } }],
      value: 'School',
    },
    {
      icon: <IClock />,
      value: 'Time',
      text: [
        [
          [{ metaPath: 'primaryActions', source: { type: 'system', sourcePath: 'actions' } }],
          [{ metaPath: 'secondaryActions', source: { type: 'system', sourcePath: 'actions' } }],
        ],
        [
          { metaPath: 'durations', source: { type: 'system', sourcePath: 'spells.durations' } },
          { metaPath: 'durations', subMetaPath: 'amount' },
        ],
      ],
      display: 'list',
    },
    {
      icon: <IRange />,
      value: 'Range (ft)/Area (ft)',
      text: [
        [
          { metaPath: 'ranges', source: { type: 'system', sourcePath: 'spells.ranges' } },
          [
            { metaPath: 'ranges', subMetaPath: 'minRange' },
            {
              metaPath: 'ranges',
              subMetaPath: 'unit',
              source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
            },
          ],
          [
            { metaPath: 'ranges', subMetaPath: 'maxRange' },
            {
              metaPath: 'ranges',
              subMetaPath: 'unit',
              source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
            },
          ],
          [
            { metaPath: 'ranges', subMetaPath: 'distance' },
            {
              metaPath: 'ranges',
              subMetaPath: 'unit',
              source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
            },
          ],
        ],
        [
          { metaPath: 'shapes', source: { type: 'system', sourcePath: 'spells.shapes' } },
          { metaPath: 'shapes', subMetaPath: 'size' },
          {
            metaPath: 'shapes',
            subMetaPath: 'unit',
            source: { type: 'system', sourcePath: 'rules.measurements.imperial.length', labelKey: 'short' },
          },
        ],
      ],
      display: 'list',
    },
    {
      icon: <IMortPest />,
      value: 'Requirements',
      text: { metaPath: 'requirements', source: { type: 'system', sourcePath: 'spells.requirements' } },
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
        source: { type: 'system', sourcePath: 'damageTypes' },
      },
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List
        data={spells}
        metaData={metaData}
        useDeleteItem={useDeleteSpellMutation}
        footerConfigs={footerConfigs}
        filterConfigs={filterConfigs}
      />
    </Suspense>
  )
}

export default Spells
