import {
  selectAllSpells,
  useDeleteSpellMutation,
  useGetSpellsQuery,
} from './spellApiSlice'
import { selectFilter, setFilter, clearFilter } from './spellSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

const SpellList = () => {
  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
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
          orderKey: 'action.type',
        },
        value: 'Casting Time',
        breakpoint: ['sm'],
      },
      {
        name: {
          sortOn: 'duration.value',
          orderKey: 'duration.type',
        },
        value: 'Duration',
        breakpoint: ['sm', 'md'],
      },
      {
        name: {
          sortOn: 'range.minRange',
          orderKey: 'range.type',
          subSort: {
            sortOn: 'shape.size',
            orderKey: 'shape.type',
          },
        },
        value: 'Range (ft)/Area (ft)',
        breakpoint: ['sm', 'md'],
      },
      {
        name: {
          sortOn: 'damage.primary.diceShort',
          orderKey: 'damage.primary.type',
          subSort: { sortOn: 'condition.type' },
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
        name: ['action.value', 'action.type'],
        breakpoint: ['sm'],
      },
      {
        name: ['duration.value', 'duration.type'],
        breakpoint: ['sm', 'md'],
      },
      {
        name: [
          ['range.type', 'range.minRange'],
          ['range.maxRange', 'range.unit.short'],
          ['shape.type', 'shape.size', 'shape.unit.short'],
        ],
        breakpoint: ['sm', 'md'],
      },
      {
        name: [
          [
            'damage.primary.diceShort',
            'damage.primary.setValue',
            'damage.primary.pool.setValue',
            'damage.primary.type',
          ],
          ['damage.secondary.diceShort', 'damage.secondary.type'],
          'condition.type',
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
      setFilter={setFilter}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}

export default SpellList
