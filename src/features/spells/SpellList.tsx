import { FC, useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Spinner from '../../components/Spinner/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table/Table'
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
import { clearConfirm } from '../../app/deleteSlice'
import { RootState } from '../../app/store'
import Collapse from '../../components/Collapse/Collapse'
import { Option } from '../../utils/types'
import { Action } from '../../utils/types'
import Group from '../../components/Group/Group'
import Button from '../../components/Button/Button'
import Grid from '../../components/Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'

interface SpellListProps {
  scrollPosition: number
}

const SpellList: FC<SpellListProps> = ({ scrollPosition }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state: RootState) => state.delete.status)
  const spellToDelete = useSelector((state: RootState) => state.delete.data)

  const { spells, isLoading, isFetching } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      spells: data && selectAllSpells(data),
      isLoading,
      isFetching,
    }),
  })

  const filtersState = useSelector(selectSpellsFilter)

  const [deleteSpell] = useDeleteSpellMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(spells, filtersState)
  const [tableColumns, setTableColumns] = useState<{
    headers: any[]
    inputs: any[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState<string>()
  const [filterItemsPopulated, setFilterItemsPopulated] =
    useState<boolean>(false)

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1023px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const tableRef = useRef<HTMLDivElement | null>(null)

  const showCard = (spell: any) => {
    navigate(`/spells/${spell.name}`, {
      state: {
        background: location,
        title: spell.value,
        context: 'itemCard',
        data: spell,
        size: 'lg',
        scrollPosition: tableRef.current?.scrollTop,
      },
    })
  }

  const onDelete = (spell: any) => {
    navigate(`/delete/${spell.name}`, {
      state: {
        background: location,
        title: spell.value,
        data: spell,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteSpell({ id: spellToDelete.id })
    } catch (err: any) {
      setErrorMessage(err.data.message)
    }
    dispatch(clearConfirm())
  }, [spellToDelete, dispatch, deleteSpell])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setSpellsFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    if (spells && !filterItemsPopulated) {
      setFilterItems(spells)
      setFilterItemsPopulated(true)
    }
  }, [spells, setFilterItems, filterItemsPopulated])

  useEffect(() => {
    setTableColumns({
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
    })
  }, [setTableColumns, md, sm])

  const onFilterChange = (e: Action) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearSpellsFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableRef.current?.scroll(0, scrollPosition)
    }
  })

  const filter = (
    <Collapse
      title={'Filters'}
      startOpened={!sm}
    >
      <Grid mediaSize={md ? 'md' : sm ? 'sm' : 'lg'}>
        <Dropdown
          multiSelect={true}
          name='level'
          label='Level'
          options={spells?.map<Option>((item: any) => ({
            value: item?.level,
            name: null,
            _id: null,
          }))}
          value={listFilter?.level}
          onChange={(e) => onFilterChange(e)}
        />
        <Input
          name='value'
          label='Spell Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='classes'
          label='Classes'
          options={spells?.flatMap<Option>((item: any) => {
            if (item.classes && Array.isArray(item.classes)) {
              return item.classes
            } else {
              return []
            }
          })}
          value={listFilter?.classes}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='school'
          label='Spell School'
          options={spells?.map<Option>((item: any) => item.school)}
          value={listFilter?.school}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='damage.damageType'
          label='Damage Type'
          options={spells?.flatMap<Option>((item: any) => {
            if (item.damage && Array.isArray(item.damage.damageType)) {
              return item.damage.damageType
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='condition'
          label='Condition Type'
          options={spells?.flatMap<Option>((item: any) => {
            if (item.condition && Array.isArray(item.condition)) {
              return item.condition
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='saveAbility'
          label='DC Ability'
          options={spells?.flatMap<Option>((item: any) => {
            if (item.saveAbility && Array.isArray(item.saveAbility)) {
              return item.saveAbility
            } else {
              return []
            }
          })}
          value={listFilter?.damage?.damageType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='action.actionType'
          label='Casting Time'
          options={spells?.map<Option>((item: any) => item.action?.actionType)}
          value={listFilter?.action?.actionType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='action.actionType'
          label='Casting Time'
          options={spells?.map<Option>((item: any) => item.action?.actionType)}
          value={listFilter?.action?.actionType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='duration.durationType'
          label='Duration'
          options={spells?.map<Option>(
            (item: any) => item.duration?.durationType
          )}
          value={listFilter?.duration?.durationType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='range.rangeType'
          label='Range'
          options={spells?.map<Option>((item: any) => item.range?.rangeType)}
          value={listFilter?.range?.rangeType}
          onChange={(e) => onFilterChange(e)}
        />
        <Dropdown
          multiSelect={true}
          name='shape.shapeType'
          label='Shape'
          options={spells?.map<Option>((item: any) => item.shape?.shapeType)}
          value={listFilter?.shape?.shapeType}
          onChange={(e) => onFilterChange(e)}
        />
      </Grid>
    </Collapse>
  )

  return isLoading || isFetching || !filterItemsPopulated ? (
    <Spinner />
  ) : (
    <Container>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1>Spells</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button
            type='button'
            variant='default'
            onClick={() => navigate('/spells/new')}
          >
            Create a Spell
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        ref={tableRef}
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        value={filteredList as any[]}
        clickable={true}
        onClick={(spell) => showCard(spell)}
        deleteRow={(spell) => onDelete(spell)}
      />
    </Container>
  )
}

export default SpellList
