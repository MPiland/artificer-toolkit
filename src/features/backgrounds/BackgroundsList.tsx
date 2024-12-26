import List from '../../components/List/List'
import { useListBackgroundsQuery, useDeleteBackgroundMutation } from './backgroundsApi'

const BackgroundList = () => {
  return <List useListItems={useListBackgroundsQuery} useDeleteItem={useDeleteBackgroundMutation} />
}

export default BackgroundList
