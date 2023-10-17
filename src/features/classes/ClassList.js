import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useDeleteClassMutation } from './classesApiSlice'
import {
  selectClasses,
  selectClassesFilter,
  setClassesFilter,
  clearClassesFilter,
  selectSubClasses,
} from '../classes/classesSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Input from '../../components/Input'

const ClassList = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const loading = useSelector((state) => state.loading.status)

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const classToDelete = useSelector((state) => state.delete.data)

  const classes = useSelector(selectClasses)
  const subClasses = useSelector(selectSubClasses)
  const filtersState = useSelector(selectClassesFilter)

  const [deleteClass, { isError: delIsError, error: delError }] =
    useDeleteClassMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(classes, filtersState)

  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const showCard = (uClass) => {
    navigate(`/classes/${uClass.name}`, {
      state: {
        background: location,
        title: uClass.value,
        context: 'classCard',
        data: uClass,
        size: 'lg',
      },
    })
  }

  const onDelete = (uClass) => {
    navigate(`/delete/${uClass.name}`, {
      state: {
        background: location,
        title: uClass.value,
        data: uClass,
        size: 'md',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteClass({ id: classToDelete._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [classToDelete, dispatch, deleteClass])

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
    Object.keys(listFilter).length > 0 && dispatch(setClassesFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    setFilterItems(classes)
  }, [classes, setFilterItems])

  const onFilterReset = () => {
    dispatch(clearClassesFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

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
        },
        {
          name: { sortOn: 'category' },
          value: 'Category',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
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
          filter: ['Subclass'],
          indentedMatch: '_id',
          indentedName: 'parentClass.id',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

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
                placeholder='Class Name'
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
            <h3 className='me-3'>Classes</h3>
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
            onClick={() => navigate('/classes/new')}
          >
            Create a Class
          </button>
        </div>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        {filter}
        <Table
          name='classList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={filteredList}
          indentedValue={subClasses}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(uClass) => showCard(uClass)}
          deleteRow={(uClass) => onDelete(uClass)}
          empty='---'
        />
      </>
    )
  }

  return <div className='main-container list'>{content}</div>
}
export default ClassList
