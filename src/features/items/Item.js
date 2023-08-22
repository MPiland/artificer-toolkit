import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Item = forwardRef(({ state: item }, ref) => {
  const content = (
    <div className='detailCard-body'>
      <div>{item?.desc && parse(item.desc)}</div>
      <div>{item?.quote && parse(item.quote)}</div>
    </div>
  )

  return content
})

export default Item
