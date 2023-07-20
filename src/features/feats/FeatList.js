import { Link } from 'react-router-dom'
import { useGetFeatQuery } from './featsApiSlice'
import useAuth from '../../hooks/useAuth'

const FeatList = () => {
  const { id } = useAuth()

  const {
    data: feats,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetFeatQuery(id)

  let content

  if (isLoading) content = <p>Loading feats...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  if (isSuccess) {
    content = (
      <div className='row align-items-center'>
        <div className='d-inline col-auto me-auto'>
          <h1>Feats</h1>
        </div>
        <div className='d-inline col-auto ms-auto'>
          <Link to='/feats/new' className='btn btn-outline-secondary'>
            Add Feat
          </Link>
        </div>
      </div>
    )

    return content
  }
}
export default FeatList
