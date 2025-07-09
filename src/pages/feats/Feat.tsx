import parse from 'html-react-parser'
import Detail from '@/components/Detail'
import { Route } from '@/routes/_protected/feats/$featId'
import { useFeatData } from '@/hooks'

const Feat = () => {
  const featId = Route.useParams({ select: (r) => r.featId })
  const {
    feats: { findFeat },
  } = useFeatData()
  const feat = findFeat(featId)

  if (!feat) return <div>Invalid or missing feat data</div>

  return (
    <Detail item={feat}>
      <div>{feat.desc && parse(feat.desc)}</div>
    </Detail>
  )
}

export default Feat
