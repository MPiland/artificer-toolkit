import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
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
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const SpellList = ({ scrollPosition }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const spellToDelete = useSelector((state) => state.delete.data)

  const { spells, isLoading, isFetching } = useGetSpellsQuery('spellsList', {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const filtersState = useSelector(selectSpellsFilter)

  const [deleteSpell, { isError: delIsError, error: delError }] =
    useDeleteSpellMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(spells, filtersState)
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const [filterItemsPopulated, setFilterItemsPopulated] = useState(false)

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const tableWindow = document.getElementsByClassName('content-table')

  const showCard = (spell) => {
    navigate(`/spells/${spell.name}`, {
      state: {
        background: location,
        title: spell.value,
        context: 'itemCard',
        data: spell.id,
        size: 'lg',
        scrollPosition: tableWindow[0].scrollTop,
      },
    })
  }

  const onDelete = (spell) => {
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
      await deleteSpell({ id: spellToDelete._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [spellToDelete, dispatch, deleteSpell])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    if (delIsError) {
      setErrorMessage(delError.data.message)
    }
  }, [delIsError, delError])
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
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: '',
        },
        {
          name: { sortOn: 'name' },
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
          defaultSort: true,
        },
        {
          name: { sortOn: 'classes' },
          value: 'Classes',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
        },
        {
          name: { sortOn: 'school' },
          value: 'School',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: is600 && true,
        },
        {
          name: {
            sortOn: 'action.value',
            orderKey: 'action.actionType.value',
          },
          value: 'Casting Time',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: is600 && true,
        },
        {
          name: {
            sortOn: 'duration.value',
            orderKey: 'duration.durationType.value',
          },
          value: 'Duration',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: (is1000 || is600) && true,
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
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: {
            sortOn: 'damage.base.damagType',
            subSort: { sortOn: 'condition' },
          },
          value: 'Damage/Effect',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'level',
          size: 'col-1',
          breakpoint: '',
        },
        {
          name: 'value',
          size: 'col',
          breakpoint: '',
        },
        {
          name: 'classes',
          size: 'col',
          breakpoint: '',
        },
        {
          name: 'school.value',
          size: 'col',
          breakpoint: is600 && true,
        },
        {
          name: ['action.value', 'action.actionType.value'],
          size: 'col',
          breakpoint: is600 && true,
        },
        {
          name: ['duration.value', 'duration.durationType.value'],
          size: 'col',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: [
            ['range.rangeType.value', 'range.distance', 'range.unit.short'],
            ['shape.shapeType.value', 'shape.size', 'shape.unit.short'],
          ],
          size: 'col',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: [
            ['damage.baseDamage.diceShort', 'damage.secondaryDamage.diceShort'],
            [
              'damage.baseDamage.damageType',
              'damage.secondaryDamage.damageType',
            ],
            'condition',
          ],
          size: 'col',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterChange = (e) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearSpellsFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableWindow[0].scroll(0, scrollPosition)
    }
  })

  let content

  if (isLoading || isFetching || !filteredList) {
    return (content = <Spinner />)
  }

  const filter = (
    <div className='filter-container'>
      <div
        className='btn btn-section-collapse justify-content-between align-items-center'
        id='sectionCollapseButton'
        type='button'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#sectionCollapse'
        aria-controls='collapseExample'
        aria-expanded='false'
      >
        <span className='me-3'>Filters</span>
        <i className='bi bi-arrow-down-up' />
      </div>
      <div className='section-container collapse' id='sectionCollapse'>
        <div className='section-content'>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 align-items-center pb-2 g-2'>
            <Select
              multiple={true}
              name='level'
              label='Level'
              options={spells?.map((item) => ({ value: item?.level }))}
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
            <Select
              multiple={true}
              name='classes'
              label='Classes'
              options={spells?.flatMap((item) => {
                if (item.classes && Array.isArray(item.classes)) {
                  return item.classes
                } else {
                  return []
                }
              })}
              value={listFilter?.classes}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='school'
              label='Spell School'
              options={spells?.map((item) => item.school)}
              value={listFilter?.school}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='damage.damageType'
              label='Damage Type'
              options={spells?.flatMap((item) => {
                if (item.damage && Array.isArray(item.damage.damageType)) {
                  return item.damage.damageType
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='condition'
              label='Condition Type'
              options={spells?.flatMap((item) => {
                if (item.condition && Array.isArray(item.condition)) {
                  return item.condition
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='saveAbility'
              label='DC Ability'
              options={spells?.flatMap((item) => {
                if (item.saveAbility && Array.isArray(item.saveAbility)) {
                  return item.saveAbility
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='action.actionType'
              label='Casting Time'
              options={spells?.map((item) => item.action?.actionType)}
              value={listFilter?.action?.actionType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='action.actionType'
              label='Casting Time'
              options={spells?.map((item) => item.action?.actionType)}
              value={listFilter?.action?.actionType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='duration.durationType'
              label='Duration'
              options={spells?.map((item) => item.duration?.durationType)}
              value={listFilter?.duration?.durationType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='range.rangeType'
              label='Range'
              options={spells?.map((item) => item.range?.rangeType)}
              value={listFilter?.range?.rangeType}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='shape.shapeType'
              label='Shape'
              options={spells?.map((item) => item.shape?.shapeType)}
              value={listFilter?.shape?.shapeType}
              onChange={(e) => onFilterChange(e)}
            />
          </div>
        </div>
      </div>
    </div>
  )

  content = (
    <>
      <div className='d-flex justify-content-between pb-2'>
        <div className='d-flex'>
          <h3 className='me-3'>Spells</h3>
          <button
            type='button'
            className='btn btn-outline-secondary btn-small me-1'
            onClick={onFilterReset}
          >
            Clear Filters
          </button>
        </div>
        <button
          className='btn btn-outline-secondary btn-small'
          onClick={() => navigate('/spells/new')}
        >
          Create a Spell
        </button>
      </div>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        name='spellList.table'
        dynamic={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        scrollable={true}
        value={filteredList}
        className={tableColumns.inputs.length + 1}
        clickable={true}
        onClick={(spell) => showCard(spell)}
        deleteRow={(spell) => onDelete(spell)}
      />
    </>
  )

  return <div className='main-container list'>{content}</div>
}
export default SpellList
