import { useDeleteSpellMutation, useListSpellsQuery } from './spellsApi'
import List from '../../components/List/List'
import { ReactElement } from 'react'
import IFlame from '../../assets/Icons/IFlame'
import IClass from '../../assets/Icons/IClass'
import IBook from '../../assets/Icons/IBook'
import IClock from '../../assets/Icons/IClock'
import IRange from '../../assets/Icons/IRange'
import IMortPest from '../../assets/Icons/IMortPest'

const SpellsList = () => {
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

  return <List useListItems={useListSpellsQuery} useDeleteItem={useDeleteSpellMutation} footerText={footerText} />
}

export default SpellsList
