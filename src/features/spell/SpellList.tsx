import {
  selectAllSpells,
  useDeleteSpellMutation,
  useGetSpellsQuery,
} from './spellApiSlice'
import {
  selectSpellsFilter,
  setSpellFilter,
  clearSpellFilter,
} from './spellSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

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

  const tableColumns: { headers: RowHeader[]; inputs: RowInput[] } = {
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
          sortOn: 'range.minRange',
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
          orderKey: 'damage.dice.diceShort',
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
          ['range.rangeType.value', 'range.minRange', 'range.unit.short'],
          ['range.maxRange', 'range.unit.short'],
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
      context={{ title: 'spell' }}
      items={spells}
      deleteItem={deleteSpell}
      scrollPosition={scrollPosition}
      setFilter={setSpellFilter}
      filterReset={clearSpellFilter}
      selectFilter={selectSpellsFilter}
    />
  )
}

export default SpellList
