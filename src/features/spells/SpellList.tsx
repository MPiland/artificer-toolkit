import { useReducer } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useMediaQuery } from 'usehooks-ts'
import Dropdown from '../../components/Dropdown/Dropdown'
import Input from '../../components/Input/Input'
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
import Collapse from '../../components/Collapse/Collapse'
import { DropdownOption } from '../../utils/types'
import Grid from '../../components/Grid/Grid'
import useIsLoading from '../../hooks/useIsLoading'
import List from '../../components/List/List'
import formReducer from '../../hooks/useReducer'

interface SpellListProps {
  scrollPosition: number
}

const SpellList = ({ scrollPosition }: SpellListProps) => {
  const isLoading = useIsLoading()
  const dispatch = useDispatch()

  const filterState = useSelector(selectSpellsFilter)

  const [listFilter, setListFilter] = useReducer(formReducer, filterState)

  const { spells } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteSpell] = useDeleteSpellMutation()

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1023px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const tableColumns = {
    headers: [
      {
        name: { sortOn: 'level' },
        value: 'Level',
        breakpoint: false,
      },
      {
        name: { sortOn: 'name' },
        value: 'Name',
        breakpoint: false,
        defaultSort: true,
      },
      {
        name: { sortOn: 'classes' },
        value: 'Classes',
        breakpoint: false,
      },
      {
        name: { sortOn: 'school' },
        value: 'School',
        breakpoint: sm && true,
      },
      {
        name: {
          sortOn: 'action.value',
          orderKey: 'action.actionType.value',
        },
        value: 'Casting Time',
        breakpoint: sm && true,
      },
      {
        name: {
          sortOn: 'duration.value',
          orderKey: 'duration.durationType.value',
        },
        value: 'Duration',
        breakpoint: (md || sm) && true,
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
        breakpoint: (md || sm) && true,
      },
      {
        name: {
          sortOn: 'damage.damagType',
          subSort: { sortOn: 'condition' },
        },
        value: 'Damage/Effect',
        breakpoint: false,
      },
    ],
    inputs: [
      {
        name: 'level',
        breakpoint: false,
      },
      {
        name: 'value',
        breakpoint: false,
      },
      {
        name: 'classes',
        breakpoint: false,
      },
      {
        name: 'school.value',
        breakpoint: sm && true,
      },
      {
        name: ['action.value', 'action.actionType.value'],
        breakpoint: sm && true,
      },
      {
        name: ['duration.value', 'duration.durationType.value'],
        breakpoint: (md || sm) && true,
      },
      {
        name: [
          ['range.rangeType.value', 'range.distance', 'range.unit.short'],
          ['shape.shapeType.value', 'shape.size', 'shape.unit.short'],
        ],
        breakpoint: (md || sm) && true,
      },
      {
        name: [
          ['damage.dice.diceShort', 'damage.dice.secDiceShort'],
          ['damage.damageType', 'damage.secondaryDamageType'],
          'condition',
        ],
        breakpoint: false,
      },
    ],
  }

  const clearFilters = () => {
    setListFilter({ type: 'reset', target: { value: {} } })
    dispatch(clearSpellsFilter())
  }

  const filter = (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid>
        <Dropdown
          multiSelect={true}
          name='level'
          label='Level'
          options={spells?.map<DropdownOption>((item: any) => ({
            value: item?.level,
            name: null,
            id: null,
          }))}
          value={listFilter?.level}
          onChange={setListFilter}
        />
        <Input
          name='value'
          label='Spell Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='classes'
          label='Classes'
          options={spells?.flatMap<DropdownOption>((item: any) => {
            if (item.classes && Array.isArray(item.classes)) {
              return item.classes
            } else {
              return []
            }
          })}
          value={listFilter?.classes}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='school'
          label='Spell School'
          options={spells?.map<DropdownOption>((item: any) => item.school)}
          value={listFilter?.school}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='damage.damageType'
          label='Damage Type'
          options={spells?.flatMap<DropdownOption>((item: any) => {
            if (item.damage && Array.isArray(item.damage.damageType)) {
              return item.damage.damageType
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='condition'
          label='Condition Type'
          options={spells?.flatMap<DropdownOption>((item: any) => {
            if (item.condition && Array.isArray(item.condition)) {
              return item.condition
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='saveAbility.ability'
          label='DC Ability'
          options={spells?.flatMap<DropdownOption>((item: any) => {
            if (
              item.saveAbility?.ability &&
              Array.isArray(item.saveAbility?.ability)
            ) {
              return item.saveAbility?.ability
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='action.actionType'
          label='Casting Time'
          options={spells?.map<DropdownOption>(
            (item: any) => item.action?.actionType
          )}
          value={listFilter?.action?.actionType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='action.actionType'
          label='Casting Time'
          options={spells?.map<DropdownOption>(
            (item: any) => item.action?.actionType
          )}
          value={listFilter?.action?.actionType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='duration.durationType'
          label='Duration'
          options={spells?.map<DropdownOption>(
            (item: any) => item.duration?.durationType
          )}
          value={listFilter?.duration?.durationType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='range.rangeType'
          label='Range'
          options={spells?.map<DropdownOption>(
            (item: any) => item.range?.rangeType
          )}
          value={listFilter?.range?.rangeType}
          onChange={setListFilter}
        />
        <Dropdown
          multiSelect={true}
          name='shape.shapeType'
          label='Shape'
          options={spells?.map<DropdownOption>(
            (item: any) => item.shape?.shapeType
          )}
          value={listFilter?.shape?.shapeType}
          onChange={setListFilter}
        />
      </Grid>
    </Collapse>
  )

  return (
    <List
      filter={filter}
      tableColumns={tableColumns}
      context={{ type: 'spell', form: 'spells' }}
      items={spells}
      deleteItem={deleteSpell}
      scrollPosition={scrollPosition}
      isLoading={isLoading}
      setFilter={setSpellsFilter}
      listFilterState={listFilter}
      selectFilter={selectSpellsFilter}
      filterReset={clearFilters}
    />
  )
}

export default SpellList
