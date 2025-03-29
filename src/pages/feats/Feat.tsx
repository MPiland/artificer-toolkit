import { useRouterState } from '@tanstack/react-router'
import parse from 'html-react-parser'
import Detail from '../../components/Detail/Detail'
import { Feat as FeatState } from '../../../amplify/gql/types'
import { FormDataType } from '../../types/form'

// Type guard function
function isFeat(item: FormDataType | undefined): item is FeatState {
  return item?.__typename === 'Feat'
}

const Feat = () => {
  const feat = useRouterState({ select: (s) => s.location.state.item })

  if (!feat || !isFeat(feat)) return <div>Invalid or missing feat data</div>

  return (
    <Detail footerSpacing='end' item={feat}>
      <div>{feat.desc && parse(feat.desc)}</div>
    </Detail>
  )
}

export default Feat
