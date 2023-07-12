import { Link } from 'react-router-dom'
import { useGetRaceQuery } from './racesApiSlice'

const RaceList = ({ id }) => {
  const {
    data: races,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetRaceQuery(id)

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  content = (
    <div className='row align-items-center'>
      <div className='d-inline col-auto me-auto'>
        <h1>Races</h1>
      </div>
      <div className='d-inline col-auto ms-auto'>
        <Link
          to={{ pathname: '/races/new' }}
          className='btn btn-outline-secondary'
        >
          Add Race
        </Link>
      </div>
    </div>
  )

  return content
}
export default RaceList
