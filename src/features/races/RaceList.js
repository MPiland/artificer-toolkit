import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useGetRaceQuery } from './racesApiSlice'
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

  const {
    data: races,
    isLoading: raceIsLoading,
    isSuccess: raceIsSuccess,
    isError: raceIsError,
    error: raceError,
  } = useGetRaceQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  const { filteredList, setListFilter, setFilterItems } = useFilteredList()
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()
  const tableRef = useRef(null)

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const showCard = (race) => {
    navigate(`/races/${race.name}`, {
      state: {
        background: location,
        context: race.value,
        data: race,
        size: 'xl',
      },
    })
  }

  useEffect(() => {
    if (raceIsError) {
      setErrorMessage(raceError.data.message)
    }
  }, [raceError, raceIsError])

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
          size: 'col-sm-2 col-5',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col-sm-2 col-5',
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
          ref={tableRef}
          name='spellList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={filteredList}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(race) => showCard(race)}
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default RaceList
