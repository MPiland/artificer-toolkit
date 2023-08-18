import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useGetFeatQuery } from './featsApiSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import useFilteredList from '../../hooks/useFilteredList'
import useAuth from '../../hooks/useAuth'
import Table from '../../components/Table'
import Input from '../../components/Input'
import AccordionButton from '../../components/AccordionButton'

const FeatList = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const {
    data: feats,
    isLoading: featIsLoading,
    isSuccess: featIsSuccess,
    isError: featIsError,
    error: featError,
  } = useGetFeatQuery(id)

  const { filteredList, setListFilter, setFilterItems } = useFilteredList()
  const [tableColumns, setTableColumns] = useState({ headers: [], inputs: [] })
  const [errorMessage, setErrorMessage] = useState()

  const is1200 = useMediaQuery('(min-width: 992px)')
  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const showCard = (feat) => {
    console.log(feat.name)
    navigate(`/feats/${feat.name}`, {
      state: {
        background: location,
        context: feat.value,
        data: feat,
        size: 'xl',
      },
    })
  }

  useEffect(() => {
    if (featIsError) {
      setErrorMessage(featError.data.message)
    }
  }, [featIsError, featError])

  useEffect(() => {
    if (featIsSuccess) {
      setFilterItems(feats)
    }
  }, [featIsSuccess, feats, setFilterItems])

  useEffect(() => {
    setTableColumns({
      headers: [
        {
          name: 'Name',
          value: 'name',
          border: false,
          className: 'fw-bold',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          breakpoint: '',
        },
      ],
      inputs: [
        {
          name: 'value',
          size: 'col-lg-2 col-md-3 col-sm-3 col-5',
          breakpoint: '',
        },
      ],
    })
  }, [setTableColumns, is1200, is1000, is600])

  const onFilterReset = () => {
    setListFilter({ type: 'reset', payload: { target: {} } })
  }

  let content

  if (featIsLoading) content = <p>Loading feats...</p>

  if (featIsSuccess) {
    const filter = (
      <>
        {' '}
        {!is1200 && !is1000 && (
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='filterButton'
            target='filter'
          >
            <span className='me-3'>Filters</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
        )}
        <div className='accordion-collapse collapse show' id='filter'>
          <div className='row row-cols-lg-4 row-cols-sm-3 align-items-center pb-2 g-2'>
            <Input
              name='value'
              label={true}
              placeholder='Feat Name'
              autoComplete='off'
              value={filteredList?.value}
              onChange={setListFilter}
            />
          </div>
        </div>
      </>
    )

    content = (
      <div className='main-container list'>
        <div className='d-flex justify-content-between pb-2'>
          <div className='d-flex'>
            <h3 className='me-3'>Feats</h3>
            <button
              type='button'
              className='btn btn-outline-secondary btn-small me-1'
              onClick={onFilterReset}
            >
              Clear Filters
            </button>
          </div>
          <button
            className='btn btn-outline-secondary btn-small'
            onClick={() => navigate('/feats/new')}
          >
            Create a Feat
          </button>
        </div>
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        {filter}
        <Table
          name='spellList.table'
          dynamic={false}
          readOnly={true}
          sortable={true}
          value={filteredList}
          headers={tableColumns.headers}
          inputs={tableColumns.inputs}
          clickable={true}
          onClick={(feat) => showCard(feat)}
          empty='---'
        />
      </div>
    )

    return content
  }
}
export default FeatList
