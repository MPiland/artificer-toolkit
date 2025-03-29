import { Suspense } from 'react'
import List from '../../components/List/List'
import { useListRacesQuery, useDeleteRaceMutation } from '../../apis/racesApi'
import Loading from '../../components/Loading/Loading'

const Races = () => {
  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListRacesQuery} useDeleteItem={useDeleteRaceMutation} />
    </Suspense>
  )
}

export default Races