import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useDeleteItemMutation } from './itemsApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import { selectBuilders } from '../builders/buildersSlice'
import { selectItems } from '../items/itemsSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Input from '../../components/Input'
import Select from '../../components/Select'

const ItemList = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const loading = useSelector((state) => state.loading.status)

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const itemToDelete = useSelector((state) => state.delete.data)

  const builders = useSelector(selectBuilders)
  const items = useSelector(selectItems)

  const [deleteItem, { isError: delIsError, error: delError }] =
    useDeleteItemMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(items)
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const updatedItemsRef = useRef([])

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const showCard = (item) => {
    navigate(`/items/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        context: 'itemCard',
        data: item,
        size: 'lg',
      },
    })
  }

  const onDelete = (item) => {
    navigate(`/delete/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        data: item,
        size: 'md',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteItem({ id: itemToDelete._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [itemToDelete, dispatch, deleteItem])

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
    if (!loading) {
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
  }, [loading, items, builders, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          value: 'Category',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          value: 'Properties',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-4',
          breakpoint: '',
        },
        {
          value: 'Damage Type',
          border: false,
          className: 'fw-bold',
          size: ' col-2',
          breakpoint: is600 ? true : '',
        },
        {
          value: 'AC',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          value: 'Weight',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
        {
          value: 'Cost',
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
          name: ['weight.amount', 'weight.unit.value'],
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
        </div>
      </div>
    )

    content = (
      <>
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
          name='itemList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          scrollable={true}
          value={filteredList}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(item) => showCard(item)}
          deleteRow={(item) => onDelete(item)}
        />
      </>
    )
  }

  return <div className='main-container list'>{content}</div>
}
export default ItemList
