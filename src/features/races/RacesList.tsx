import List from '../../components/List/List'
import { useGetRacesQuery, useDeleteRaceMutation } from './racesApi'

const RacesList = () => {
  return <List useGetItems={useGetRacesQuery} useDeleteItem={useDeleteRaceMutation} />
}
export default RacesList
