import {
  selectAllClasses,
  useDeleteClassMutation,
  useGetClassesQuery,
} from './classApiSlice'
import {
  selectFilter,
  setFilter,
  clearFilter,
} from './classSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

const ClassList = () => {
  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
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
      setFilter={setFilter}
      subrow={{
        collapse: true,
        filter: 'subclass',
        filterOn: 'category.name',
        matchKey: 'parentClass',
      }}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}
export default ClassList
