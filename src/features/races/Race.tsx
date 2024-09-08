import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Detail from '../../components/Detail/Detail'
import { Fragment } from 'react'

const Race = () => {
  const location: any = useLocation()

  const race = location.state.item

  return !race ? (
    <Spinner />
  ) : (
    <Detail footerSpacing='end'>
      <div>{race?.quote && parse((race as any).quote)}</div>
      <div>{race?.desc && parse((race as any).desc)}</div>
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
      {race?.trait?.area?.length > 0 && (
        <section>
          <h2>Traits</h2>
          <hr />
          {race.trait.area.map((areaItem: any, areaIndex: number) => (
            <Fragment key={areaIndex}>
              <h3>
                <strong>{areaItem.value}</strong>
              </h3>
              {areaItem.desc && parse(areaItem.desc)}
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
        race.features.map((feature: any, featureIndex: number) => (
          <section id={`${feature.name}`} key={featureIndex} className='pb-4'>
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
