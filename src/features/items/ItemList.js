import { Link } from 'react-router-dom'
import { useGetItemQuery } from './itemsApiSlice'

const ItemList = ({ id }) => {
  const {
    data: items,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetItemQuery(id)

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  content = (
    <div className='row align-items-center'>
      <div className='d-inline col-auto me-auto'>
        <h1>Items</h1>
      </div>
      <div className='d-inline col-auto ms-auto'>
        <Link
          to={{ pathname: '/items/new' }}
          className='btn btn-outline-secondary'
        >
          Add item
        </Link>
      </div>
    </div>
  )

  return content
}
export default ItemList
