import {
  selectAllClasses,
  useDeleteClassMutation,
  useGetClassesQuery,
} from './classesApiSlice'
import {
  selectClassesFilter,
  setClassesFilter,
  clearClassesFilter,
} from '../classes/classesSlice'
import List from '../../components/List/List'

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

  const tableColumns = {
    headers: [
      {
        name: { sortOn: 'name' },
        value: 'Name',
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
      context={{ type: 'class', form: 'classes' }}
      items={classes}
      deleteItem={deleteClass}
      scrollPosition={scrollPosition}
      setFilter={setClassesFilter}
      collapse={true}
      filterReset={clearClassesFilter}
      selectFilter={selectClassesFilter}
    />
  )
}
export default ClassList
