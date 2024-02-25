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
import { ReducerActionType, RowHeader, RowInput } from '../../utils/types'
import Group from '../../components/Group/Group'
import { useMediaQuery } from 'usehooks-ts'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'
import useIsLoading from '../../hooks/useIsLoading'

const ClassList = ({ scrollPosition }: { scrollPosition: number }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const deleteConfirmed = useSelector((state: RootState) => state.delete.status)
  const classToDelete = useSelector((state: RootState) => state.delete.data)

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const filtersState = useSelector(selectClassesFilter)

  const [deleteClass] = useDeleteClassMutation()

  const { listFilter, filteredItems, setListFilter, setFilteredItems } =
    useFilteredList(classes as any[], filtersState)

  const sm = useMediaQuery('(max-width: 567px)')

  const [tableColumns, setTableColumns] = useState<{
    headers: RowHeader[]
    inputs: RowInput[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState<string>()

  const tableWindow = document.getElementById('list_table')

  const handleShowDetail = (userClass: any) => {
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

  const handleDelete = (userClass: any) => {
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

  const handleDeleteSubmit = useCallback(async () => {
    try {
      await deleteClass({ id: classToDelete._id })
      setListFilter({ type: 'reset', target: { value: {} } })
    } catch (err: any) {
      console.log(err.message)
      setErrorMessage(err.message)
    }
    dispatch(clearConfirm())
  }, [classToDelete, dispatch, deleteClass, setListFilter])

  useEffect(() => {
    if (deleteConfirmed) {
      handleDeleteSubmit()
    }
  }, [deleteConfirmed, handleDeleteSubmit])

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setClassesFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', target: filtersState })
  }, [filtersState, setListFilter])

  useEffect(() => {
    const classesJSON = JSON.stringify(classes)
    const filteredItemsJSON = JSON.stringify(filteredItems)
    if (
      classesJSON !== filteredItemsJSON &&
      Object.keys(filtersState).length === 0
    ) {
      setFilteredItems(classes)
    }
  }, [classes, setFilteredItems, filteredItems, filtersState])

  useEffect(() => {
    if (scrollPosition && !isLoading) {
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

  const onFilterChange = (e: ReducerActionType) => {
    setListFilter(e)
  }

  const onFilterReset = () => {
    dispatch(clearClassesFilter())
    setListFilter({ type: 'reset', target: {} })
  }

  const filter = (
    <Collapse title='Filters' startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
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

  return isLoading || !filteredItems ? (
    <Spinner />
  ) : (
    <Container className={sprinkles({ pt: 'size-3' })}>
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
        value={filteredItems as any[]}
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
        onClick={(userClass: any) => handleShowDetail(userClass)}
        deleteRow={(userClass: any) => handleDelete(userClass)}
        empty='---'
      />
    </Container>
  )
}
export default ClassList
