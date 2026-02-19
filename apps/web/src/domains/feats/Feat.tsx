import parse from 'html-react-parser'
import Detail from '@components/Detail'
import { Route } from '@routes/_authed/feats/$featId'
import { useGetFeat } from '@apis'

const Feat = () => {
  const featId = Route.useParams({ select: (r) => r.featId })
  const { data: featData } = useGetFeat(featId)

  if (!featData) return <div>Invalid or missing feat data</div>

  return (
    <Detail item={featData}>
      <div>{featData.description && parse(featData.description)}</div>
    </Detail>
  )
}

export default Feat
