import List from '../../components/List/List'
import { useGetFeatsQuery, useDeleteFeatMutation } from './featsApi'

const FeatList = () => {
  return <List useGetItems={useGetFeatsQuery} useDeleteItem={useDeleteFeatMutation} />
}

export default FeatList
