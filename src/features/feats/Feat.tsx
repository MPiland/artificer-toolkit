import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Feat as FeatState } from '../../../amplify/API'

const Feat = () => {
  const location = useLocation()

  const feat: FeatState = location.state.item

  return (
    <Detail footerSpacing='end'>
      <div>{parse(feat.desc)}</div>
    </Detail>
  )
}

export default Feat
