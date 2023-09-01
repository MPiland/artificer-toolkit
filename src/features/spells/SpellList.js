import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useGetSpellQuery } from './spellApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import AccordionButton from '../../components/AccordionButton'

const SpellList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const {
    data: spells,
    isSuccess: spellIsSuccess,
    isLoading: spellIsLoading,
    isError: spellIsError,
    error: spellError,
  } = useGetSpellQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList()
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
        size: 'xl',
      },
    })
  }

  useEffect(() => {
    if (spellIsError) {
      setErrorMessage(spellError.data.message)
    }
  }, [spellIsError, spellError])

  useEffect(() => {
    if (spellIsSuccess) {
      setFilterItems(spells)
    }
  }, [spellIsSuccess, spells, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Level',
          value: 'level',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-1 col-2',
          breakpoint: '',
        },
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-4 col-5',
          breakpoint: '',
        },
        {
          name: 'Casting Time',
          value: 'action.actionType.value',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-3',
          breakpoint: is600 && true,
        },
        {
          name: 'Duration',
          value: 'duration.durationType.value',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: 'Range (ft)/Area (ft)',
          value: 'range.rangeType.value',
          border: false,
          className: 'fw-bold',
          size: 'col-md',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: 'Damage Type',
          value: 'damage.damageType',
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
          size: 'col-md',
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

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (spellIsLoading) content = <p>Loading spells...</p>

  if (spellIsSuccess) {
    const filter = (
      <>
        {!is1200 && !is1000 && (
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='filterButton'
            target='filter'
            expanded='false'
          >
            <span className='me-3'>Filters</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
        )}
        <div className='accordion-collapse collapse show' id='filter'>
          <div className='row row-cols-lg-4 row-cols-sm-3 align-items-center pb-2 g-2'>
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
              options={spells.map((item) => ({ value: item.level }))}
              value={listFilter?.level}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='action.actionType'
              placeholder='Casting Time'
              options={spells.map((item) => item.action?.actionType)}
              value={listFilter?.action?.actionType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='duration.durationType'
              placeholder='Duration'
              options={spells.map((item) => item.duration?.durationType)}
              value={listFilter?.duration?.durationType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='range.rangeType'
              placeholder='Range'
              options={spells.map((item) => item.range?.rangeType)}
              value={listFilter?.range?.rangeType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='damage.damageType'
              placeholder='Damage Type'
              options={spells.flatMap((item) => {
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
              options={spells.map((item) => item.school)}
              value={listFilter?.school}
              onChange={setListFilter}
            />
          </div>
        </div>
      </>
    )

    content = (
      <div className='main-container list'>
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
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default SpellList
