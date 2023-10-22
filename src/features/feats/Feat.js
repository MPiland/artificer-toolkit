import parse from 'html-react-parser'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { selectFeatById, useGetFeatsQuery } from './featsApiSlice'
import Spinner from '../../components/Spinner'

const Feat = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: id, handleClose } = useOutletContext()

  const { feat, isFetching } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({
      feat: data && selectFeatById(data, id),
    }),
  })

  const onEditClicked = () => {
    navigate(`${location.state.background.pathname}/edit/${feat.name}`, {
      state: { data: id, previous: location },
    })
  }

  let content

  if (isFetching) {
    content = <Spinner />
  }

  content = (
    <>
      <div className='modal-header'>
        <h1 className='fw-bold mb-0 fs-2 ms-auto'>{feat.value}</h1>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        ></button>
      </div>
      <div className='modal-body'>
        <div className='detail-card-body'>
          <div>{parse(feat.desc)}</div>
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

export default Feat
