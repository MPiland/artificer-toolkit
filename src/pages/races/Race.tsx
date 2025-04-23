import parse from 'html-react-parser'
import Detail from '@/components/Detail/Detail'
import { Fragment } from 'react'
import { race_section_divider } from '@/pages/races/Race.css'
import { Route } from '@/routes/_protected/races/$raceId'
import useRaceData from '@/hooks/useRaceData'

const Race = () => {
  const raceId = Route.useParams({ select: (r) => r.raceId })
  const {
    races: { findRace },
    subraces,
  } = useRaceData()
  const race = findRace(raceId)

  if (!race) return <div>Invalid or missing race data</div>

  return (
    <Detail footerSpacing='end' item={race}>
      <div>{race?.desc && parse(race.desc)}</div>
      {race.details &&
        race.details?.length > 0 &&
        race.details.map((detail, index) => (
          <Fragment key={index}>
            <h1>{detail?.label}</h1>
            <hr className={race_section_divider} />
            {detail?.desc && parse(detail?.desc)}
          </Fragment>
        ))}
      {race?.traits?.details?.length && (
        <>
          <h1>Traits</h1>
          <hr className={race_section_divider} />
          {race.traits.details.map((detail, index) => (
            <Fragment key={index}>
              <h2>{detail?.label}</h2>
              {detail?.desc && parse(detail?.desc)}
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
        race.features.map((feature, index) => (
          <Fragment key={index}>
            <h2>{feature?.label}</h2>
            {feature?.desc && parse(feature.desc)}
          </Fragment>
        ))}
      {subraces?.length &&
        subraces.map((s, index) => {
          const subrace = findRace(s.id)
          return (
            subrace && (
              <Fragment key={index}>
                <h2>{subrace.label}</h2>
                <hr className={race_section_divider} />
                <div>{subrace?.desc && parse(subrace.desc)}</div>
                {subrace.details &&
                  subrace.details?.length > 0 &&
                  subrace.details.map((detail, dIndex) => (
                    <Fragment key={dIndex}>
                      <h1>{detail?.label}</h1>
                      <hr className={race_section_divider} />
                      {detail?.desc && parse(detail?.desc)}
                    </Fragment>
                  ))}
                {subrace?.traits?.details?.length && (
                  <>
                    <h1>Traits</h1>
                    <hr className={race_section_divider} />
                    {subrace.traits.details.map((detail, dIndex) => (
                      <Fragment key={dIndex}>
                        <h2>{detail?.label}</h2>
                        {detail?.desc && parse(detail?.desc)}
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
                  subrace.features.map((feature, index) => (
                    <Fragment key={index}>
                      <h2>{feature?.label}</h2>
                      {feature?.desc && parse(feature.desc)}
                    </Fragment>
                  ))}
              </Fragment>
            )
          )
        })}
    </Detail>
  )
}

export default Race
