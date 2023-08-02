import { useNavigate } from 'react-router-dom'
import { useGetItemQuery } from './itemsApiSlice'
import useAuth from '../../hooks/useAuth'

const ItemList = () => {
  const { id } = useAuth()
  const navigate = useNavigate()

  const {
    data: items,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetItemQuery(id)

  let content

  if (isLoading) content = <p>Loading items...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  content = (
    <div className='d-flex justify-content-between pb-2'>
      <h3>Items</h3>
      <button
        className='btn btn-outline-secondary btn-small'
        onClick={() => navigate('/items/new')}
      >
        Create an Item
      </button>
    </div>
  )

  return content
}
export default ItemList
