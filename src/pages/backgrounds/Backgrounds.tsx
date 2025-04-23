import { Suspense } from 'react'
import List from '@/components/List/List'
import { useDeleteBackground } from '@/apis/backgroundsApi'
import Loading from '@/components/Loading/Loading'
import useBackgroundData from '@/hooks/useBackgroundData'

const Backgrounds = () => {
  const { backgrounds } = useBackgroundData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={backgrounds} useDeleteItem={useDeleteBackground} />
    </Suspense>
  )
}

export default Backgrounds
