import {
  selectAllRaces,
  useDeleteRaceMutation,
  useGetRacesQuery,
} from './racesApiSlice'
import {
  selectRacesFilter,
  clearRacesFilter,
  setRacesFilter,
} from './racesSlice'
import List from '../../components/List/List'

interface RaceListProps {
  scrollPosition: number
}

const RaceList = ({ scrollPosition }: RaceListProps) => {
  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteRace] = useDeleteRaceMutation()

  const tableColumns = {
    headers: [
      {
        name: { sortOn: 'name' },
        value: 'Name',
        defaultSort: true,
      },
    ],
    inputs: [
      {
        name: 'value',
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ type: 'race', form: 'races' }}
      items={races}
      deleteItem={deleteRace}
      scrollPosition={scrollPosition}
      setFilter={setRacesFilter}
      filterReset={clearRacesFilter}
      selectFilter={selectRacesFilter}
    />
  )
}
export default RaceList
