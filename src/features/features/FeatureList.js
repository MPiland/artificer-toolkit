import { Link } from 'react-router-dom'
import { useGetFeatureQuery } from './featuresApiSlice'

const FeatureList = ({ id }) => {
  const {
    data: races,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetFeatureQuery(id)

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  content = (
    <div className='row align-items-center'>
      <div className='d-inline col-auto me-auto'>
        <h1>Features</h1>
      </div>
      <div className='d-inline col-auto ms-auto'>
        <Link
          to={{ pathname: '/features/new' }}
          className='btn btn-outline-secondary'
        >
          Add Feature
        </Link>
      </div>
    </div>
  )

  return content
}
export default FeatureList
