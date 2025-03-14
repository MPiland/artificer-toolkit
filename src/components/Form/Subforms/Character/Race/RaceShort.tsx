import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { useListRacesQuery } from '../../../../../features/races/racesApi'
import Collapse from '../../../../Collapse/Collapse'
import { Race } from '../../../../../../amplify/gql/types'
import { Categories } from '../../../../../types/enums'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'

const RaceShort = () => {
  const location: any = useLocation()

  const { data: races } = useListRacesQuery()
  const race: Race = location.state.item

  const { createFeatures } = useGetFeatures({ data: race })
  const raceLineages = races.filter((sRace) => race?.lineages?.includes(sRace.id))
  const ancestry = race?.ancestry

  const features = createFeatures()

  return (
    <>
      <Grid.Item>{race?.details?.length > 0 && parse(race?.details[0].desc)}</Grid.Item>
      {raceLineages?.length > 0 &&
        raceLineages?.map((race, index) => (
          <Grid.Item key={index}>{race?.details?.length > 0 && parse(race?.details[0].desc)}</Grid.Item>
        ))}
      {race?.category === Categories.subrace && <Grid.Item>{race?.desc && parse(race?.desc)}</Grid.Item>}
      {race?.traits?.details.length > 0 &&
        race.traits.details.map((detail, index) => (
          <Grid.Item key={index}>
            <Collapse key={index}>
              <Collapse.Header title={detail.label} startOpened={true} />
              <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
            </Collapse>
          </Grid.Item>
        ))}
      {raceLineages?.length > 0 &&
        raceLineages?.map(
          (race) =>
            race?.traits?.details?.length > 0 &&
            race.traits.details.map((detail, index) => (
              <Grid.Item key={index}>
                <Collapse key={index}>
                  <Collapse.Header title={detail.label} startOpened={true} />
                  <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
                </Collapse>
              </Grid.Item>
            ))
        )}
      {features?.length > 0 &&
        features
          .sort((a, b) => a.value.localeCompare(b.value))
          .map((feature, index) => (
            <Grid.Item key={index}>
              <Collapse key={index}>
                <Collapse.Header title={feature.label} startOpened={true} />
                <Collapse.Body>{feature.desc && parse(feature.desc)}</Collapse.Body>
              </Collapse>
            </Grid.Item>
          ))}
      {ancestry && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={ancestry.label} startOpened={true} />
            <Collapse.Body>{ancestry.desc && parse(ancestry.desc)}</Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
    </>
  )
}

export default RaceShort
