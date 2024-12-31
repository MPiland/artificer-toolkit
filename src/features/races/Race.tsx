import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'
import { Race as RaceState } from '../../../amplify/API'

const Race = () => {
  const location = useLocation()

  const race: RaceState = location.state.item

  return (
    <Detail footerSpacing='end'>
      <div>{race?.quote && parse(race.quote)}</div>
      <div>{race?.desc && parse(race.desc)}</div>
      {race.details &&
        race.details?.length > 0 &&
        race.details.map((detail, index) => (
          <section id={`${detail.value}`} key={index}>
            <strong>
              <h2>{detail.label}</h2>
            </strong>
            <hr />
            {detail.desc && parse(detail.desc)}
          </section>
        ))}
      {race?.traits?.details?.length > 0 && (
        <section>
          <h2>Traits</h2>
          <hr />
          {race.traits.details.map((detail, index) => (
            <Fragment key={index}>
              <h3>
                <strong>{detail.label}</strong>
              </h3>
              {detail.desc && parse(detail.desc)}
            </Fragment>
          ))}
        </section>
      )}
      {race.ancestry && (
        <section>
          <h3>{race.ancestry.value}</h3>
          {race.ancestry.desc && parse(race.ancestry.desc)}
        </section>
      )}
      {race.features?.length > 0 &&
        race.features.map((feature, index) => (
          <section id={`${feature.value}`} key={index} className='pb-4'>
            <h3>
              <strong>{feature.value}</strong>
            </h3>
            {feature.desc && parse(feature.desc)}
          </section>
        ))}
    </Detail>
  )
}

export default Race
