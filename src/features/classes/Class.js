import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Class = forwardRef(({ state: userClass }, ref) => {
  const content = (
    <div className='detailCard-body'>
      <div>{userClass?.quote && parse(userClass.quote)}</div>
      <div>{userClass?.desc && parse(userClass.desc)}</div>
      <hr />
      <h4>Traits</h4>
      <div>{userClass?.traits && parse(userClass.traits.desc)}</div>
    </div>
  )

  return content
})

export default Class
