import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useDeleteRaceMutation } from './racesApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { selectRaces } from './racesSlice'
import { clearConfirm } from '../../app/deleteSlice'
import Spinner from '../../components/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table'
import Input from '../../components/Input'

const RaceList = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const loading = useSelector((state) => state.loading.status)

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const raceToDelete = useSelector((state) => state.delete.data)
  const races = useSelector(selectRaces)

  const [deleteRace, { isError: delIsError, error: delError }] =
    useDeleteRaceMutation()

  const { filteredList, setListFilter, setFilterItems } = useFilteredList()
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const showCard = (race) => {
    navigate(`/races/${race.name}`, {
      state: {
        background: location,
        title: race.value,
        context: 'itemCard',
        data: race,
        size: 'xl',
      },
    })
  }

  const onDelete = (race) => {
    navigate(`/delete/${race.name}`, {
      state: {
        background: location,
        title: race.value,
        data: race,
        size: 'md',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteRace({ id: raceToDelete._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [raceToDelete, dispatch, deleteRace])

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
    setFilterItems(races)
  }, [races, setFilterItems])

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
                placeholder='Race Name'
                autoComplete='off'
                value={filteredList?.value}
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
            <h3 className='me-3'>Races</h3>
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
            onClick={() => navigate('/races/new')}
          >
            Create a Race
          </button>
        </div>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        {filter}
        <Table
          name='raceList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={filteredList}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(race) => showCard(race)}
          deleteRow={(race) => onDelete(race)}
          empty='---'
        />
      </>
    )
  }

  return <div className='main-container list'>{content}</div>
}
export default RaceList
