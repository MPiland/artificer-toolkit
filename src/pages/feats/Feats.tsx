import { Suspense } from 'react'
import List from '@/components/List/List'
import { useDeleteFeatMutation } from '@/apis/featsApi'
import Loading from '@/components/Loading/Loading'
import useFeatData from '@/hooks/useFeatData'

const Feats = () => {
  const { feats } = useFeatData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={feats} useDeleteItem={useDeleteFeatMutation} />
    </Suspense>
  )
}

export default Feats
