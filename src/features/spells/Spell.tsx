import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Spell as SpellState } from '../../../amplify/API'

const Spell = () => {
  const location = useLocation()

  const spell: SpellState = location.state.item

  const materialDesc = () => {
    if (spell && 'materialDesc' in spell) {
      return '*' + spell.materialDesc
    } else return ''
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

  const footer = <span>{materialDesc()}</span>

  return (
    <Detail cols={cols} colsData={spell} footer={footer}>
      <div>{parse(spell.desc)}</div>
    </Detail>
  )
}

export default Spell
