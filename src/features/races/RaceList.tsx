import { useReducer } from 'react'
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
import { useMediaQuery } from 'usehooks-ts'
import Input from '../../components/Input/Input'
import Collapse from '../../components/Collapse/Collapse'
import Grid from '../../components/Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import formReducer from '../../hooks/useReducer'
import List from '../../components/List/List'

interface RaceListProps {
  scrollPosition: number
}

const RaceList = ({ scrollPosition }: RaceListProps) => {
  const isLoading = useIsLoading()
  const dispatch = useDispatch()

  const filterState = useSelector(selectRacesFilter)

  const [listFilter, setListFilter] = useReducer(formReducer, filterState)

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteRace] = useDeleteRaceMutation()

  const sm = useMediaQuery('(max-width: 567px)')

  const tableColumns = {
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
  }

  const clearFilters = () => {
    setListFilter({ type: 'reset', target: { value: {} } })
    dispatch(clearRacesFilter())
  }

  const filter = (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Race Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={setListFilter}
        />
      </Grid>
    </Collapse>
  )

  return (
    <List
      filter={filter}
      tableColumns={tableColumns}
      context={{ type: 'race', form: 'races' }}
      items={races}
      deleteItem={deleteRace}
      scrollPosition={scrollPosition}
      isLoading={isLoading}
      setFilter={setRacesFilter}
      listFilterState={listFilter}
      selectFilter={selectRacesFilter}
      filterReset={clearFilters}
    />
  )
}
export default RaceList
