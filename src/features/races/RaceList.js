import { useNavigate } from 'react-router-dom'
import { useGetRaceQuery } from './racesApiSlice'
import useAuth from '../../hooks/useAuth'

const RaceList = () => {
  const { id } = useAuth()
  const navigate = useNavigate()

  const {
    data: races,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetRaceQuery(id)

  let content

  if (isLoading) content = <p>Loading races...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  content = (
    <div className='d-flex justify-content-between pb-2'>
      <h3>Races</h3>
      <button
        className='btn btn-outline-secondary btn-small'
        onClick={() => navigate('/races/new')}
      >
        Create a Race
      </button>
    </div>
  )

  return content
}
export default RaceList
