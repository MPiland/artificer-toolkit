import { useNavigate, useLocation } from 'react-router-dom'
import { useReducer, useState, useEffect, useRef } from 'react'
import { useGetItemQuery } from './itemsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'

const ItemList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [listFilter, setListFilter] = useReducer(formReducer, {})
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const tableRef = useRef(null)

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const {
    data: items,
    isLoading: itemIsLoading,
    isSuccess: itemIsSuccess,
    isError: itemIsError,
    error: itemError,
  } = useGetItemQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  const {
    data: builders,
    isSuccess: builderIsSuccess,
    isLoading: builderIsLoading,
  } = useGetBuilderQuery(id)

  const showCard = (item) => {
    navigate(`/items/${item.name}`, {
      state: {
        background: location,
        context: item.value,
        data: item,
        size: 'xl',
      },
    })
  }

  useEffect(() => {
    if (itemIsError) {
      setErrorMessage(itemError.data.message)
    }
  }, [itemIsError, itemError])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'Category',
          value: 'itemCategory.value',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'Property',
          value: 'itemProperty',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'Damage Type',
          value: 'damage.damageType',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'AC',
          value: 'armorValue',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-1 col-5',
          breakpoint: '',
        },
        {
          name: 'Weight (lbs)',
          value: 'itemWeight',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-1 col-5',
          breakpoint: '',
        },
        {
          name: 'Cost',
          value: ['cost.amount', 'cost.currency.name'],
          border: false,
          className: 'fw-bold',
          size: 'col-sm-1 col-5',
          breakpoint: '',
          order: [
            { value: 2 },
            [
              { 1: 'copper' },
              { 2: 'silver' },
              { 3: 'etherium' },
              { 4: 'gold' },
              { 5: 'platinum' },
            ],
          ],
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'itemCategory.value',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'itemProperty',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'damage.damageType',
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
        {
          name: 'armorValue',
          size: 'col-sm-1 col-5',
          breakpoint: '',
        },
        {
          name: 'itemWeight',
          size: 'col-sm-1 col-5',
          breakpoint: '',
        },
        {
          name: ['cost.amount', 'cost.currency.short'],
          size: 'col-sm-1 col-5',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600, builders])

  const itemListFiltered = () => {
    if (!listFilter) {
      return items
    }

    let filteredItems = [...items]
    filteredItems.sort((a, b) => (a.value > b.value ? 1 : -1))

    Object.entries(listFilter).forEach(([filterItem, filterValues]) => {
      if (Array.isArray(filterValues)) {
        filteredItems = filterByArray(filteredItems, filterItem, filterValues)
      } else if (typeof filterValues === 'string') {
        filteredItems = filterByString(filteredItems, filterItem, filterValues)
      } else if (typeof filterValues === 'object' && filterValues !== null) {
        filteredItems = filterByObject(filteredItems, filterItem, filterValues)
      }
    })

    return filteredItems
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

  if (itemIsLoading || builderIsLoading) content = <p>Loading items...</p>

  if (itemIsSuccess && builderIsSuccess) {
    const filter = (
      <>
        <div className='row row-cols-lg-4 row-cols-sm-3 align-items-center pb-2 g-2'>
          <Input
            name='value'
            label={true}
            placeholder='Item Name'
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
            <h3 className='me-3'>Items</h3>
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
            onClick={() => navigate('/items/new')}
          >
            Create an Item
          </button>
        </div>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        {filter}
        <Table
          ref={tableRef}
          name='spellList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={itemListFiltered()}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(item) => showCard(item)}
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default ItemList
