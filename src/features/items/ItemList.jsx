import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  selectAllItems,
  useDeleteItemMutation,
  useGetItemsQuery,
} from './itemsApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import {
  selectItemsFilter,
  setItemsFilter,
  clearItemsFilter,
} from '../items/itemsSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Input from '../../components/Input'
import Select from '../../components/Select'

const ItemList = ({ scrollPosition }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { items, isLoading, isFetching } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
    }),
  })

  const filtersState = useSelector(selectItemsFilter)
  const deleteConfirmed = useSelector((state) => state.delete.status)
  const itemToDelete = useSelector((state) => state.delete.data)

  const [deleteItem, { isError: delIsError, error: delError }] =
    useDeleteItemMutation()
  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(items, filtersState)

  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const [filterItemsPopulated, setFilterItemsPopulated] = useState(false)

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const tableWindow = document.getElementsByClassName('content-table')

  const showCard = (item) => {
    navigate(`/items/${item.name}`, {
      state: {
        background: location,
        title: item.value,
        context: 'itemCard',
        data: item.id,
        size: 'lg',
        scrollPosition: tableWindow[0].scrollTop,
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
        context: 'delete',
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
    Object.keys(listFilter).length > 0 && dispatch(setItemsFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    if (items && !filterItemsPopulated) {
      setFilterItems(items)
      setFilterItemsPopulated(true)
    }
  }, [items, setFilterItems, filterItemsPopulated])

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableWindow[0].scroll(0, scrollPosition)
    }
  })

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: { sortOn: 'value' },
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
          defaultSort: true,
        },
        {
          name: { sortOn: 'category.value' },
          value: 'Category',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
        },
        {
          name: { sortOn: 'property' },
          value: 'Properties',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
        },
        {
          name: { sortOn: 'damage.damageType' },
          value: 'Damage Type',
          border: false,
          className: 'fw-bold',
          size: ' col',
          breakpoint: is600 ? true : '',
        },
        {
          name: { sortOn: 'armorClass' },
          value: 'AC',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: { sortOn: 'weight.amount', orderKey: 'weight.unit.short' },
          value: 'Weight',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: { sortOn: 'quantity' },
          value: 'Qty',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: {
            sortOn: 'cost.amount',
            orderKey: 'cost.currency.name',
            order: [
              { 1: 'copper' },
              { 2: 'silver' },
              { 3: 'etherium' },
              { 4: 'gold' },
              { 5: 'platinum' },
            ],
          },
          value: 'Cost',
          border: false,
          className: 'fw-bold',
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col',
          breakpoint: '',
        },
        {
          name: 'category.value',
          size: 'col',
          breakpoint: '',
        },
        {
          name: 'property',
          size: 'col',
          breakpoint: '',
        },
        {
          name: [
            ['damageprimaryDice.diceShort', 'damageprimaryDice.versatileDiceShort'],
            'damage.damageType',
          ],
          size: ' col',
          breakpoint: is600 && true,
        },
        {
          name: 'armorClass',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: ['weight.amount', 'weight.unit.short'],
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
        {
          name: 'quantity',
          size: 'col-1',
          breakpoint: is600 && true,
        },
        {
          name: ['cost.amount', 'cost.currency.short'],
          size: 'col-1',
          breakpoint: (is1000 || is600) && true,
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterChange = (e) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearItemsFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (isLoading || isFetching || !filteredList) {
    return (content = <Spinner />)
  }

  const filter = (
    <div className='filter-container'>
      <button
        className='btn btn-section-collapse justify-content-between align-items-center'
        id='sectionCollapseButton'
        type='button'
        data-bs-toggle='collapse'
        data-bs-target='#sectionCollapse'
        aria-controls='collapseExample'
        aria-expanded={!is600 && !is1000 ? 'true' : 'false'}
      >
        <span className='me-3'>Filters</span>
        <i className='bi bi-arrow-down-up' />
      </button>
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
              label='Item Name'
              autoComplete='off'
              value={listFilter?.value}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='category'
              label='Item Category'
              options={items?.map((item) => item.category)}
              value={listFilter?.category}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='property'
              label='Item Property'
              options={items?.flatMap((item) => {
                if (item.property && Array.isArray(item.property)) {
                  return item.property
                } else {
                  return []
                }
              })}
              value={listFilter?.property}
              onChange={(e) => onFilterChange(e)}
            />
            <Select
              multiple={true}
              name='damage.damageType'
              label='Damage Type'
              options={items?.flatMap((item) => {
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
              name='armorClass'
              label='Item Category'
              options={items?.map((item) => ({ value: item.armorClass }))}
              value={listFilter.armorClass}
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
      {items != null && (
        <Table
          name='itemList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          defaultSort={tableColumns.headers.find(
            (headerItem) => headerItem.defaultSort === true
          )}
          scrollable={true}
          value={filteredList}
          rows={{
            inputs: tableColumns.inputs,
            headers: tableColumns.headers
          }}
          className={tableColumns.inputs.length + 1}
          clickable={true}
          onClick={(item) => showCard(item)}
          deleteRow={(item) => onDelete(item)}
        />
      )}
    </>
  )

  return <div className='main-container list'>{content}</div>
}
export default ItemList
