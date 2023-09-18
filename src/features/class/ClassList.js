import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useGetClassQuery, useDeleteClassMutation } from './classApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'
import AccordionButton from '../../components/AccordionButton'

const ClassList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const uClass = useSelector((state) => state.delete.data)

  const {
    data: classes,
    isLoading: classIsLoading,
    isSuccess: classIsSuccess,
    isError: classIsError,
    error: classError,
  } = useGetClassQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  const [deleteClass, { isError: delIsError, error: delError }] =
    useDeleteClassMutation()

  const { filteredList, setListFilter, setFilterItems } = useFilteredList()
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
        context: 'itemCard',
        data: uClass,
        size: 'xl',
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
      await deleteClass({ id: uClass._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [uClass, dispatch, deleteClass])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    if (classIsError) {
      setErrorMessage(classError.data.message)
    }
    if (delIsError) {
      setErrorMessage(delError.data.message)
    }
  }, [classError, classIsError, delIsError, delError])

  useEffect(() => {
    if (classIsSuccess) {
      setFilterItems(classes)
    }
  }, [classIsSuccess, classes, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'name',
          value: 'Name',
          border: false,
          className: 'fw-bold',
          size: 'col',
          breakpoint: '',
        },
        {
          name: 'category',
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
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (classIsLoading) content = <p>Loading items...</p>

  if (classIsSuccess) {
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
              placeholder='Class Name'
              autoComplete='off'
              value={filteredList?.value}
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
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(uClass) => showCard(uClass)}
          deleteRow={(uClass) => onDelete(uClass)}
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default ClassList
