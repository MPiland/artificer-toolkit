import {
  selectAllFeats,
  useDeleteFeatMutation,
  useGetFeatsQuery,
} from './featApiSlice'
import {
  selectFilter,
  setFilter,
  clearFilter,
} from './featSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'
const FeatList = () => {
  const { feats } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
    }),
  })

  const [deleteFeat] = useDeleteFeatMutation()
  const tableColumns: { headers: RowHeader[]; inputs: RowInput[] } = {
    headers: [
      {
        name: { sortOn: 'name' },
        value: 'Name',
        defaultSort: true,
      },
    ],
    inputs: [
      {
        name: 'value',
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ title: 'feat' }}
      items={feats}
      deleteItem={deleteFeat}
      setFilter={setFilter}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}

export default FeatList
