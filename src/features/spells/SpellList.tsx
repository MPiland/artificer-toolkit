import {
  selectAllSpells,
  useDeleteSpellMutation,
  useGetSpellsQuery,
} from './spellsApiSlice'
import {
  selectSpellsFilter,
  setSpellsFilter,
  clearSpellsFilter,
} from './spellsSlice'
import List from '../../components/List/List'

interface SpellListProps {
  scrollPosition: number
}

const SpellList = ({ scrollPosition }: SpellListProps) => {
  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteSpell] = useDeleteSpellMutation()

  const tableColumns = {
    headers: [
      {
        name: { sortOn: 'level' },
        value: 'Level',
      },
      {
        name: { sortOn: 'name' },
        value: 'Name',
        defaultSort: true,
      },
      {
        name: { sortOn: 'classes' },
        value: 'Classes',
      },
      {
        name: { sortOn: 'school' },
        value: 'School',
        breakpoint: ['sm'],
      },
      {
        name: {
          sortOn: 'action.value',
          orderKey: 'action.actionType.value',
        },
        value: 'Casting Time',
        breakpoint: ['sm'],
      },
      {
        name: {
          sortOn: 'duration.value',
          orderKey: 'duration.durationType.value',
        },
        value: 'Duration',
        breakpoint: ['sm', 'md'],
      },
      {
        name: {
          sortOn: 'range.distance',
          orderKey: 'range.rangeType.name',
          subSort: {
            sortOn: 'shape.size',
            orderKey: 'shape.shapeType.name',
          },
        },
        value: 'Range (ft)/Area (ft)',
        breakpoint: ['sm', 'md'],
      },
      {
        name: {
          sortOn: 'damage.damagType',
          subSort: { sortOn: 'condition' },
        },
        value: 'Damage/Effect',
      },
    ],
    inputs: [
      {
        name: 'level',
      },
      {
        name: 'value',
      },
      {
        name: 'classes',
      },
      {
        name: 'school.value',
        breakpoint: ['sm'],
      },
      {
        name: ['action.value', 'action.actionType.value'],
        breakpoint: ['sm'],
      },
      {
        name: ['duration.value', 'duration.durationType.value'],
        breakpoint: ['sm', 'md'],
      },
      {
        name: [
          ['range.rangeType.value', 'range.distance', 'range.unit.short'],
          ['shape.shapeType.value', 'shape.size', 'shape.unit.short'],
        ],
        breakpoint: ['sm', 'md'],
      },
      {
        name: [
          ['damage.dice.diceShort', 'damage.dice.secDiceShort'],
          ['damage.damageType', 'damage.secondaryDamageType'],
          'condition',
        ],
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ type: 'spell', form: 'spells' }}
      items={spells}
      deleteItem={deleteSpell}
      scrollPosition={scrollPosition}
      setFilter={setSpellsFilter}
      filterReset={clearSpellsFilter}
      selectFilter={selectSpellsFilter}
    />
  )
}

export default SpellList
