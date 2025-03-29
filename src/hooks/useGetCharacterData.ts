import { Character, CharacterFeature, CharacterHitpoint } from '../../amplify/gql/types'
import { useListClassesQuery } from '../apis/classesApi'
import { calculateHitpoints, sourcePropertyMap, SourcePropertyMapReturn } from '../utils/form'
import useGetSections from './useGetSectionState'

const useGetCharacterData = ({ formData }: { formData: Character }) => {
  const { data: classes } = useListClassesQuery()

  const { features, createSections, createAbilityScores } = useGetSections({ formData })
  const sections = createSections()
  const abilityScores = createAbilityScores()

  let hitpoints = {} as CharacterHitpoint

  const characterFeatures: CharacterFeature[] =
    features?.map((feature) => {
      const featureObj: CharacterFeature = {
        __typename: 'CharacterFeature',
        id: feature.id,
      }
      Object.keys(sourcePropertyMap(formData)).forEach((key) => {
        const typeKey = key as keyof SourcePropertyMapReturn
        if (sourcePropertyMap(formData)[typeKey]) {
          featureObj[typeKey] = feature[typeKey]
        }
      })
      if (feature.level) {
        featureObj.level = feature.level
      }
      if (feature.options?.length) {
        featureObj.options = feature.options
      }
      return featureObj
    }) || []

  if (formData?.classes?.length) {
    const primaryClass = classes?.find((c) => c.id === formData?.classes?.[0]?.id)
    if (primaryClass) {
      hitpoints = calculateHitpoints(formData, primaryClass)
    }
  } else if (formData?.hitpoint?.maxHitpoints !== undefined && formData?.hitpoint?.maxHitpoints !== null) {
    hitpoints = {
      __typename: 'CharacterHitpoint',
      maxHitpoints: undefined,
      maxOverride: undefined,
      method: formData?.hitpoint?.method,
      temp: undefined,
      bonus: undefined,
      rolled: {
        __typename: 'HitpointRoll',
        values: [],
        total: undefined,
        current: undefined,
      },
      fixed: {
        __typename: 'HitpointFixed',
        total: undefined,
        current: undefined,
      },
    }
  }

  return { features, characterFeatures, sections, hitpoints, abilityScores }
}
export default useGetCharacterData
