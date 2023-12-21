import parse from 'html-react-parser'
import { getValueFromState } from '../../helpers/formatting'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { selectItemById, useGetItemsQuery } from './itemsApiSlice'
import Spinner from '../../components/Spinner'

const Item = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: id, handleClose } = useOutletContext()

  const { item, isFetching } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      item: data && selectItemById(data, id),
    }),
  })

  const onEditClicked = () => {
    navigate(
      `${location.state.background.pathname}/edit/${location.state.data.name}`,
      {
        state: { data: id, previous: location },
      }
    )
  }

  const cols = [
    { header: 'CATEGORY', name: 'category.value' },
    {
      header: 'PROPERTIES',
      name: 'property',
    },
    {
      header: 'DAMAGE TYPE',
      name: [
        ['damageprimaryDice.diceShort', 'damageprimaryDice.versatileDiceShort'],
        'damage.damageType',
      ],
    },
    { header: 'AC', name: 'armorClass' },
    {
      header: 'WEIGHT',
      name: ['weight.amount', 'weight.unit.short'],
    },
    { header: 'COST', name: ['cost.amount', 'cost.currency.short'] },
  ]

  let content

  if (isFetching) {
    return (content = <Spinner />)
  }

  content = (
    <>
      <div className='modal-header'>
        <h1 className='fw-bold mb-0 fs-2 ms-auto'>{item?.value}</h1>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        ></button>
      </div>
      <div className='modal-body'>
        <div className='detail-card-body container'>
          <div className='detail-card-detail row row-cols-md-3 row-cols-2 gy-3'>
            {cols.map((colItem, colIndex) => {
              return (
                <div className='col' key={colIndex}>
                  <div className='fw-bold'>{colItem.header}</div>
                  <div>
                    {getValueFromState(colItem, item, colItem.truncate)}
                  </div>
                </div>
              )
            })}
          </div>
          <hr />
          <div>{item?.desc && parse(item.desc)}</div>
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

export default Item
