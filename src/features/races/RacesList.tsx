import List from '../../components/List/List'
import { useListRacesQuery, useDeleteRaceMutation } from './racesApi'

const RacesList = () => {
  return <List useListItems={useListRacesQuery} useDeleteItem={useDeleteRaceMutation} />
}
export default RacesList
