import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback, FC } from 'react'
import {
  selectAllRaces,
  useDeleteRaceMutation,
  useGetRacesQuery,
} from './racesApiSlice'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectRacesFilter,
  clearRacesFilter,
  setRacesFilter,
} from './racesSlice'
import { clearConfirm } from '../../app/deleteSlice'
import { RootState } from '../../app/store'
import Spinner from '../../components/Spinner/Spinner'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import { Action } from '../../utils/types'
import Collapse from '../../components/Collapse/Collapse'
import Grid from '../../components/Grid/Grid'
import Group from '../../components/Group/Group'
import Button from '../../components/Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'

interface RaceListProps {
  scrollPosition: number
}

const RaceList: FC<RaceListProps> = ({
  scrollPosition,
}: {
  scrollPosition: number
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state: RootState) => state.delete.status)
  const raceToDelete = useSelector((state: RootState) => state.delete.data)

  const { races, isLoading, isFetching } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      races: data && selectAllRaces(data),
      isLoading,
      isFetching,
    }),
  })

  const filtersState = useSelector(selectRacesFilter)

  const [deleteRace] = useDeleteRaceMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(races, filtersState)
  const [tableColumns, setTableColumns] = useState<{
    headers: any[]
    inputs: any[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState<string>()
  const [filterItemsPopulated, setFilterItemsPopulated] =
    useState<boolean>(false)

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const tableWindow = document.getElementById('list_table')

  const showCard = (race: any) => {
    navigate(`/races/${race.name}`, {
      state: {
        background: location,
        title: race.value,
        context: 'itemCard',
        data: race,
        size: 'lg',
        scrollPosition: tableWindow?.scrollTop,
      },
    })
  }

  const onDelete = (race: any) => {
    navigate(`/delete/${race.name}`, {
      state: {
        background: location,
        title: race.value,
        data: race,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteRace({ id: raceToDelete._id })
    } catch (err: any) {
      setErrorMessage(err.data.message)
    }
    dispatch(clearConfirm())
  }, [raceToDelete, dispatch, deleteRace])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setRacesFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    if (races && !filterItemsPopulated) {
      setFilterItems(races)
      setFilterItemsPopulated(true) // Ensure it's called only once
    }
  }, [races, setFilterItems, filterItemsPopulated])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: { sortOn: 'name' },
          value: 'Name',
          breakpoint: false,
          defaultSort: true,
        },
      ],
      inputs: [
        {
          name: 'value',
          breakpoint: false,
        },
      ],
    })
  }, [setTableColumns, md, sm])

  const onFilterChange = (e: Action) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearRacesFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableWindow?.scroll(0, scrollPosition)
    }
  })

  const filter = (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid
        mediaSize={md ? 'md' : sm ? 'sm' : 'lg'}
        className={sprinkles({ py: 'size-2' })}
      >
        <Input
          name='value'
          label='Race Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={(e) => onFilterChange(e)}
        />
      </Grid>
    </Collapse>
  )

  return isLoading || isFetching || !filterItemsPopulated ? (
    <Spinner />
  ) : (
    <Container>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1>Races</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button
            type='button'
            variant='default'
            onClick={() => navigate('/races/new')}
          >
            Create a Race
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id='list_table'
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        value={filteredList as any[]}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        clickable={true}
        onClick={(race) => showCard(race)}
        deleteRow={(race) => onDelete(race)}
        empty='---'
      />
    </Container>
  )
}
export default RaceList
