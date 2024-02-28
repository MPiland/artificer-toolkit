import {
  selectAllFeats,
  useDeleteFeatMutation,
  useGetFeatsQuery,
} from './featsApiSlice'
import {
  selectFeatsFilter,
  setFeatsFilter,
  clearFeatsFilter,
} from '../feats/featsSlice'
import List from '../../components/List/List'

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

  const tableColumns = {
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
      context={{ type: 'feat', form: 'feats' }}
      items={feats}
      deleteItem={deleteFeat}
      scrollPosition={scrollPosition}
      setFilter={setFeatsFilter}
      filterReset={clearFeatsFilter}
      selectFilter={selectFeatsFilter}
    />
  )
}

export default FeatList
