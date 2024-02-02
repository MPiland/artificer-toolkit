import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectFeatById, useGetFeatsQuery } from './featsApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Feat = () => {
  const location: any = useLocation()

  const { feat, isLoading, isFetching } = useGetFeatsQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      feat: data && selectFeatById(data, location.state.data.id),
      isLoading,
      isFetching,
    }),
  })

  let content

  if (isLoading || isFetching || !feat) {
    content = <Spinner />
  }

  const detail = <div>{parse((feat as any).desc)}</div>

  content = <Detail detail={detail} location={location} footerSpacing='end' />

  return content
}

export default Feat
