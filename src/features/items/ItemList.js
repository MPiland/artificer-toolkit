import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useGetItemQuery } from './itemsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'
import Select from '../../components/Select'
import AccordionButton from '../../components/AccordionButton'

const ItemList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

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
    isLoading: builderIsLoading,
    isSuccess: builderIsSuccess,
    isError: builderIsError,
    error: builderError,
  } = useGetBuilderQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList()
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const tableRef = useRef(null)
  const updatedItemsRef = useRef([])

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

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
    if (builderIsError) {
      setErrorMessage(builderError.data.message)
    }
  }, [itemIsError, itemError, builderIsError, builderError])

  useEffect(() => {
    if (itemIsSuccess && builderIsSuccess) {
      const updatedItems = items.map((item) => {
        if (item.cost && item.cost.currency && item.cost.currency._id) {
          const currencyId = item.cost.currency._id
          const matchingCurrency = builders.currency.find(
            (currency) => currency._id === currencyId
          )
          if (matchingCurrency) {
            return {
              ...item,
              cost: {
                ...item.cost,
                currency: {
                  ...item.cost.currency,
                  short: matchingCurrency.short,
                },
              },
            }
          }
        }
        return item
      })
      updatedItems.sort((a, b) => (a.value > b.value ? 1 : -1))
      updatedItemsRef.current = updatedItems
      setFilterItems(updatedItemsRef.current)
    }
  }, [itemIsSuccess, builderIsSuccess, items, builders, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Name',
          value: 'value',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'Category',
          value: 'itemCategory.value',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'Property',
          value: 'itemProperty',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'Damage Type',
          value: 'damage.damageType',
          border: false,
          className: 'fw-bold',
          size: ' col-2',
          breakpoint: is600 && true,
        },
        {
          name: 'AC',
          value: 'armorValue',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: 'Weight (lbs)',
          value: 'itemWeight',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: 'Cost',
          value: ['cost.amount', 'cost.currency.name'],
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
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
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'itemCategory.value',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'itemProperty',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          name: 'damage.damageType',
          size: ' col-2',
          breakpoint: is600 && true,
        },
        {
          name: 'armorValue',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: 'itemWeight',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: ['cost.amount', 'cost.currency.short'],
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (itemIsLoading || builderIsLoading) content = <p>Loading items...</p>

  if (itemIsSuccess && builderIsSuccess) {
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
            <Input
              name='value'
              label={true}
              placeholder='Item Name'
              autoComplete='off'
              value={listFilter?.value}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='itemCategory'
              placeholder='Item Category'
              options={items?.map((item) => item.itemCategory)}
              value={listFilter?.itemCategory}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='itemProperty'
              placeholder='Item Property'
              options={items?.flatMap((item) => {
                if (item.itemProperty && Array.isArray(item.itemProperty)) {
                  return item.itemProperty
                } else {
                  return []
                }
              })}
              value={listFilter?.itemProperty}
              onChange={setListFilter}
            />
            <Select
              multiple={true}
              name='damage.damageType'
              placeholder='Damage Type'
              options={items?.flatMap((item) => {
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
              name='armorValue'
              placeholder='Item Category'
              options={items?.map((item) => ({ value: item.armorValue }))}
              value={listFilter.armorValue}
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
          scrollable={true}
          value={filteredList}
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
