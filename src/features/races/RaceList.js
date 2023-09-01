import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useGetRaceQuery, useDeleteRaceMutation } from './raceApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import { clearConfirm } from '../../app/deleteSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'
import AccordionButton from '../../components/AccordionButton'

const RaceList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state) => state.delete.status)
  const race = useSelector((state) => state.delete.data)

  const {
    data: races,
    isLoading: raceIsLoading,
    isSuccess: raceIsSuccess,
    isError: raceIsError,
    error: raceError,
  } = useGetRaceQuery(id, {
    refetchOnMountOrArgChange: true,
  })

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
      await deleteRace({ id: race._id })
    } catch (err) {
      console.log(err.message)
    }
    dispatch(clearConfirm())
  }, [race, dispatch, deleteRace])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    if (raceIsError) {
      setErrorMessage(raceError.data.message)
    }
    if (delIsError) {
      setErrorMessage(delError.data.message)
    }
  }, [raceError, raceIsError, delIsError, delError])

  useEffect(() => {
    if (raceIsSuccess) {
      setFilterItems(races)
    }
  }, [raceIsSuccess, races, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-sm-10',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col-sm-10',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (raceIsLoading) content = <p>Loading items...</p>

  if (raceIsSuccess) {
    const filter = (
      <>
        {!is1200 && !is1000 && (
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='filterButton'
            target='filter'
            expanded='false'
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
              placeholder='Race Name'
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
      </div>
    )

    return content
  }
}
export default RaceList
