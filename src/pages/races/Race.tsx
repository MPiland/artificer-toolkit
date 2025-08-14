import parse from 'html-react-parser'
import Detail from '~/components/Detail'
import { Fragment } from 'react'
import { Route } from '~/routes/_protected/races/$raceId'
import { sprinkles } from '~/css/sprinkles.css'
import { fetchRace, queryClient, useGetRace, useListRaces } from '~/apis'
import { Categories } from '~/enums'
import { useSuspenseQueries } from '@tanstack/react-query'

const Race = () => {
  const raceId = Route.useParams({ select: (r) => r.raceId })
  const {
    data: { races, metaData },
  } = useListRaces()
  const { data: race } = useGetRace(raceId)

  const subraceIds = races
    .filter(
      (r) =>
        metaData.categories?.some((c) => c.id === Categories.SUBRACE && c.raceIds?.includes(r.id)) &&
        metaData.lineages?.some((l) => l.id === raceId && l.raceIds?.includes(r.id))
    )
    .map((r) => r.id)

  const { data: subraces } = useSuspenseQueries({
    queries: subraceIds.map((id) => ({
      queryKey: ['subrace', id],
      queryFn: () => queryClient.fetchQuery(fetchRace(id)),
    })),
    combine: (results) => ({
      data: results.map((result) => result.data),
    }),
  })

  if (!race) return <div>Invalid or missing race data</div>

  return (
    <Detail item={race}>
      <div>{race?.desc && parse(race.desc)}</div>
      {race.details &&
        race.details?.length > 0 &&
        race.details.map((d, dI) => (
          <Fragment key={`${dI}-race-detail`}>
            <h1>{d?.label}</h1>
            <hr
              className={sprinkles({
                width: 'size-full',
              })}
            />
            {d?.desc && parse(d?.desc)}
          </Fragment>
        ))}
      {race?.traits?.details?.length && (
        <>
          <h1>Traits</h1>
          <hr
            className={sprinkles({
              width: 'size-full',
            })}
          />
          {race.traits.details.map((d, dI) => (
            <Fragment key={`${dI}-race-trait-detail`}>
              <h2>{d?.label}</h2>
              {d?.desc && parse(d?.desc)}
            </Fragment>
          ))}
        </>
      )}
      {race.ancestry && (
        <>
          <h2>{race.ancestry.label}</h2>
          {race.ancestry.desc && parse(race.ancestry.desc)}
        </>
      )}
      {race.features?.length &&
        race.features.map((feature, fI) => {
          return (
            <Fragment key={`${fI}-race-feature`}>
              <h2>{feature?.label}</h2>
              {feature?.desc && parse(feature.desc)}
            </Fragment>
          )
        })}
      {subraces?.length &&
        subraces.map((subrace, sI) => {
          return (
            subrace && (
              <Fragment key={`${sI}-subrace`}>
                <h2>{subrace.label}</h2>
                <hr
                  className={sprinkles({
                    width: 'size-full',
                  })}
                />
                <div>{subrace?.desc && parse(subrace.desc)}</div>
                {subrace.details &&
                  subrace.details?.length > 0 &&
                  subrace.details.map((d, dI) => (
                    <Fragment key={`${dI}-subrace-detail`}>
                      <h1>{d?.label}</h1>
                      <hr
                        className={sprinkles({
                          width: 'size-full',
                        })}
                      />
                      {d?.desc && parse(d?.desc)}
                    </Fragment>
                  ))}
                {subrace?.traits?.details?.length && (
                  <>
                    <h1>Traits</h1>
                    <hr
                      className={sprinkles({
                        width: 'size-full',
                      })}
                    />
                    {subrace.traits.details.map((d, dI) => (
                      <Fragment key={`${dI}-subrace-trait-detail`}>
                        <h2>{d?.label}</h2>
                        {d?.desc && parse(d?.desc)}
                      </Fragment>
                    ))}
                  </>
                )}
                {subrace.ancestry && (
                  <>
                    <h2>{subrace.ancestry.label}</h2>
                    {subrace.ancestry.desc && parse(subrace.ancestry.desc)}
                  </>
                )}
                {subrace.features?.length &&
                  subrace.features.map((feature, fI) => {
                    return (
                      <Fragment key={`${fI}-subrace-feature`}>
                        <h2>{feature?.label}</h2>
                        {feature?.desc && parse(feature.desc)}
                      </Fragment>
                    )
                  })}
              </Fragment>
            )
          )
        })}
    </Detail>
  )
}

export default Race
