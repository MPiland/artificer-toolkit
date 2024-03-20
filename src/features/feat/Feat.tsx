import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectFeatById, useGetFeatsQuery } from './featApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Feat = () => {
  const location: any = useLocation()

  const {
    feat,
    isLoading,
    isFetching,
  }: { feat: any; isFetching: boolean; isLoading: boolean } = useGetFeatsQuery(
    undefined,
    {
      selectFromResult: ({ data, isLoading, isFetching }) => ({
        feat: data && selectFeatById(data, location.state.data.id),
        isLoading,
        isFetching,
      }),
    }
  )

  const detail = <div>{parse(feat.desc)}</div>

  return isLoading || isFetching || !feat ? (
    <Spinner />
  ) : (
    <Detail detail={detail} location={location} footerSpacing='end' />
  )
}

export default Feat
