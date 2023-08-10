import { useNavigate, useLocation } from 'react-router-dom'
import { useReducer, useState, useEffect } from 'react'
import { useGetSpellQuery } from './spellsApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import AccordionButton from '../../components/AccordionButton'

const SpellList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [listFilter, setListFilter] = useReducer(formReducer, {})
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const {
    data: spells,
    isSuccess: spellIsSuccess,
    isLoading: spellIsLoading,
    isError: spellIsError,
    error: spellError,
  } = useGetSpellQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  useEffect(() => {
    if (spellIsError) {
      setErrorMessage(spellError.data.message)
    }
  }, [spellIsError, spellError])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Level',
          value: 'level',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-1 col-md-3 col-sm-2 col-3',
          breakpoint: '',
        },
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
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
          size: 'col-lg-1 col-md-3 col-sm-2 col-3',
          breakpoint: '',
        },
        {
          name: 'value',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
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

  const spellListFiltered = () => {
    if (!listFilter) {
      return spells
    }

    let filteredSpells = spells

    Object.entries(listFilter).forEach(([filterItem, filterValues]) => {
      if (Array.isArray(filterValues)) {
        filteredSpells = filterByArray(filteredSpells, filterItem, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredSpells = filterByString(
          filteredSpells,
          filterItem,
          filterValues
        )
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredSpells = filterByObject(
          filteredSpells,
          filterItem,
          filterValues
        )
      }
    })

    return filteredSpells
  }

  const showCard = (spell) => {
    navigate(`/spells/${spell.name}`, {
      state: {
        background: location,
        context: spell.value,
        data: spell,
        size: 'xl',
      },
    })
  }

  const filterByArray = (spells, filterItem, filterValues) => {
    const filteredValues = filterValues.filter(
      (valueItem) => valueItem.value !== 'All'
    )

    if (filteredValues.length === 0) {
      return spells
    }

    return spells.filter((spellItem) => {
      const spellValue = spellItem[filterItem].value || spellItem[filterItem]
      return filteredValues.some((valueItem) => valueItem.value === spellValue)
    })
  }

  const filterByString = (spells, filterItem, filterValues) => {
    const filterWords = filterValues.toLowerCase().split(' ')
    return spells.filter((spellItem) => {
      const spellValue = spellItem[filterItem].toLowerCase()
      return filterWords.every((word) => spellValue.includes(word))
    })
  }

  const filterByObject = (spells, filterItem, filterValues) => {
    return spells.filter((spellItem) => {
      return Object.entries(filterValues).every(([valueItem, items]) => {
        if (Array.isArray(items)) {
          const filteredItems = items.filter((item) => item.value !== 'All')
          if (filteredItems.length === 0) {
            return true
          }

          const spellValue = Array.isArray(spellItem[filterItem][valueItem])
            ? spellItem[filterItem][valueItem].map((subItem) => subItem.value)
            : spellItem[filterItem][valueItem].value

          return filteredItems.some((item) => {
            const itemValue = Array.isArray(item.value)
              ? item.value
              : [item.value]
            return itemValue.some((value) => spellValue.includes(value))
          })
        }
        return false
      })
    })
  }

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
          >
            <span className='me-3'>Filters</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
        )}
        <div className='accordion-collapse collapse show' id='filter'>
          <div className='row row-cols-lg-4 row-cols-sm-3 align-items-center pb-2 g-2'>
            <Select
              multiple={true}
              name='level'
              placeholder='Level'
              options={spells.map((spellItem) => ({ value: spellItem.level }))}
              value={listFilter.level}
              onChange={setListFilter}
            />
            <Input
              name='value'
              label={true}
              placeholder='Spell Name'
              autoComplete='off'
              value={listFilter.value}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='action.actionType'
              placeholder='Casting Time'
              options={spells.map((spellItem) => spellItem.action?.actionType)}
              value={listFilter.action?.actionType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='duration.durationType'
              placeholder='Duration'
              options={spells.map(
                (spellItem) => spellItem.duration?.durationType
              )}
              value={listFilter.duration?.durationType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='range.rangeType'
              placeholder='Range'
              options={spells.map((spellItem) => spellItem.range?.rangeType)}
              value={listFilter.range?.rangeType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='damage.damageType'
              placeholder='Damage Type'
              options={spells.flatMap((spellItem) => {
                if (
                  spellItem.damage &&
                  Array.isArray(spellItem.damage.damageType)
                ) {
                  return spellItem.damage.damageType
                } else {
                  return []
                }
              })}
              value={listFilter.damage?.damageType}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='school'
              placeholder='Spell School'
              options={spells.map((spellItem) => spellItem.school)}
              value={listFilter.school}
              onChange={setListFilter}
            />
          </div>
        </div>
      </>
    )

    content = (
      <div>
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
          value={spellListFiltered()}
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
