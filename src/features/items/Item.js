import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'
import { getValueFromState } from '../../helpers/formatting'

const Item = () => {
  const { data: item } = useOutletContext()

  const cols = [
    { header: 'CATEGORY', name: 'itemCategory.value' },
    {
      header: 'PROPERTIES',
      name: 'itemProperty',
    },
    {
      header: 'DAMAGE TYPE',
      name: 'damage.damageType',
    },
    { header: 'AC', name: 'armorClass' },
    {
      header: 'WEIGHT',
      name: ['weight.amount', 'weight.unit.short'],
    },
    { header: 'COST', name: ['cost.amount', 'cost.currency.short'] },
  ]

  const content = (
    <div className='detailCard-body container'>
      <div className='detailCard-detail row row-cols-md-3 row-cols-2 gy-3'>
        {cols.map((colItem, colIndex) => {
          return (
            <div className='col' key={colIndex}>
              <div className='fw-bold'>{colItem.header}</div>
              <div>{getValueFromState(colItem, item, colItem.truncate)}</div>
            </div>
          )
        })}
      </div>
      <hr />
      <div>{item?.desc && parse(item.desc)}</div>
    </div>
  )

  return content
}

export default Item
