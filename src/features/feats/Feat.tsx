import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Feat = () => {
  const location: any = useLocation()

  const feat = location.state.item

  return !feat ? (
    <Spinner />
  ) : (
    <Detail footerSpacing='end'>
      <div>{parse(feat.desc)}</div>
    </Detail>
  )
}

export default Feat
