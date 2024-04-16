import {
  selectAllBackgrounds,
  useDeleteBackgroundMutation,
  useGetBackgroundsQuery,
} from './backgroundApiSlice'
import {
  selectFilter,
  setFilter,
  clearFilter,
} from './backgroundSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

const BackgroundList = () => {
  const { backgrounds } = useGetBackgroundsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      backgrounds: data && selectAllBackgrounds(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteBackground] = useDeleteBackgroundMutation()

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
      context={{ title: 'background' }}
      items={backgrounds}
      deleteItem={deleteBackground}
      setFilter={setFilter}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}

export default BackgroundList
