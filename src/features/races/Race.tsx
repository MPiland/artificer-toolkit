import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'
import { Race as RaceState } from '../../../amplify/gql/types'
import { race_section_divider } from './Race.css'
import { useListRacesQuery } from './racesApi'

const Race = () => {
  const location = useLocation()
  const { data: races } = useListRacesQuery()

  const race: RaceState = location.state.item
  
  const subraces = races.filter((uRace) => uRace?.lineages?.includes(race.id))

  return (
    <Detail footerSpacing='end'>
      <div>{race?.desc && parse(race.desc)}</div>
      {race.details &&
        race.details?.length > 0 &&
        race.details.map((detail, index) => (
          <Fragment key={index}>
            <h1>{detail.label}</h1>
            <hr className={race_section_divider} />
            {detail.desc && parse(detail.desc)}
          </Fragment>
        ))}
      {race?.traits?.details?.length > 0 && (
        <>
          <h1>Traits</h1>
          <hr className={race_section_divider} />
          {race.traits.details.map((detail, index) => (
            <Fragment key={index}>
              <h2>{detail.label}</h2>
              {detail.desc && parse(detail.desc)}
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
      {race.features?.length > 0 &&
        race.features.map((feature, index) => (
          <Fragment key={index}>
            <h2>{feature.label}</h2>
            {feature.desc && parse(feature.desc)}
          </Fragment>
        ))}
      {subraces.length > 0 &&
        subraces.map((subrace, index) => (
          <Fragment key={index}>
            <h2>{subrace.label}</h2>
            <hr className={race_section_divider} />
            <div>{subrace?.desc && parse(subrace.desc)}</div>
            {subrace.details &&
              subrace.details?.length > 0 &&
              subrace.details.map((detail, dIndex) => (
                <Fragment key={dIndex}>
                  <h1>{detail.label}</h1>
                  <hr className={race_section_divider} />
                  {detail.desc && parse(detail.desc)}
                </Fragment>
              ))}
            {subrace?.traits?.details?.length > 0 && (
              <>
                <h1>Traits</h1>
                <hr className={race_section_divider} />
                {subrace.traits.details.map((detail, dIndex) => (
                  <Fragment key={dIndex}>
                    <h2>{detail.label}</h2>
                    {detail.desc && parse(detail.desc)}
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
            {subrace.features?.length > 0 &&
              subrace.features.map((feature, index) => (
                <Fragment key={index}>
                  <h2>{feature.label}</h2>
                  {feature.desc && parse(feature.desc)}
                </Fragment>
              ))}
          </Fragment>
        ))}
    </Detail>
  )
}

export default Race
