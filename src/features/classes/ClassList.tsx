import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
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
import { clearConfirm } from '../../app/deleteSlice'
import Collapse from '../../components/Collapse/Collapse'
import Spinner from '../../components/Spinner/Spinner'
import useFilteredList from '../../hooks/useFilteredList'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import Grid from '../../components/Grid/Grid'
import Button from '../../components/Button/Button'
import { RootState } from '../../app/store'
import { Action, RowHeader, RowInput } from '../../utils/types'
import Group from '../../components/Group/Group'
import useMediaQuery from '../../hooks/useMediaQuery'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'

const ClassList = ({ scrollPosition }: { scrollPosition: number }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const deleteConfirmed = useSelector((state: RootState) => state.delete.status)
  const classToDelete = useSelector((state: RootState) => state.delete.data)

  const { classes, isLoading, isFetching } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      classes: data && selectAllClasses(data),
      isLoading,
      isFetching,
    }),
  })

  const filtersState = useSelector(selectClassesFilter)

  const [deleteClass] = useDeleteClassMutation()

  const { listFilter, filteredList, setListFilter, setFilterItems } =
    useFilteredList(classes as any[], filtersState)

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const [tableColumns, setTableColumns] = useState<{
    headers: RowHeader[]
    inputs: RowInput[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState<string>()
  const [filterItemsPopulated, setFilterItemsPopulated] = useState(false)

  const tableWindow = document.getElementById('list_table')

  const showCard = (userClass: any) => {
    navigate(`/classes/${userClass.name}`, {
      state: {
        background: location,
        title: userClass.value,
        context: 'classCard',
        data: userClass,
        size: 'lg',
        scrollPosition: tableWindow?.scrollTop,
      },
    })
  }

  const onDelete = (userClass: any) => {
    navigate(`/delete/${userClass.name}`, {
      state: {
        background: location,
        title: userClass.value,
        data: userClass,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const onDeleteSubmit = useCallback(async () => {
    try {
      await deleteClass({ id: classToDelete._id })
    } catch (err: any) {
      console.log(err.message)
      setErrorMessage(err.message)
    }
    dispatch(clearConfirm())
  }, [classToDelete, dispatch, deleteClass])

  useEffect(() => {
    if (deleteConfirmed) {
      onDeleteSubmit()
    }
  }, [deleteConfirmed, onDeleteSubmit])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setClassesFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', payload: { target: filtersState } })
  }, [filtersState, setListFilter])

  useEffect(() => {
    if (classes && !filterItemsPopulated) {
      setFilterItems(classes as any[])
      setFilterItemsPopulated(true)
    }
  }, [classes, setFilterItems, filterItemsPopulated])

  useEffect(() => {
    if (scrollPosition && !isFetching) {
      tableWindow?.scroll(0, scrollPosition)
    }
  })

  useEffect(() => {
    setTableColumns({
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
    })
  }, [setTableColumns])

  const onFilterChange = (e: Action) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearClassesFilter())
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  const filter = (
    <Collapse title='Filters' startOpened={!sm}>
      <Grid
        mediaSize={md ? 'md' : sm ? 'sm' : 'lg'}
        className={sprinkles({ py: 'size-2' })}
      >
        <Input
          name='value'
          label='Class Name'
          autoComplete='off'
          value={listFilter?.value ?? ''}
          onChange={onFilterChange}
        />
      </Grid>
    </Collapse>
  )

  return isLoading || isFetching || !filterItemsPopulated ? (
    <Spinner />
  ) : (
    <Container>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h1 className='me-3'>Classes</h1>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button
            type='button'
            variant='default'
            onClick={() => navigate('/classes/new')}
          >
            Create a Class
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id={'list_table'}
        addRow={false}
        readOnly={true}
        sortable={true}
        value={filteredList as any[]}
        collapse={true}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
          filters: { filterOn: 'category.name', filterValue: 'subclass' },
          subrow: {
            data: classes?.filter(
              (classItem: any) => classItem.category.name === 'subclass'
            ) as any[],
            matchKey: 'parentClass._id',
          },
        }}
        clickable={true}
        onClick={(userClass: any) => showCard(userClass)}
        deleteRow={(userClass: any) => onDelete(userClass)}
        empty='---'
      />
    </Container>
  )
}
export default ClassList
