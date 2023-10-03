import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'

const Class = () => {
  const { data: userClass } = useOutletContext()

  const content = (
    <div className='detailCard-body'>
      <div>{userClass?.quote && parse(userClass.quote)}</div>
      <div>{userClass?.desc && parse(userClass.desc)}</div>
      <hr />
    </div>
  )

  return content
}

export default Class
