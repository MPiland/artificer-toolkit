import { Suspense } from 'react'
import List from '../../components/List/List'
import { useListRacesQuery, useDeleteRaceMutation } from './racesApi'
import Loading from '../../components/Loading/Loading'

const RacesList = () => {
  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListRacesQuery} useDeleteItem={useDeleteRaceMutation} />
    </Suspense>
  )
}
export default RacesList
