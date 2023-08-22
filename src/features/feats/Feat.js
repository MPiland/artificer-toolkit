import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Feat = forwardRef(({ state: feat }, ref) => {
  const content = (
    <div className='detailCard-body'>
      <div>{parse(feat.desc)}</div>
    </div>
  )

  return content
})

export default Feat
