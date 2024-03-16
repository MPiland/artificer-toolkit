import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectRaceById, useGetRacesQuery } from './racesApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'

const Race = () => {
  const location: any = useLocation()

  const {
    race,
    isLoading,
    isFetching,
  }: { race: any; isFetching: boolean; isLoading: boolean } = useGetRacesQuery(
    undefined,
    {
      selectFromResult: ({ data, isLoading, isFetching }) => ({
        race: data && selectRaceById(data, location.state.data.id),
        isLoading,
        isFetching,
      }),
    }
  )

  const detail = (
    <>
      <div>{race?.quote && parse((race as any).quote)}</div>
      <div>{race?.desc && parse((race as any).desc)}</div>
      <h2>{race?.value} Traits</h2>
      {race?.trait?.area?.length > 0 &&
        race.trait.area.map((areaItem: any, areaIndex: number) => (
          <Fragment key={areaIndex}>
            <h3>
              <strong>
                <u>{areaItem.value}</u>
              </strong>
            </h3>
            {areaItem.desc && parse(areaItem.desc)}
          </Fragment>
        ))}
      {race.detail &&
        race.detail?.length > 0 &&
        race.detail.map((detailItem: any, detailIndex: number) => (
          <section id={`${detailItem.name}`} key={detailIndex}>
            <strong>
              <h2>{detailItem.value}</h2>
            </strong>
            <hr />
            {detailItem.desc && parse(detailItem.desc)}
          </section>
        ))}
    </>
  )

  return isLoading || isFetching || !race ? (
    <Spinner />
  ) : (
    <Detail detail={detail} location={location} footerSpacing='end' />
  )
}

export default Race
