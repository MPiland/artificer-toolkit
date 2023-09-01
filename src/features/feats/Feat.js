import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'

const Feat = () => {
  const { data: feat } = useOutletContext()

  console.log(feat)

  const content = (
    <div className='detailCard-body'>
      <div>{parse(feat.desc)}</div>
    </div>
  )

  return content
}

export default Feat
