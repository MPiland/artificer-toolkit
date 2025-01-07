import { Suspense } from 'react'
import List from '../../components/List/List'
import { useListBackgroundsQuery, useDeleteBackgroundMutation } from './backgroundsApi'
import Loading from '../../components/Loading/Loading'

const BackgroundList = () => {
  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListBackgroundsQuery} useDeleteItem={useDeleteBackgroundMutation} />
    </Suspense>
  )
}

export default BackgroundList
