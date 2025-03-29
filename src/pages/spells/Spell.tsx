import parse from 'html-react-parser'
import { useRouterState } from '@tanstack/react-router'
import Detail from '../../components/Detail/Detail'
import { Spell as SpellState } from '../../../amplify/gql/types'
import { FormDataType } from '../../types/form'

// Type guard function
function isSpell(item: FormDataType | undefined): item is SpellState {
  return item?.__typename === 'Spell'
}

const Spell = () => {
  const spell = useRouterState({ select: (s) => s.location.state.item })

  if (!spell || !isSpell(spell)) return <div>Invalid or missing spell data</div>

  const materialDesc = () => {
    if (spell && 'materialDesc' in spell && spell.materialDesc != null) {
      return '*' + spell.materialDesc
    } else return null
  }

  const cols = [
    { header: 'LEVEL', name: 'level' },
    {
      header: 'CASTING TIME',
      name: [
        [
          ['actions.primary.amount', { path: 'actions.primary.id', source: { type: 'system', field: 'actions' } }],
          ['actions.secondary.amount', { path: 'actions.secondary.id', source: { type: 'system', field: 'actions' } }],
        ],
      ],
    },
    {
      header: 'RANGE/AREA',
      name: [
        [{ path: 'range.id', source: { type: 'system', field: 'spells.ranges' } }, 'range.minRange'],
        ['range.maxRange', { path: 'range.unit', source: { type: 'system', field: 'rules' } }],
        [
          { path: 'shape.id', source: { type: 'system', field: 'spells.shapes' } },
          'shape.size',
          { path: 'shape.unit', source: { type: 'system', field: 'rules' } },
        ],
      ],
    },
    {
      header: 'REQUIREMENTS',
      name: { path: 'requirements', source: { type: 'system', field: 'spells.requirements' } },
      truncate: 1,
    },
    {
      header: 'DURATION',
      name: ['duration.amount', { path: 'duration.id', source: { type: 'system', field: 'spells.durations' } }],
    },
    { header: 'SCHOOL', name: { path: 'school', source: { type: 'system', field: 'spells.schools' } } },
    {
      header: 'SAVE ABILITY',
      name: { path: 'saveAbility', source: { type: 'system', field: 'abilities' } },
      filter: ['isAttack', 'requireSave'],
    },
    {
      header: 'DAMAGE',
      name: [
        ['damage.primary.diceShort', 'damage.primary.type'],
        ['damage.secondary.diceShort', 'damage.secondary.type'],
        'condition.type',
      ],
    },
  ]

  const footer = materialDesc()

  return (
    <Detail cols={cols} colsData={spell} footer={footer} item={spell}>
      <div>{spell?.desc && parse(spell?.desc)}</div>
    </Detail>
  )
}

export default Spell
