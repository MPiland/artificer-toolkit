import {
  selectAllFeats,
  useDeleteFeatMutation,
  useGetFeatsQuery,
} from './featApiSlice'
import {
  selectFeatsFilter,
  setFeatFilter,
  clearFeatFilter,
} from './featSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

interface FeatListProps {
  scrollPosition: number
}

const FeatList = ({ scrollPosition }: FeatListProps) => {
  const { feats } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
    }),
    refetchOnMountOrArgChange: true,
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
      scrollPosition={scrollPosition}
      setFilter={setFeatFilter}
      filterReset={clearFeatFilter}
      selectFilter={selectFeatsFilter}
    />
  )
}

export default FeatList
