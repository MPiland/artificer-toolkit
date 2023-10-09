import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useDeleteSpellMutation } from './spellsApiSlice'
import { selectSpells } from './spellsSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const SpellList = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const loading = useSelector((state) => state.loading.status)

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const spellToDelete = useSelector((state) => state.delete.data)
  const spells = useSelector(selectSpells)

  const [deleteSpell, { isError: delIsError, error: delError }] =
    useDeleteSpellMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(spells)
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')
  const showCard = (spell) => {
    navigate(`/spells/${spell.name}`, {
      state: {
        background: location,
        title: spell.value,
        context: 'itemCard',
        data: spell,
        size: 'lg',
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
    setTableColumns({
      headers: [
        {
          name: { sortOn: 'level' },
          value: 'Level',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-1 col-2',
          breakpoint: '',
        },
        {
          name: { sortOn: 'name' },
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-4 col-5',
          breakpoint: '',
        },
        {
          name: {
            sortOn: 'action.value',
            orderKey: 'action.actionType.value',
          },
          value: 'Casting Time',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-3',
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
          size: 'col-lg-2 col-md-3',
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
          size: 'col-md-2',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: {sortOn: 'damage.damagType'},
          value: 'Damage Type',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-sm-4 col-4',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'level',
          size: 'col-lg-1 col-2',
          breakpoint: '',
        },
        {
          name: 'value',
          size: 'col-lg-2 col-md-4 col-5',
          breakpoint: '',
        },
        {
          name: ['action.value', 'action.actionType.value'],
          size: 'col-lg-2 col-md-3 col-3',
          breakpoint: is600 && true,
        },
        {
          name: ['duration.value', 'duration.durationType.value'],
          size: 'col-lg-2 col-md-3',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: [
            ['range.rangeType.value', 'range.distance'],
            ['shape.shapeType.value', 'shape.size'],
          ],
          size: 'col-md-2',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: 'damage.damageType',
          size: 'col-lg-2 col-md-3 col-sm-4 col-4',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  useEffect(() => {
    setFilterItems(spells)
  }, [spells, setFilterItems])

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (loading) {
    content = <Spinner />
  } else {
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
          aria-expanded={!is600 && !is1000 ? 'true' : 'false'}
        >
          <span className='me-3'>Filters</span>
          <i className='bi bi-arrow-down-up' />
        </div>
        <div
          className={`section-container collapse ${
            !is600 && !is1000 ? ' show' : ''
          }`}
          id='sectionCollapse'
        >
          <div className='section-content'>
            <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 align-items-center pb-2 g-2'>
              <Input
                name='value'
                label={true}
                placeholder='Spell Name'
                autoComplete='off'
                value={listFilter?.value}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='level'
                placeholder='Level'
                options={filteredList?.map((item) => ({ value: item?.level }))}
                value={listFilter?.level}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='action.actionType'
                placeholder='Casting Time'
                options={filteredList?.map((item) => item.action?.actionType)}
                value={listFilter?.action?.actionType}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='duration.durationType'
                placeholder='Duration'
                options={filteredList?.map(
                  (item) => item.duration?.durationType
                )}
                value={listFilter?.duration?.durationType}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='range.rangeType'
                placeholder='Range'
                options={filteredList?.map((item) => item.range?.rangeType)}
                value={listFilter?.range?.rangeType}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='damage.damageType'
                placeholder='Damage Type'
                options={filteredList?.flatMap((item) => {
                  if (item.damage && Array.isArray(item.damage.damageType)) {
                    return item.damage.damageType
                  } else {
                    return []
                  }
                })}
                value={listFilter?.damage?.damageType}
                onChange={setListFilter}
              />
              <Select
                multiple={true}
                name='school'
                placeholder='Spell School'
                options={filteredList?.map((item) => item.school)}
                value={listFilter?.school}
                onChange={setListFilter}
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
          scrollable={true}
          value={filteredList}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(spell) => showCard(spell)}
          deleteRow={(spell) => onDelete(spell)}
        />
      </>
    )
  }

  return <div className='main-container list'>{content}</div>
}
export default SpellList
