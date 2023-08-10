import { useNavigate, useLocation } from 'react-router-dom'
import { useReducer, useState, useEffect } from 'react'
import { useGetFeatQuery } from './featsApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'

const FeatList = () => {
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
    data: feats,
    isLoading: featIsLoading,
    isSuccess: featIsSuccess,
    isError: featIsError,
    error: featError,
  } = useGetFeatQuery(id)

  const showCard = (feat) => {
    console.log(feat.name)
    navigate(`/feats/${feat.name}`, {
      state: {
        background: location,
        context: feat.value,
        data: feat,
        size: 'xl',
      },
    })
  }

  useEffect(() => {
    if (featIsError) {
      setErrorMessage(featError.data.message)
    }
  }, [featIsError, featError])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const featListFiltered = () => {
    if (!listFilter) {
      return feats
    }

    let filteredFeats = feats

    Object.entries(listFilter).forEach(([filterItem, filterValues]) => {
      if (Array.isArray(filterValues)) {
        filteredFeats = filterByArray(filteredFeats, filterItem, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredFeats = filterByString(filteredFeats, filterItem, filterValues)
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredFeats = filterByObject(filteredFeats, filterItem, filterValues)
      }
    })

    return filteredFeats
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

  if (featIsLoading) content = <p>Loading feats...</p>

  if (featIsSuccess) {
    const filter = (
      <>
        <div className='row row-cols-lg-4 row-cols-sm-3 align-items-center pb-2 g-2'>
          <Input
            name='value'
            label={true}
            placeholder='Feat Name'
            autoComplete='off'
            value={listFilter.value}
            onChange={setListFilter}
          />
        </div>
      </>
    )

    content = (
      <div>
        <div className='d-flex justify-content-between pb-2'>
          <div className='d-flex'>
            <h3 className='me-3'>Feats</h3>
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
            onClick={() => navigate('/feats/new')}
          >
            Create a Feat
          </button>
        </div>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        {filter}
        <Table
          name='spellList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={featListFiltered()}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(feat) => showCard(feat)}
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default FeatList
