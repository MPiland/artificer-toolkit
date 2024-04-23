import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Spell = () => {
  const location: any = useLocation()

  const spell = location.state.item

  const materialDesc = () => {
    if (spell && 'materialDesc' in spell) {
      return '*' + spell.materialDesc
    } else return ''
  }

  const cols = [
    { header: 'LEVEL', name: 'level' },
    {
      header: 'CASTING TIME',
      name: ['action', 'action.type'],
    },
    {
      header: 'RANGE/AREA',
      name: [
        ['range.type', 'range.distance', 'range.unit.short'],
        ['shape.type', 'shape.size', 'shape.unit.short'],
      ],
    },
    { header: 'REQUIREMENTS', name: 'requirement', truncate: 1 },
    {
      header: 'DURATION',
      name: ['duration.value', 'duration.type'],
    },
    { header: 'SCHOOL', name: 'school' },
    {
      header: 'SAVE ABILITY',
      name: 'saveAbility.type',
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

  return !spell  ? (
    <Spinner />
  ) : (
    <Detail cols={cols} colsData={spell} footer={footer}>
      <div>{parse(spell.desc)}</div>
    </Detail>
  )
}

export default Spell
