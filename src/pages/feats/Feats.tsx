import List from '~/components/List'
import { useDeleteFeat, useListFeats } from '~/apis'

const Feats = () => {
  const {
    data: { feats },
  } = useListFeats()
  return <List data={feats} useDeleteItem={useDeleteFeat} />
}

export default Feats
