import { useReducer } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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
import { useMediaQuery } from 'usehooks-ts'
import Input from '../../components/Input/Input'
import Collapse from '../../components/Collapse/Collapse'
import Grid from '../../components/Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import useIsLoading from '../../hooks/useIsLoading'
import formReducer from '../../hooks/useReducer'
import List from '../../components/List/List'

interface FeatListProps {
  scrollPosition: number
}

const FeatList = ({ scrollPosition }: FeatListProps) => {
  const isLoading = useIsLoading()
  const dispatch = useDispatch()

  const filterState = useSelector(selectFeatsFilter)

  const [listFilter, setListFilter] = useReducer(formReducer, filterState)

  const { feats } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      feats: data && selectAllFeats(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteFeat] = useDeleteFeatMutation()

  const sm = useMediaQuery('(max-width: 567px)')

  const tableColumns = {
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
  }

  const clearFilters = () => {
    setListFilter({ type: 'reset', target: { value: {} } })
    dispatch(clearFeatsFilter())
  }

  const filter = (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid className={sprinkles({ py: 'size-2' })}>
        <Input
          name='value'
          label='Feat Name'
          autoComplete='off'
          value={listFilter?.value}
          onChange={setListFilter}
        />
      </Grid>
    </Collapse>
  )

  return (
    <List
      filter={filter}
      tableColumns={tableColumns}
      context={{ type: 'feat', form: 'feats' }}
      items={feats}
      deleteItem={deleteFeat}
      scrollPosition={scrollPosition}
      isLoading={isLoading}
      setFilter={setFeatsFilter}
      listFilterState={listFilter}
      selectFilter={selectFeatsFilter}
      filterReset={clearFilters}
    />
  )
}

export default FeatList
