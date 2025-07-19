import List from '@/components/List'
import { useDeleteBackground } from '@/apis/backgrounds.api'
import { useBackgroundData } from '@/hooks'

const Backgrounds = () => {
  const { backgrounds } = useBackgroundData()
  return <List data={backgrounds} useDeleteItem={useDeleteBackground} />
}

export default Backgrounds
