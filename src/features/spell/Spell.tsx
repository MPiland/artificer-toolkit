import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { useGetSpellsQuery, selectSpellById } from './spellApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Spell = () => {
  const location: any = useLocation()

  const {
    spell,
    isLoading,
    isFetching,
  }: { spell: any; isFetching: boolean; isLoading: boolean } =
    useGetSpellsQuery(undefined, {
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

  const detail = spell && spell.desc && <div>{parse(spell.desc)}</div>

  const footer = <span>{materialDesc()}</span>

  return isLoading || !spell || isFetching ? (
    <Spinner />
  ) : (
    <Detail
      cols={cols}
      colsData={spell}
      detail={detail}
      footer={footer}
      location={location}
    />
  )
}

export default Spell
