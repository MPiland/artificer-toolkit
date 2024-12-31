import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'
import { Background as BackgroundState } from '../../../amplify/API'

const Background = () => {
  const location = useLocation()

  const background: BackgroundState = location.state.item

  return (
    <Detail footerSpacing='end'>
      <div>{parse(background.desc)}</div>
      {background.features?.length > 0 &&
        background.features.map((features, index) => (
          <Fragment key={index}>
            <h3>
              <strong>{features.value}</strong>
            </h3>
            {features.desc && parse(features.desc)}
          </Fragment>
        ))}
      {background.details?.length > 0 &&
        background.details.map((detail, index) => (
          <Fragment key={index}>
            <strong>
              <h3>{detail.value}</h3>
            </strong>
            {detail.desc && parse(detail.desc)}
          </Fragment>
        ))}
    </Detail>
  )
}

export default Background
