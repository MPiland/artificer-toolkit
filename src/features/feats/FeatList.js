import { useNavigate } from 'react-router-dom'
import { useGetFeatQuery } from './featsApiSlice'
import useAuth from '../../hooks/useAuth'

const FeatList = () => {
  const { id } = useAuth()
  const navigate = useNavigate()

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
      <div className='d-flex justify-content-between pb-2'>
        <h3>Feats</h3>
        <button
          className='btn btn-outline-secondary btn-small'
          onClick={() => navigate('/feats/new')}
        >
          Create a Feat
        </button>
      </div>
    )

    return content
  }
}
export default FeatList
