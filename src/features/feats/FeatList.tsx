import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback, FC } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectAllFeats,
  useDeleteFeatMutation,
  useGetFeatsQuery,
} from './featsApiSlice'
import { clearConfirm } from '../../app/modalSlice'
import {
  selectFeatsFilter,
  setFeatsFilter,
  clearFeatsFilter,
} from '../feats/featsSlice'
import { useMediaQuery } from 'usehooks-ts'
import useFilteredList from '../../hooks/useFilteredList'
import Spinner from '../../components/Spinner/Spinner'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import { RootState } from '../../app/store'
import { ReducerActionType } from '../../utils/types'
import Collapse from '../../components/Collapse/Collapse'
import Grid from '../../components/Grid/Grid'
import Group from '../../components/Group/Group'
import Button from '../../components/Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Container from '../../components/Container/Container'
import useIsLoading from '../../hooks/useIsLoading'

interface FeatListProps {
  scrollPosition: number
}

const FeatList: FC<FeatListProps> = ({ scrollPosition }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const deleteConfirmed = useSelector((state: RootState) => state.modal.delete.status)
  const featToDelete = useSelector((state: RootState) => state.modal.delete.data)

  const { feats } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const filtersState = useSelector(selectFeatsFilter)

  const [deleteFeat] = useDeleteFeatMutation()

  const { listFilter, filteredItems, setListFilter, setFilteredItems } =
    useFilteredList(feats, filtersState)
  const [tableColumns, setTableColumns] = useState<{
    headers: any[]
    inputs: any[]
  }>({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const md = useMediaQuery('(min-width: 568px) and (max-width: 1024px)')
  const sm = useMediaQuery('(max-width: 567px)')

  const tableWindow = document.getElementById('list_table')

  const handleShowDetail = (feat: any) => {
    navigate(`/feats/${feat.name}`, {
      state: {
        background: location,
        title: feat.value,
        context: 'itemCard',
        data: feat,
        size: 'lg',
        scrollPosition: tableWindow?.scrollTop,
      },
    })
  }

  const handleDelete = (feat: any) => {
    navigate(`/delete/${feat.name}`, {
      state: {
        background: location,
        title: feat.value,
        data: feat,
        size: 'md',
        context: 'delete',
      },
    })
  }

  const handleDeleteSubmit = useCallback(async () => {
    try {
      await deleteFeat({ id: featToDelete._id })
      setListFilter({ type: 'reset', target: { value: {} } })
    } catch (err: any) {
      setErrorMessage(err.data.message)
    }
    dispatch(clearConfirm())
  }, [featToDelete, dispatch, deleteFeat, setListFilter])

  useEffect(() => {
    if (deleteConfirmed) {
      handleDeleteSubmit()
    }
  }, [deleteConfirmed, handleDeleteSubmit])

  const onFilterChange = (e: ReducerActionType) => {
    setListFilter(e)
  }

  useEffect(() => {
    Object.keys(listFilter).length > 0 && dispatch(setFeatsFilter(listFilter))
  }, [dispatch, listFilter])

  useEffect(() => {
    filtersState !== null &&
      setListFilter({ type: 'reset', target: filtersState })
  }, [filtersState, setListFilter])

  useEffect(() => {
    const featsJSON = JSON.stringify(feats)
    const filteredItemsJSON = JSON.stringify(filteredItems)
    if (
      featsJSON !== filteredItemsJSON &&
      Object.keys(filtersState).length === 0
    ) {
      setFilteredItems(feats)
    }
  }, [feats, setFilteredItems, filteredItems, filtersState])

  const onFilterReset = () => {
    dispatch(clearFeatsFilter())
    setListFilter({ type: 'reset', target: {} })
  }

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
          breakpoint: false,
          defaultSort: true,
        },
      ],
      inputs: [
        {
          name: 'value',
          breakpoint: false,
        },
      ],
    })
  }, [setTableColumns, sm, md])

  const filter = (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Feat Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={(e) => onFilterChange(e)}
        />
      </Grid>
    </Collapse>
  )

  return isLoading || !filteredItems ? (
    <Spinner />
  ) : (
    <Container className={sprinkles({ pt: 'size-3' })}>
      <Group className={sprinkles({ mb: 'size-3' })}>
        <h3 className='me-3'>Feats</h3>
        <Group>
          <Button type='button' variant='default' onClick={onFilterReset}>
            Clear Filters
          </Button>
          <Button
            type='button'
            variant='default'
            onClick={() => navigate('/feats/new')}
          >
            Create a Feat
          </Button>
        </Group>
      </Group>
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      {filter}
      <Table
        id='list_table'
        addRow={false}
        readOnly={true}
        sortable={true}
        defaultSort={tableColumns.headers.find(
          (headerItem) => headerItem.defaultSort === true
        )}
        value={filteredItems as any[]}
        rows={{
          inputs: tableColumns.inputs,
          headers: tableColumns.headers,
        }}
        clickable={true}
        onClick={(feat) => handleShowDetail(feat)}
        deleteRow={(feat) => handleDelete(feat)}
        empty='---'
      />
    </Container>
  )
}
export default FeatList
