import { Suspense } from 'react'
import List from '@/components/List'
import { useDeleteBackground } from '@/apis/backgrounds.api'
import Loading from '@/components/Loading'
import { useBackgroundData } from '@/hooks'

const Backgrounds = () => {
  const { backgrounds } = useBackgroundData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={backgrounds} useDeleteItem={useDeleteBackground} />
    </Suspense>
  )
}

export default Backgrounds
