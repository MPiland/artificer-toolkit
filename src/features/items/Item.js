import '../../scss/card.scss'
import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Item = forwardRef(({ state: item }, ref) => {
  const content = (
    <>
      <div className='spell-desc'>{item.desc && parse(item.desc)}</div>
      <div className='spell-desc'>{item.quote && parse(item.quote)}</div>
    </>
  )

  return content
})

export default Item
