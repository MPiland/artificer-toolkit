import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import { selectAllRaces, useGetRacesQuery } from './raceApiSlice'
import Spinner from '../../components/Spinner/Spinner'
import Collapse from '../../components/Collapse/Collapse'
import { useEffect, useState } from 'react'
import { isEqual } from 'lodash'
import { feature_container } from './RaceShort.css'
import FormDetail from '../../components/Form/FormDetail'

const RaceShort = () => {
  const location: any = useLocation()

  const [parentRaces, setParentRaces] = useState<any[]>([])
  const [features, setFeatures] = useState<any[]>([])

  const { races, isLoading, isFetching }: { races: any; isFetching: boolean; isLoading: boolean } = useGetRacesQuery(
    undefined,
    {
      selectFromResult: ({ data, isLoading, isFetching }) => ({
        races: data && selectAllRaces(data),
        isLoading,
        isFetching,
      }),
    }
  )

  const race = location.state.item

  useEffect(() => {
    if (race.lineage?.length > 0) {
      race.lineage.forEach((lineage: any) => {
        const parentRacesArray = [...parentRaces]
        const race = races.find((race: any) => race._id === lineage._id)
        if (!parentRacesArray.includes(race)) {
          parentRacesArray.push(race)
          setParentRaces(parentRacesArray)
        }
      })
    }
  }, [parentRaces, race.lineage, races])

  useEffect(() => {
    const featuresArray = [...features]
    if (race.feature?.length > 0) {
      race.feature?.map((feature: any) => {
        if (!featuresArray.some((featureClone: any) => featureClone._id === feature._id)) {
          featuresArray.push(feature)
        }
      })
    }
    if (parentRaces?.length > 0) {
      parentRaces?.map((race) => {
        if (race.feature?.length > 0) {
          race.feature?.map((feature: any) => {
            if (!featuresArray.some((featureClone: any) => featureClone._id === feature._id)) {
              featuresArray.push(feature)
            }
          })
        }
      })
    }

    if (featuresArray.length > 0) {
      featuresArray.sort((a: any, b: any) => {
        if (a.value === b.value) {
          return a.desc.localeCompare(b.desc)
        } else {
          return a.value.localeCompare(b.value)
        }
      })
    }

    if (!isEqual(featuresArray, features)) {
      setFeatures(featuresArray)
    }
  }, [features, parentRaces, race.feature])

  return isLoading || isFetching || !race ? (
    <Spinner />
  ) : (
    <FormDetail footerSpacing='end'>
      {race?.detail?.length > 0 && parse(race?.detail[0].desc)}
      {parentRaces?.length > 0 && parentRaces?.map((race) => race?.detail?.length > 0 && parse(race?.detail[0].desc))}
      {race?.category?.name === 'subrace' && race?.desc && parse(race?.desc)}
      {race?.trait?.area?.length > 0 &&
        race.trait.area.map((area: any, index: number) => (
          <Collapse title={area.value} key={index} startOpened={true} className={feature_container}>
            {area.desc && parse(area.desc)}
          </Collapse>
        ))}
      {parentRaces?.length > 0 &&
        parentRaces?.map(
          (race) =>
            race?.trait?.area?.length > 0 &&
            race.trait.area.map((area: any, index: number) => (
              <Collapse title={area.value} key={index} startOpened={true} className={feature_container}>
                {area.desc && parse(area.desc)}
              </Collapse>
            ))
        )}
      {features?.length > 0 &&
        features.map((feature: any, index: number) => (
          <Collapse title={feature.value} key={index} startOpened={true} className={feature_container}>
            {feature.desc && parse(feature.desc)}
          </Collapse>
        ))}
    </FormDetail>
  )
}

export default RaceShort
