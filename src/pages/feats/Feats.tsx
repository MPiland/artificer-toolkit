import List from '@/components/List'
import { useDeleteFeatMutation } from '@/apis/feats.api'
import { useFeatData } from '@/hooks'

const Feats = () => {
  const { feats } = useFeatData()
  return <List data={feats} useDeleteItem={useDeleteFeatMutation} />
}

export default Feats
