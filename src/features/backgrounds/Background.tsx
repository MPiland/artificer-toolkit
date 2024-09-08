import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'

const Background = () => {
  const location = useLocation()

  const background = location.state.item

  return !background ? (
    <Spinner />
  ) : (
    <Detail footerSpacing='end'>
      <div>{parse(background.desc)}</div>
      {background.feature?.length > 0 &&
        background.feature.map((featureItem: any, featureIndex: number) => (
          <Fragment key={featureIndex}>
            <h3>
              <strong>{featureItem.value}</strong>
            </h3>
            {featureItem.desc && parse(featureItem.desc)}
          </Fragment>
        ))}
      {background.detail?.length > 0 &&
        background.detail.map((detailItem: any, detailIndex: number) => (
          <Fragment key={detailIndex}>
            <strong>
              <h3>{detailItem.value}</h3>
            </strong>
            {detailItem.desc && parse(detailItem.desc)}
          </Fragment>
        ))}
    </Detail>
  )
}

export default Background
