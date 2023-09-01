import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'

const Item = () => {
  const { data: item } = useOutletContext()

  const content = (
    <div className='detailCard-body'>
      <div>{item?.desc && parse(item.desc)}</div>
      <div>{item?.quote && parse(item.quote)}</div>
    </div>
  )

  return content
}

export default Item
