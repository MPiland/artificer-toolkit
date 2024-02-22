import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { useGetSpellsQuery, selectSpellById } from './spellsApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Spell = () => {
  const location: any = useLocation()

  const { spell, isLoading, isFetching } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      spell: data && selectSpellById(data, location.state.data.id),
      isLoading,
      isFetching,
    }),
  })

  const materialDesc = () => {
    if (spell && 'materialDesc' in spell) {
      return '*' + spell.materialDesc
    } else return ''
  }

  const cols = [
    { header: 'LEVEL', name: 'level' },
    {
      header: 'CASTING TIME',
      name: ['action.value', 'action.actionType.value'],
    },
    {
      header: 'RANGE/AREA',
      name: [
        ['range.rangeType.value', 'range.distance', 'range.unit.short'],
        ['shape.shapeType.value', 'shape.size', 'shape.unit.short'],
      ],
    },
    { header: 'REQUIREMENTS', name: 'requirement', truncate: 1 },
    {
      header: 'DURATION',
      name: ['duration.value', 'duration.durationType.value'],
    },
    { header: 'SCHOOL', name: 'school.value' },
    {
      header: 'SAVE ABILITY',
      name: 'saveAbility.ability',
      filter: ['isAttack', 'requireSave'],
    },
    {
      header: 'DAMAGE',
      name: [
        ['damage.dice.diceShort', 'damage.dice.secDiceShort'],
        ['damage.damageType', 'damage.secondaryDamageType'],
        'condition',
      ],
    },
  ]

  let content

  if (isLoading || isFetching || !spell) {
    return (content = <Spinner />)
  }

  const detail = 'desc' in spell && spell.desc && (
    <div>{parse(spell.desc as string)}</div>
  )

  const footer = <span>{materialDesc()}</span>

  content = (
    <Detail
      cols={cols}
      colsData={spell}
      detail={detail}
      footer={footer}
      location={location}
    />
  )

  return content
}

export default Spell
