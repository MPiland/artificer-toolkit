import { useReducer } from 'react'
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
import { useDispatch, useSelector } from 'react-redux'
import Collapse from '../../components/Collapse/Collapse'
import Input from '../../components/Input/Input'
import Grid from '../../components/Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import formReducer from '../../hooks/useReducer'
import List from '../../components/List/List'
import { useMediaQuery } from 'usehooks-ts'

interface ClassListProps {
  scrollPosition: number
}

const ClassList = ({ scrollPosition }: ClassListProps) => {
  const isLoading = useIsLoading()
  const dispatch = useDispatch()

  const filterState = useSelector(selectClassesFilter)

  const [listFilter, setListFilter] = useReducer(formReducer, filterState)

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteClass] = useDeleteClassMutation()

  const sm = useMediaQuery('(max-width: 567px)')

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

  const clearFilters = () => {
    setListFilter({ type: 'reset', target: { value: {} } })
    dispatch(clearClassesFilter())
  }

  const filter = (
    <Collapse title='Filters' startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Class Name'
          autoComplete='off'
          value={listFilter?.value ?? ''}
          onChange={setListFilter}
        />
      </Grid>
    </Collapse>
  )

  return (
    <List
      filter={filter}
      tableColumns={tableColumns}
      context={{ type: 'class', form: 'classes' }}
      items={classes}
      deleteItem={deleteClass}
      scrollPosition={scrollPosition}
      isLoading={isLoading}
      setFilter={setClassesFilter}
      listFilterState={listFilter}
      collapse={true}
      selectFilter={selectClassesFilter}
      filterReset={clearFilters}
    />
  )
}
export default ClassList
