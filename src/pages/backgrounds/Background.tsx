import parse from 'html-react-parser'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'
import { Route } from '../../routes/_protected/backgrounds/$backgroundId'
import useBackgroundData from '../../hooks/useBackgroundData'

const Background = () => {
  const backgroundId = Route.useParams({ select: (r) => r.backgroundId })
  const {
    backgrounds: { findBackground },
  } = useBackgroundData()
  const background = findBackground(backgroundId)

  if (!background) return <div>Invalid or missing background data</div>

  return (
    <Detail footerSpacing='end' item={background}>
      <div>{background?.desc && parse(background.desc)}</div>
      {background.features?.length &&
        background.features.map((features, index) => (
          <Fragment key={index}>
            <h3>
              <strong>{features.value}</strong>
            </h3>
            {features.desc && parse(features.desc)}
          </Fragment>
        ))}
      {background.details?.length &&
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
