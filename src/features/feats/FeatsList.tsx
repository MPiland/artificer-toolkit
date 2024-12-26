import List from '../../components/List/List'
import { useListFeatsQuery, useDeleteFeatMutation } from './featsApi'

const FeatList = () => {
  return <List useListItems={useListFeatsQuery} useDeleteItem={useDeleteFeatMutation} />
}

export default FeatList
