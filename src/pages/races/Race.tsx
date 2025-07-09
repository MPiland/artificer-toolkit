import parse from 'html-react-parser'
import Detail from '@/components/Detail'
import { Fragment } from 'react'
import { race_section_divider } from '@/pages/races/Race.css'
import { Route } from '@/routes/_protected/races/$raceId'
import { useFeatureData, useRaceData } from '@/hooks'

const Race = () => {
  const raceId = Route.useParams({ select: (r) => r.raceId })
  const {
    races: { findRace },
    subraces,
  } = useRaceData()
  const race = findRace(raceId)

  const {
    features: { findFeature },
  } = useFeatureData()

  if (!race) return <div>Invalid or missing race data</div>

  return (
    <Detail item={race}>
      <div>{race?.desc && parse(race.desc)}</div>
      {race.details &&
        race.details?.length > 0 &&
        race.details.map((d, dI) => (
          <Fragment key={`${dI}-race-detail`}>
            <h1>{d?.label}</h1>
            <hr className={race_section_divider} />
            {d?.desc && parse(d?.desc)}
          </Fragment>
        ))}
      {race?.traits?.details?.length && (
        <>
          <h1>Traits</h1>
          <hr className={race_section_divider} />
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
        race.features.map((f, fI) => {
          const feature = findFeature(f)
          return (
            <Fragment key={`${fI}-race-feature`}>
              <h2>{feature?.label}</h2>
              {feature?.desc && parse(feature.desc)}
            </Fragment>
          )
        })}
      {subraces?.length &&
        subraces.map((s, sI) => {
          const subrace = findRace(s.id)
          return (
            subrace && (
              <Fragment key={`${sI}-subrace`}>
                <h2>{subrace.label}</h2>
                <hr className={race_section_divider} />
                <div>{subrace?.desc && parse(subrace.desc)}</div>
                {subrace.details &&
                  subrace.details?.length > 0 &&
                  subrace.details.map((d, dI) => (
                    <Fragment key={`${dI}-subrace-detail`}>
                      <h1>{d?.label}</h1>
                      <hr className={race_section_divider} />
                      {d?.desc && parse(d?.desc)}
                    </Fragment>
                  ))}
                {subrace?.traits?.details?.length && (
                  <>
                    <h1>Traits</h1>
                    <hr className={race_section_divider} />
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
                  subrace.features.map((f, fI) => {
                    const feature = findFeature(f)
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
