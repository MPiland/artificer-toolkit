import { Suspense } from 'react'
import List from '../../components/List/List'
import { useListFeatsQuery, useDeleteFeatMutation } from './featsApi'
import Loading from '../../components/Loading/Loading'

const FeatList = () => {
  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListFeatsQuery} useDeleteItem={useDeleteFeatMutation} />
    </Suspense>
  )
}

export default FeatList
