import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { useListRacesQuery } from './racesApi'
import Collapse from '../../components/Collapse/Collapse'
import { useCallback, useMemo } from 'react'
import { Feature, Race } from '../../../amplify/gql/types'
import { Categories } from '../../types/enums'

const RaceShort = () => {
  const location: any = useLocation()

  const { data: races } = useListRacesQuery()

  const race: Race = location.state.item
  const raceLineages = races.filter((sRace) => race?.lineages?.includes(sRace.id))

  const setFormRaces = useCallback(() => {
    const racesArray: Race[] = []
    if (race) {
      racesArray.push(race)
    }
    if (raceLineages) {
      raceLineages?.forEach((lineage) => {
        racesArray.push(lineage)
      })
    }

    return racesArray
  }, [race, raceLineages])

  const formRaces = useMemo(() => setFormRaces(), [setFormRaces])

  const createFeatures = useCallback(() => {
    const featureArrayUpdated: Feature[] = []

    formRaces.forEach((raceObject) => {
      // Default full features based off the raceObject
      const fullFeatures = raceObject?.features

      /* Inject feature into array based off type
        If lineage or base, use base race Id
        If ancestry, use the ancestry Id
        This will allow for removing erroneous features using unique identifiers */
      fullFeatures?.forEach((feature: Feature) => {
        if (!featureArrayUpdated.some((aFeature) => aFeature.id === feature.id)) {
          featureArrayUpdated.push(feature)
        }
      })
    })

    featureArrayUpdated.sort((a, b) => a.value.localeCompare(b.value))

    return featureArrayUpdated
  }, [formRaces])

  const features = useMemo(() => createFeatures(), [createFeatures])

  return (
    <>
      {race?.details?.length > 0 && parse(race?.details[0].desc)}
      {raceLineages?.length > 0 &&
        raceLineages?.map((race) => race?.details?.length > 0 && parse(race?.details[0].desc))}
      {race?.category === Categories.subrace && race?.desc && parse(race?.desc)}
      {race?.traits?.details.length > 0 &&
        race.traits.details.map((detail, index) => (
          <Collapse key={index}>
            <Collapse.Header title={detail.label} startOpened={true} />
            <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
          </Collapse>
        ))}
      {raceLineages?.length > 0 &&
        raceLineages?.map(
          (race) =>
            race?.traits?.details?.length > 0 &&
            race.traits.details.map((detail, index) => (
              <Collapse key={index}>
                <Collapse.Header title={detail.label} startOpened={true} />
                <Collapse.Body>{detail.desc && parse(detail.desc)}</Collapse.Body>
              </Collapse>
            ))
        )}
      {features?.length > 0 &&
        features.map((feature, index) => (
          <Collapse key={index}>
            <Collapse.Header title={feature.label} startOpened={true} />
            <Collapse.Body>{feature.desc && parse(feature.desc)}</Collapse.Body>
          </Collapse>
        ))}
    </>
  )
}

export default RaceShort
