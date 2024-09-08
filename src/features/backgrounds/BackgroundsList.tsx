import List from '../../components/List/List'
import { useGetBackgroundsQuery, useDeleteBackgroundMutation } from './backgroundsApi'

const BackgroundList = () => {
  return <List useGetItems={useGetBackgroundsQuery} useDeleteItem={useDeleteBackgroundMutation} />
}

export default BackgroundList
