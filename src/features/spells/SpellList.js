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

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const {
    data: spells,
    isSuccess: spellSuccess,
    isLoading: spellLoading,
    isError: spellError,
    error: spellErrorMsg,
  } = useGetSpellQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  useEffect(() => {
    if (is1200) {
      setTableColumns({
        headers: [
          {
            name: 'Level',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'Name',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: 'Casting Time',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-3',
          },
          {
            name: 'Duration',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3',
          },
          {
            name: 'Range (ft)/Area (ft)',
            border: false,
            className: 'fw-bold',
            size: 'col-md',
          },
          {
            name: 'Damage Type',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
        inputs: [
          {
            name: 'level',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'value',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: ['action.value', 'action.actionType.value'],
            size: 'col-lg-2 col-md-3 col-3',
          },
          {
            name: ['duration.value', 'duration.durationType.value'],
            size: 'col-lg-2 col-md-3',
          },
          {
            name: [
              ['range.rangeType.value', 'range.distance'],
              ['shape.shapeType.value', 'shape.size'],
            ],
            size: 'col-md',
          },
          {
            name: 'damage.damageType',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
      })
    } else if (is1000) {
      setTableColumns({
        headers: [
          {
            name: 'Level',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'Name',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: 'Casting Time',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-3',
          },
          {
            name: 'Damage Type',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
        inputs: [
          {
            name: 'level',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'value',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: 'action.actionType.value',
            size: 'col-lg-2 col-md-3 col-3',
          },
          {
            name: 'damage.damageType',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
      })
    } else if (is600) {
      setTableColumns({
        headers: [
          {
            name: 'Level',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'Name',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: 'Damage Type',
            border: false,
            className: 'fw-bold',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
        inputs: [
          {
            name: 'level',
            size: 'col-lg-1 col-md-3 col-sm-2 col-2',
          },
          {
            name: 'value',
            size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          },
          {
            name: 'damage.damageType',
            size: 'col-lg-2 col-md-3 col-sm-4 col-5',
          },
        ],
      })
    }
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

  let content

  if (spellLoading) content = <p>Loading spells...</p>

  if (spellError) {
    content = <p className='errmsg'>{spellErrorMsg?.data?.message}</p>
  }

  if (spellSuccess) {
    console.log(spells)
    
    const showCard = (spell) => {
      navigate(`${spell.name}`, {
        state: {
          background: location,
          context: spell.value,
          data: spell,
          size: 'xl',
        },
      })
    }
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
              name={'level'}
              placeholder='Level'
              options={spells.map((spellItem) => ({ value: spellItem.level }))}
              state={listFilter.level}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
            <Input
              name='value'
              label={true}
              placeholder='Spell Name'
              autoComplete='off'
              value={listFilter.value ?? ''}
              invalidText='Must contain only numbers'
              onChange={(input) =>
                setListFilter({ payload: { target: input } })
              }
            />
            <Select
              multiple={true}
              name={'action.actionType'}
              placeholder='Casting Time'
              options={spells.map((spellItem) => spellItem.action.actionType)}
              state={listFilter.action?.actionType}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
            <Select
              multiple={true}
              name={'duration.durationType'}
              placeholder='Duration'
              options={spells.map(
                (spellItem) => spellItem.duration.durationType
              )}
              state={listFilter.duration?.durationType}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
            <Select
              multiple={true}
              name={'range.rangeType'}
              placeholder='Range'
              options={spells.map((spellItem) => spellItem.range.rangeType)}
              state={listFilter.range?.rangeType}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
            <Select
              multiple={true}
              name={'damage.damageType'}
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
              state={listFilter.damage?.damageType}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
            <Select
              multiple={true}
              name={'school'}
              placeholder='Spell School'
              options={spells.map((spellItem) => spellItem.school)}
              state={listFilter.school}
              onChange={(option) =>
                setListFilter({
                  payload: {
                    target: option,
                  },
                })
              }
            />
          </div>
        </div>
      </>
    )

    content = (
      <div>
        <div className='d-flex justify-content-between pb-2'>
          <h3>Spells</h3>
          <button
            className='btn btn-outline-secondary btn-small'
            onClick={() => navigate('/spells/new')}
          >
            Create a Spell
          </button>
        </div>
        {filter}
        <Table
          name='spellList.table'
          dynamic={false}
          readOnly={true}
          state={spellListFiltered()}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(spell) => showCard(spell)}
        />
      </div>
    )

    return content
  }
}
export default SpellList
