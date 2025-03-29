import parse from 'html-react-parser'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'
import { Background as BackgroundState } from '../../../amplify/gql/types'
import { FormDataType } from '../../types/form'
import { useRouterState } from '@tanstack/react-router'

// Type guard function
function isBackground(item: FormDataType | undefined): item is BackgroundState {
  return item?.__typename === 'Feat'
}

const Background = () => {
  const background = useRouterState({ select: (s) => s.location.state.item })

  if (!background || !isBackground(background)) return <div>Invalid or missing background data</div>

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
