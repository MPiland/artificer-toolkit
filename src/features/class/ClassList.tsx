import {
  selectAllClasses,
  useDeleteClassMutation,
  useGetClassesQuery,
} from './classApiSlice'
import {
  selectClassFilter,
  setClassFilter,
  clearClassFilter,
} from './classSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

interface ClassListProps {
  scrollPosition: number
}

const ClassList = ({ scrollPosition }: ClassListProps) => {
  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteClass] = useDeleteClassMutation()

  const tableColumns: { headers: RowHeader[]; inputs: RowInput[] } = {
    headers: [
      {
        name: {
          sortOn: 'name',
          filter: {
            filterKey: 'base',
            filterOn: 'category.name',
          },
        },
        value: 'Name',
        defaultSort: true,
      },
      {
        name: { sortOn: 'category.value' },
        value: 'Category',
      },
    ],
    inputs: [
      {
        name: 'value',
      },
      {
        name: 'category.value',
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ title: 'class' }}
      items={classes}
      deleteItem={deleteClass}
      scrollPosition={scrollPosition}
      setFilter={setClassFilter}
      subrow={{
        collapse: true,
        filter: 'subclass',
        filterOn: 'category.name',
        matchKey: 'parentClass',
      }}
      filterReset={clearClassFilter}
      selectFilter={selectClassFilter}
    />
  )
}
export default ClassList
