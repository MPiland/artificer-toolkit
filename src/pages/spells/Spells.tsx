import { useDeleteSpellMutation, useListSpellsQuery } from '../../apis/spellsApi'
import List from '../../components/List/List'
import { ReactElement, Suspense } from 'react'
import IFlame from '../../assets/Icons/IFlame'
import IClass from '../../assets/Icons/IClass'
import IBook from '../../assets/Icons/IBook'
import IClock from '../../assets/Icons/IClock'
import IRange from '../../assets/Icons/IRange'
import IMortPest from '../../assets/Icons/IMortPest'
import Loading from '../../components/Loading/Loading'
import { FilterConfig } from '../../types/components'
import { Spell } from '../../../amplify/gql/types'
import { useGetSystemQuery } from '../../apis/systemsApi'
import { createFilterOptions } from '../../utils/form'

const Spells = () => {
  const { data: system } = useGetSystemQuery()

  const footerText: { name: string | any | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
      name: [
        [
          'damage.primary.dieShort',
          'damage.primary.setAmount',
          'damage.primary.pool.setAmount',
          { path: 'damage.primary.id', source: { type: 'system', field: 'damageTypes' } },
        ],
        [
          'damage.secondary.dieShort',
          'damage.secondary.setAmount',
          'damage.secondary.pool.setAmount',
          { path: 'damage.secondary.id', source: { type: 'system', field: 'damageTypes' } },
        ],
        { path: 'conditions', source: { type: 'system', field: 'conditions' } },
      ],
    },
    {
      icon: <IClass />,
      value: 'Classes',
      name: [{ path: 'classes', source: { type: 'classes' } }],
    },
    {
      icon: <IBook />,
      name: [{ path: 'school', source: { type: 'system', field: 'spells.schools' } }],
      value: 'School',
    },
    {
      icon: <IClock />,
      value: 'Time',
      name: [
        [
          ['actions.primary.amount', { path: 'actions.primary.id', source: { type: 'system', field: 'actions' } }],
          ['actions.secondary.amount', { path: 'actions.secondary.id', source: { type: 'system', field: 'actions' } }],
        ],
        ['duration.amount', { path: 'duration.id', source: { type: 'system', field: 'spells.durations' } }],
      ],
      display: 'list',
    },
    {
      icon: <IRange />,
      value: 'Range (ft)/Area (ft)',
      name: [
        [{ path: 'range.id', source: { type: 'system', field: 'spells.ranges' } }, 'range.minRange'],
        ['range.maxRange', { path: 'range.unit', source: { type: 'system', field: 'rules' } }],
        [
          { path: 'shape.id', source: { type: 'system', field: 'spells.shapes' } },
          'shape.size',
          { path: 'shape.unit', source: { type: 'system', field: 'rules' } },
        ],
      ],
      display: 'list',
    },
    {
      icon: <IMortPest />,
      value: 'Requirements',
      name: { path: 'requirements', source: { type: 'system', field: 'spells.requirements' } },
      display: 'list',
    },
  ]

  const spellFilterConfigs: FilterConfig<Partial<Spell>>[] = [
    {
      type: 'text',
      path: 'label',
      label: 'Spell Name',
    },
    {
      type: 'multiSelect',
      path: 'level',
      label: 'Spell Level',
      getOptionsFromData: (data) => {
        const levels = [...(data?.map((spell) => spell.level) || [])]
          .filter((level) => level !== undefined)
          .sort((a, b) => a - b)

        return levels.map((level) => ({
          value: level,
          label: String(level),
          id: String(level),
        }))
      },
    },
    {
      type: 'multiSelect',
      path: 'school',
      label: 'Magic School',
      getOptionsFromData: (data) => {
        const schoolIds = [...(data?.map((spell) => spell.school) || [])].filter(Boolean)

        const schools = schoolIds.map((id) => system?.spells?.schools?.find((s) => s?.id === id))

        return createFilterOptions(
          schools,
          (school) => school?.value,
          (school) => school?.label,
          (school) => school?.id
        )
      },
    },
    {
      type: 'multiSelect',
      path: 'damage.primary.id',
      label: 'Prim. Damage',
      getOptionsFromData: (data) => {
        const damageIds = [
          ...(data?.map((spell) => {
            return spell?.damage?.primary?.id
          }) || []),
        ].filter(Boolean)

        const damageTypes = damageIds.map((id) => system?.damageTypes?.find((d) => d?.id === id))

        return createFilterOptions(
          damageTypes,
          (damageType) => damageType?.value,
          (damageType) => damageType?.label,
          (damageType) => damageType?.id
        )
      },
    },
    {
      type: 'multiSelect',
      path: 'damage.secondary.id',
      label: 'Sec. Damage',
      getOptionsFromData: (data) => {
        const damageIds = [
          ...(data?.map((spell) => {
            return spell?.damage?.secondary?.id
          }) || []),
        ].filter(Boolean)

        const damageTypes = damageIds.map((id) => system?.damageTypes?.find((d) => d?.id === id))

        return createFilterOptions(
          damageTypes,
          (damageType) => damageType?.value,
          (damageType) => damageType?.label,
          (damageType) => damageType?.id
        )
      },
    },
    {
      type: 'multiSelect',
      path: 'conditions',
      label: 'Condition',
      getOptionsFromData: (data) => {
        const conditionIds = [
          ...(data?.flatMap((spell) => {
            if (spell?.conditions?.length) {
              return spell?.conditions?.map((condition) => condition)
            }
          }) || []),
        ].filter(Boolean)

        const conditions = conditionIds.map((id) => system?.conditions?.find((c) => c?.id === id))

        return createFilterOptions(
          conditions,
          (condition) => condition?.value,
          (condition) => condition?.label,
          (condition) => condition?.id
        )
      },
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List
        useListItems={useListSpellsQuery}
        useDeleteItem={useDeleteSpellMutation}
        footerText={footerText}
        filterConfigs={spellFilterConfigs}
      />
    </Suspense>
  )
}

export default Spells
