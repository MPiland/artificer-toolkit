import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectAllFeats,
  useDeleteFeatMutation,
  useGetFeatsQuery,
} from './featsApiSlice'
import { clearConfirm } from '../../app/deleteSlice'
import {
  selectFeatsFilter,
  setFeatsFilter,
  clearFeatsFilter,
} from '../feats/featsSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Spinner from '../../components/Spinner'
import Table from '../../components/Table'
import Input from '../../components/Input'

const FeatList = ({ scrollPosition }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const featToDelete = useSelector((state) => state.delete.data)

  const { feats, isLoading, isFetching } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
    }),
  })

  const filtersState = useSelector(selectFeatsFilter)

  const [deleteFeat, { isError: delIsError, error: delError }] =
    useDeleteFeatMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(feats, filtersState)
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const [filterItemsPopulated, setFilterItemsPopulated] = useState(false)

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const tableWindow = document.getElementsByClassName('content-table')

  const showCard = (feat) => {
    navigate(`/feats/${feat.name}`, {
      state: {
        background: location,
        title: feat.value,
        context: 'itemCard',
        data: feat.id,
        size: 'lg',
        scrollPosition: tableWindow[0].scrollTop,
      },
    })
  }

  const onDelete = (feat) => {
    navigate(`/delete/${feat.name}`, {
      state: {
        background: location,
        title: feat.value,
        data: feat,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteFeat({ id: featToDelete._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [featToDelete, dispatch, deleteFeat])

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

  const onFilterChange = (e) => {
    setListFilter(e)
  }

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setFeatsFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    if (feats && !filterItemsPopulated) {
      setFilterItems(feats)
      setFilterItemsPopulated(true) // Ensure it's called only once
    }
  }, [feats, setFilterItems, filterItemsPopulated])

  const onFilterReset = () => {
    dispatch(clearFeatsFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableWindow[0].scroll(0, scrollPosition)
    }
  })

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: { sortOn: 'name' },
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
          defaultSort: true,
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

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
              label='Feat Name'
              autoComplete='off'
              value={listFilter?.value}
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
        name='featList.table'
        dynamic={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        value={filteredList}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers
        }}
        clickable={true}
        onClick={(feat) => showCard(feat)}
        deleteRow={(feat) => onDelete(feat)}
        empty='---'
      />
    </>
  )

  return <div className='main-container list'>{content}</div>
}
export default FeatList
