import { Suspense } from 'react'
import List from '@/components/List'
import { useDeleteFeatMutation } from '@/apis/feats.api'
import Loading from '@/components/Loading'
import { useFeatData } from '@/hooks'

const Feats = () => {
  const { feats } = useFeatData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={feats} useDeleteItem={useDeleteFeatMutation} />
    </Suspense>
  )
}

export default Feats
