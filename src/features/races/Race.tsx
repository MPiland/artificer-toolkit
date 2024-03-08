import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectRaceById, useGetRacesQuery } from './racesApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'

const Race = () => {
  const location: any = useLocation()

  const { race, isLoading, isFetching } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      race: data && selectRaceById(data, location.state.data.id),
      isLoading,
      isFetching,
    }),
  })

  let content

  if (isLoading || isFetching || !race) {
    return (content = <Spinner />)
  }

  const detail = (
    <>
      <div>{(race as any)?.quote && parse((race as any).quote)}</div>
      <div>{(race as any)?.desc && parse((race as any).desc)}</div>
      <h2>{(race as any)?.value} Traits</h2>
      <div>{(race as any)?.trait && parse((race as any).trait.desc)}</div>
    </>
  )

  content = <Detail detail={detail} location={location} footerSpacing='end' />

  return content
}

export default Race
