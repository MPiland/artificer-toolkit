import {
  selectAllBackgrounds,
  useDeleteBackgroundMutation,
  useGetBackgroundsQuery,
} from './backgroundApiSlice'
import { selectBackgroundsFilter, setBackgroundFilter, clearBackgroundFilter } from './backgroundSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

interface BackgroundListProps {
  scrollPosition: number
}

const BackgroundList = ({ scrollPosition }: BackgroundListProps) => {
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
      scrollPosition={scrollPosition}
      setFilter={setBackgroundFilter}
      filterReset={clearBackgroundFilter}
      selectFilter={selectBackgroundsFilter}
    />
  )
}

export default BackgroundList
