import { useDeleteSpellMutation, useGetSpellsQuery } from './spellsApi'
import List from '../../components/List/List'
import { ReactElement } from 'react'
import IFlame from '../../assets/Icons/IFlame'
import IClass from '../../assets/Icons/IClass'
import IBook from '../../assets/Icons/IBook'
import IClock from '../../assets/Icons/IClock'
import IRange from '../../assets/Icons/IRange'
import IMortPest from '../../assets/Icons/IMortPest'

const SpellsList = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <IFlame />,
      value: 'Damage/Effect',
      name: [
        ['damage.primary.diceShort', 'damage.primary.setValue', 'damage.primary.pool.setValue', 'damage.primary.type'],
        ['damage.secondary.diceShort', 'damage.secondary.type'],
        'condition.type',
      ],
    },
    {
      icon: <IClass />,
      name: 'classes',
      value: 'Class(es)',
    },
    {
      icon: <IBook />,
      name: 'school.value',
      value: 'School',
    },
    {
      icon: <IClock />,
      value: 'Time',
      name: [
        ['action.value', 'action.type'],
        ['duration.value', 'duration.type'],
      ],
      display: 'list',
    },
    {
      icon: <IRange />,
      value: 'Range (ft)/Area (ft)',
      name: [
        ['range.type', 'range.minRange'],
        ['range.maxRange', 'range.unit.short'],
        ['shape.type', 'shape.size', 'shape.unit.short'],
      ],
      display: 'list',
    },
    {
      icon: <IMortPest />,
      value: 'Requirements',
      name: 'requirements',
      display: 'list',
    },
  ]

  return <List useGetItems={useGetSpellsQuery} useDeleteItem={useDeleteSpellMutation} footerText={footerText} />
}

export default SpellsList
