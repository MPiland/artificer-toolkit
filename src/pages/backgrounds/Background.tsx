import parse from 'html-react-parser'
import Detail from '~/components/Detail'
import { Fragment } from 'react'
import { Route } from '~/routes/_protected/backgrounds/$backgroundId'
import { useGetBackground } from '~/apis'

const Background = () => {
  const backgroundId = Route.useParams({ select: (r) => r.backgroundId })
  const { data: background } = useGetBackground(backgroundId)

  if (!background) return <div>Invalid or missing background data</div>

  return (
    <Detail footerSpacing='flex-end' item={background}>
      <div>{background?.desc && parse(background.desc)}</div>
      {background.features?.length &&
        background.features.map((feature, i) => {
          return (
            <Fragment key={`${i}-background-feature}`}>
              <h3>
                <strong>{feature?.label}</strong>
              </h3>
              {feature?.desc && parse(feature.desc)}
            </Fragment>
          )
        })}
      {background.details?.length &&
        background.details.map((d, dI) => (
          <Fragment key={`${dI}-background-detail`}>
            <strong>
              <h3>{d.label}</h3>
            </strong>
            {d.desc && parse(d.desc)}
          </Fragment>
        ))}
    </Detail>
  )
}

export default Background
