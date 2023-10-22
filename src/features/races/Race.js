import parse from 'html-react-parser'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { selectRaceById, useGetRacesQuery } from './racesApiSlice'
import Spinner from '../../components/Spinner'

const Race = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: id, handleClose } = useOutletContext()

  const { race, isFetching } = useGetRacesQuery('racesList', {
    selectFromResult: ({ data }) => ({
      race: data && selectRaceById(data, id),
    }),
  })

  const onEditClicked = () => {
    navigate(`${location.state.background.pathname}/edit/${race.name}`, {
      state: { data: id, previous: location },
    })
  }

  let content

  if (isFetching) {
    return content = <Spinner />
  }

  content = (
    <>
      <div className='modal-header'>
        <h1 className='fw-bold mb-0 fs-2 ms-auto'>{race.value}</h1>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        ></button>
      </div>
      <div className='modal-body'>
        <div className='detail-card-body'>
          <div>{race?.quote && parse(race.quote)}</div>
          <div>{race?.desc && parse(race.desc)}</div>
          <h4>Traits</h4>
          <div>{race?.traits && parse(race.traits.desc)}</div>
        </div>
      </div>
      <div className='modal-footer'>
        <button
          className='btn btn-outline-secondary btn-small'
          onClick={onEditClicked}
        >
          Edit
        </button>
      </div>
    </>
  )

  return content
}

export default Race
