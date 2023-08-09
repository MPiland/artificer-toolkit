import '../../scss/card.scss'
import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Feat = forwardRef(({ state: feat }, ref) => {
  const content = (
    <>
      <div className='spell-desc'>{parse(feat.desc)}</div>
    </>
  )

  return content
})

export default Feat
